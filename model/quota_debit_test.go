package model

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedUser(t *testing.T, id, quota int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{Id: id, Username: "u", Quota: quota, Status: 1, Role: 1}).Error)
}

func TestDebit_Success(t *testing.T) {
	truncateTables(t)
	seedUser(t, 100, 1000)

	res, err := DebitUserQuotaIdempotent(100, 300, "ext-success")
	require.NoError(t, err)
	assert.Equal(t, "ok", res.Code)
	assert.Equal(t, 700, res.RemainingQuota)

	var u User
	require.NoError(t, DB.First(&u, 100).Error)
	assert.Equal(t, 700, u.Quota)

	var n int64
	DB.Model(&QuotaDebit{}).Where("external_id = ?", "ext-success").Count(&n)
	assert.Equal(t, int64(1), n)
}

func TestDebit_Insufficient(t *testing.T) {
	truncateTables(t)
	seedUser(t, 101, 100)

	res, err := DebitUserQuotaIdempotent(101, 500, "ext-insufficient")
	require.NoError(t, err)
	assert.Equal(t, "insufficient", res.Code)
	assert.Equal(t, 100, res.RemainingQuota)

	var u User
	require.NoError(t, DB.First(&u, 101).Error)
	assert.Equal(t, 100, u.Quota, "quota must be unchanged")

	var n int64
	DB.Model(&QuotaDebit{}).Where("external_id = ?", "ext-insufficient").Count(&n)
	assert.Equal(t, int64(0), n, "no debit row recorded on insufficient")
}

func TestDebit_IdempotentReplay(t *testing.T) {
	truncateTables(t)
	seedUser(t, 102, 1000)

	r1, err := DebitUserQuotaIdempotent(102, 300, "ext-dup")
	require.NoError(t, err)
	assert.Equal(t, "ok", r1.Code)

	r2, err := DebitUserQuotaIdempotent(102, 300, "ext-dup")
	require.NoError(t, err)
	assert.Equal(t, "ok", r2.Code)
	assert.Equal(t, 700, r2.RemainingQuota)

	var u User
	require.NoError(t, DB.First(&u, 102).Error)
	assert.Equal(t, 700, u.Quota, "debited exactly once across two calls")

	var n int64
	DB.Model(&QuotaDebit{}).Where("external_id = ?", "ext-dup").Count(&n)
	assert.Equal(t, int64(1), n)
}

func TestDebit_ConcurrentSameExternalId(t *testing.T) {
	truncateTables(t)
	seedUser(t, 103, 1000)

	const g = 5
	var wg sync.WaitGroup
	wg.Add(g)
	for i := 0; i < g; i++ {
		go func() {
			defer wg.Done()
			_, _ = DebitUserQuotaIdempotent(103, 300, "ext-race")
		}()
	}
	wg.Wait()

	var u User
	require.NoError(t, DB.First(&u, 103).Error)
	assert.Equal(t, 700, u.Quota, "exactly one debit applied despite N concurrent calls")

	var n int64
	DB.Model(&QuotaDebit{}).Where("external_id = ?", "ext-race").Count(&n)
	assert.Equal(t, int64(1), n)
}
