package model

import (
	"fmt"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupParentQuotaTestState(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)

	old := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = false
	common.RedisEnabled = false
	t.Cleanup(func() { common.BatchUpdateEnabled = old })
}

func insertUser(t *testing.T, id int, username string, quota int, parentId int) {
	t.Helper()
	u := User{
		Id:       id,
		Username: username,
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		ParentId: parentId,
		AffCode:  fmt.Sprintf("pq-%d", id), // unique per user to satisfy the unique index
	}
	require.NoError(t, DB.Create(&u).Error)
}

// --- GetBillingUserId ---

func TestGetBillingUserId_NoParent(t *testing.T) {
	setupParentQuotaTestState(t)
	insertUser(t, 101, "solo-user", 500, 0)

	got, err := GetBillingUserId(101)
	require.NoError(t, err)
	assert.Equal(t, 101, got, "user with no parent should bill themselves")
}

func TestGetBillingUserId_WithParent(t *testing.T) {
	setupParentQuotaTestState(t)
	insertUser(t, 200, "parent-account", 10000, 0)
	insertUser(t, 201, "child-alice", 0, 200)

	got, err := GetBillingUserId(201)
	require.NoError(t, err)
	assert.Equal(t, 200, got, "user with parent_id should bill the parent")
}

func TestGetBillingUserId_UnknownUser(t *testing.T) {
	setupParentQuotaTestState(t)

	// Non-existent user: Scan with no rows sets parentId to zero,
	// so the function falls back to the requested user ID.
	got, err := GetBillingUserId(9999)
	require.NoError(t, err)
	assert.Equal(t, 9999, got)
}

// --- Quota deduction routes through billing user ---

func TestParentQuotaDeductedNotChild(t *testing.T) {
	setupParentQuotaTestState(t)
	insertUser(t, 300, "parent", 1000, 0)
	insertUser(t, 301, "child", 0, 300)

	billingId, err := GetBillingUserId(301)
	require.NoError(t, err)
	require.Equal(t, 300, billingId)

	require.NoError(t, DecreaseUserQuota(billingId, 250, true))

	parentQuota, err := GetUserQuota(300, true)
	require.NoError(t, err)
	assert.Equal(t, 750, parentQuota, "parent quota should decrease by the charged amount")

	childQuota, err := GetUserQuota(301, true)
	require.NoError(t, err)
	assert.Equal(t, 0, childQuota, "child quota must not be touched")
}

func TestChildWithoutParentBillsSelf(t *testing.T) {
	setupParentQuotaTestState(t)
	insertUser(t, 400, "standalone", 800, 0)

	billingId, err := GetBillingUserId(400)
	require.NoError(t, err)
	require.Equal(t, 400, billingId)

	require.NoError(t, DecreaseUserQuota(billingId, 300, true))

	quota, err := GetUserQuota(400, true)
	require.NoError(t, err)
	assert.Equal(t, 500, quota)
}

// --- Multiple children deducting from the same parent ---

func TestConcurrentChildDeductionsFromParent(t *testing.T) {
	setupParentQuotaTestState(t)
	// Parent starts with 1000; 5 children each deduct 100 → expect 500 remaining.
	insertUser(t, 500, "shared-parent", 1000, 0)
	for i := 501; i <= 505; i++ {
		insertUser(t, i, "member", 0, 500)
	}

	var wg sync.WaitGroup
	for i := 501; i <= 505; i++ {
		wg.Add(1)
		childId := i
		go func() {
			defer wg.Done()
			billingId, err := GetBillingUserId(childId)
			if err != nil {
				return
			}
			_ = DecreaseUserQuota(billingId, 100, true)
		}()
	}
	wg.Wait()

	remaining, err := GetUserQuota(500, true)
	require.NoError(t, err)
	assert.Equal(t, 500, remaining, "each child deducts 100; parent should have 500 left")
}

// --- Insufficient parent quota ---

// TestParentQuotaInsufficientBlocksChild verifies that the billing user's
// quota is the authoritative balance checked before a request proceeds.
// When the parent has less quota than requested, the caller must detect this
// via GetUserQuota before calling DecreaseUserQuota.
func TestParentQuotaInsufficientBlocksChild(t *testing.T) {
	setupParentQuotaTestState(t)
	insertUser(t, 600, "lean-parent", 50, 0)
	insertUser(t, 601, "hungry-child", 0, 600)

	billingId, err := GetBillingUserId(601)
	require.NoError(t, err)
	require.Equal(t, 600, billingId)

	balance, err := GetUserQuota(billingId, true)
	require.NoError(t, err)

	const requested = 200
	assert.Less(t, balance, requested,
		"parent balance (%d) is less than requested quota (%d); caller should reject the request", balance, requested)
}

// --- Refund routes back to the billing user ---

func TestRefundRoutesToParent(t *testing.T) {
	setupParentQuotaTestState(t)
	insertUser(t, 700, "parent", 1000, 0)
	insertUser(t, 701, "child", 0, 700)

	billingId, err := GetBillingUserId(701)
	require.NoError(t, err)

	// Pre-consume 300
	require.NoError(t, DecreaseUserQuota(billingId, 300, true))
	// Actual cost was only 200; refund the 100 overage back to billing user
	require.NoError(t, IncreaseUserQuota(billingId, 100, true))

	parentQuota, err := GetUserQuota(700, true)
	require.NoError(t, err)
	assert.Equal(t, 800, parentQuota, "net deduction should be 200 (300 pre-consume − 100 refund)")

	childQuota, err := GetUserQuota(701, true)
	require.NoError(t, err)
	assert.Equal(t, 0, childQuota, "child quota remains untouched throughout")
}
