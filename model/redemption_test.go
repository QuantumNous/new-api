package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSearchRedemptionsFiltersAndPaginates(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	})

	now := common.GetTimestamp()
	redemptions := []Redemption{
		{Id: 1, Name: "alpha-active", Key: "00000000000000000000000000000001", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: 0},
		{Id: 2, Name: "alpha-future", Key: "00000000000000000000000000000002", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now + 3600},
		{Id: 3, Name: "alpha-expired", Key: "00000000000000000000000000000003", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now - 10},
		{Id: 4, Name: "beta-disabled", Key: "00000000000000000000000000000004", Status: common.RedemptionCodeStatusDisabled, ExpiredTime: 0},
		{Id: 5, Name: "beta-used", Key: "00000000000000000000000000000005", Status: common.RedemptionCodeStatusUsed, ExpiredTime: 0},
	}
	require.NoError(t, DB.Create(&redemptions).Error)

	tests := []struct {
		name      string
		keyword   string
		status    string
		startIdx  int
		num       int
		wantTotal int64
		wantIds   []int
	}{
		{
			name:      "no filters returns all rows",
			num:       10,
			wantTotal: 5,
			wantIds:   []int{5, 4, 3, 2, 1},
		},
		{
			name:      "keyword filters by name prefix",
			keyword:   "alpha",
			num:       10,
			wantTotal: 3,
			wantIds:   []int{3, 2, 1},
		},
		{
			name:      "enabled status excludes expired rows",
			status:    "1",
			num:       10,
			wantTotal: 2,
			wantIds:   []int{2, 1},
		},
		{
			name:      "expired status returns enabled expired rows",
			status:    "expired",
			num:       10,
			wantTotal: 1,
			wantIds:   []int{3},
		},
		{
			name:      "disabled status",
			status:    "2",
			num:       10,
			wantTotal: 1,
			wantIds:   []int{4},
		},
		{
			name:      "used status",
			status:    "3",
			num:       10,
			wantTotal: 1,
			wantIds:   []int{5},
		},
		{
			name:      "pagination keeps unpaged total",
			startIdx:  1,
			num:       2,
			wantTotal: 5,
			wantIds:   []int{4, 3},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rows, total, err := SearchRedemptions(tt.keyword, tt.status, tt.startIdx, tt.num)
			require.NoError(t, err)
			assert.Equal(t, tt.wantTotal, total)
			gotIds := make([]int, 0, len(rows))
			for _, row := range rows {
				gotIds = append(gotIds, row.Id)
			}
			assert.Equal(t, tt.wantIds, gotIds)
		})
	}
}

func setupRedeemFixture(t *testing.T, quota int) (userId int, key string) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
		DB.Exec("DELETE FROM users")
		DB.Exec("DELETE FROM logs")
	})

	user := &User{Username: "redeem-user", Password: "password", Status: common.UserStatusEnabled, Quota: 0}
	require.NoError(t, DB.Create(user).Error)

	key = "10000000000000000000000000000001"
	redemption := &Redemption{
		Name:        "redeem-test",
		Key:         key,
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       quota,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)
	return user.Id, key
}

func TestRedeemCreditsQuotaExactlyOnce(t *testing.T) {
	userId, key := setupRedeemFixture(t, 500)

	quota, err := Redeem(key, userId)
	require.NoError(t, err)
	assert.Equal(t, 500, quota)

	var user User
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, 500, user.Quota)

	var redemption Redemption
	require.NoError(t, DB.First(&redemption, "name = ?", "redeem-test").Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, redemption.Status)
	assert.Equal(t, userId, redemption.UsedUserId)

	// Redeeming the same code again must fail and must not credit quota.
	_, err = Redeem(key, userId)
	require.Error(t, err)
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, 500, user.Quota)
}

func TestRedeemRejectsWalletOverflow(t *testing.T) {
	userId, key := setupRedeemFixture(t, 11)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", userId).Update("quota", common.MaxWalletQuota-10).Error)

	_, err := Redeem(key, userId)
	require.ErrorIs(t, err, ErrRedeemFailed)

	var user User
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, common.MaxWalletQuota-10, user.Quota)

	var redemption Redemption
	require.NoError(t, DB.First(&redemption, "key = ?", key).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, redemption.Status)
}

func TestRedemptionQuotaRejectsWalletOverflow(t *testing.T) {
	setupRedeemFixture(t, 500)

	redemption := &Redemption{
		Name:        "overflow-redemption",
		Key:         "10000000000000000000000000000002",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       common.MaxWalletQuota + 1,
		CreatedTime: common.GetTimestamp(),
	}
	require.Error(t, redemption.Insert())
}

// Exactly one of several concurrent redeems of the same code may win, and
// quota must be credited exactly once.
func TestRedeemConcurrentSingleSuccess(t *testing.T) {
	userId, key := setupRedeemFixture(t, 300)

	const goroutines = 5
	successes := make([]bool, goroutines)
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := range goroutines {
		go func(idx int) {
			defer wg.Done()
			if _, err := Redeem(key, userId); err == nil {
				successes[idx] = true
			}
		}(i)
	}
	wg.Wait()

	successCount := 0
	for _, ok := range successes {
		if ok {
			successCount++
		}
	}
	assert.Equal(t, 1, successCount, "exactly one concurrent redeem should succeed")

	var user User
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, 300, user.Quota, "quota must be credited exactly once")
}

func TestQuotaRedemptionAdminPathsExcludePackageCodes(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	})

	quota := Redemption{
		Key:    "20000000000000000000000000000001",
		Name:   "quota-code",
		Status: common.RedemptionCodeStatusEnabled,
	}
	packageCode := Redemption{
		Key:    "20000000000000000000000000000002",
		Name:   "package-code",
		Status: common.RedemptionCodeStatusEnabled,
		Type:   common.RedemptionCodeTypeSubscription,
	}
	directDeleteCode := Redemption{
		Key:    "20000000000000000000000000000003",
		Name:   "package-direct-delete",
		Status: common.RedemptionCodeStatusEnabled,
		Type:   common.RedemptionCodeTypeSubscription,
	}
	idDeleteCode := Redemption{
		Key:    "20000000000000000000000000000004",
		Name:   "package-id-delete",
		Status: common.RedemptionCodeStatusEnabled,
		Type:   common.RedemptionCodeTypeSubscription,
	}
	cleanupCode := Redemption{
		Key:    "20000000000000000000000000000005",
		Name:   "package-cleanup",
		Status: common.RedemptionCodeStatusDisabled,
		Type:   common.RedemptionCodeTypeSubscription,
	}
	invalidQuotaCode := Redemption{
		Key:    "20000000000000000000000000000006",
		Name:   "quota-cleanup",
		Status: common.RedemptionCodeStatusDisabled,
	}
	require.NoError(t, DB.Create(&[]Redemption{quota, packageCode, directDeleteCode, idDeleteCode, cleanupCode, invalidQuotaCode}).Error)

	rows, total, err := GetAllRedemptions(0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, rows, 2)

	rows, total, err = SearchRedemptions("", "", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, rows, 2)

	var storedPackage Redemption
	require.NoError(t, DB.Where("key = ?", packageCode.Key).First(&storedPackage).Error)
	_, err = GetRedemptionById(storedPackage.Id)
	assert.Error(t, err)
	_, err = Redeem(packageCode.Key, 1)
	assert.Error(t, err)

	storedPackage.Name = "mutated-package-code"
	assert.Error(t, storedPackage.Update())
	var reloadedPackage Redemption
	require.NoError(t, DB.First(&reloadedPackage, storedPackage.Id).Error)
	assert.Equal(t, packageCode.Name, reloadedPackage.Name)

	var storedDirectDelete Redemption
	require.NoError(t, DB.Where("key = ?", directDeleteCode.Key).First(&storedDirectDelete).Error)
	assert.Error(t, storedDirectDelete.Delete())
	require.NoError(t, DB.First(&Redemption{}, storedDirectDelete.Id).Error)

	var storedIDDelete Redemption
	require.NoError(t, DB.Where("key = ?", idDeleteCode.Key).First(&storedIDDelete).Error)
	assert.Error(t, DeleteRedemptionById(storedIDDelete.Id))
	require.NoError(t, DB.First(&Redemption{}, storedIDDelete.Id).Error)

	deleted, err := DeleteInvalidRedemptions()
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)
	var storedCleanup Redemption
	require.NoError(t, DB.Where("key = ?", cleanupCode.Key).First(&storedCleanup).Error)

	assert.Error(t, (&Redemption{
		Key:    "20000000000000000000000000000007",
		Name:   "legacy-package-insert",
		Status: common.RedemptionCodeStatusEnabled,
		Type:   common.RedemptionCodeTypeSubscription,
	}).Insert())
}

func TestQuotaRedemptionNoOpUpdatesRemainAllowed(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	})

	quotaCode := &Redemption{
		Key:          "30000000000000000000000000000001",
		Name:         "unchanged-quota-code",
		Status:       common.RedemptionCodeStatusEnabled,
		Quota:        100,
		RedeemedTime: 10,
	}
	require.NoError(t, DB.Create(quotaCode).Error)
	const forceNoOpRowsCallback = "test:force-redemption-update-rows-affected-zero"
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(forceNoOpRowsCallback, func(tx *gorm.DB) {
		tx.RowsAffected = 0
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(forceNoOpRowsCallback))
	})
	require.NoError(t, quotaCode.SelectUpdate())
	require.NoError(t, quotaCode.Update())

	packageCode := &Redemption{
		Key:    "30000000000000000000000000000002",
		Name:   "protected-package-code",
		Status: common.RedemptionCodeStatusEnabled,
		Type:   common.RedemptionCodeTypeSubscription,
	}
	require.NoError(t, DB.Create(packageCode).Error)
	packageCode.Status = common.RedemptionCodeStatusDisabled
	err := packageCode.SelectUpdate()
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	packageCode.Name = "mutated-package-code"
	err = packageCode.Update()
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	var storedPackage Redemption
	require.NoError(t, DB.First(&storedPackage, packageCode.Id).Error)
	assert.Equal(t, "protected-package-code", storedPackage.Name)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, storedPackage.Status)
}
