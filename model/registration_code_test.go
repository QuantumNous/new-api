package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationCodeFixture(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&RegistrationCode{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&RegistrationCode{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&RegistrationCode{}).Error)
		DB.Exec("DELETE FROM users")
		DB.Exec("DELETE FROM logs")
	})
}

func TestSearchRegistrationCodesFiltersAndJoinsUsername(t *testing.T) {
	setupRegistrationCodeFixture(t)

	user := &User{Username: "regcode-user", Password: "password", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)

	now := common.GetTimestamp()
	codes := []RegistrationCode{
		{Id: 1, Name: "alpha-active", Key: "20000000000000000000000000000001", Status: common.RegistrationCodeStatusUnused, ExpiredTime: 0},
		{Id: 2, Name: "alpha-future", Key: "20000000000000000000000000000002", Status: common.RegistrationCodeStatusUnused, ExpiredTime: now + 3600},
		{Id: 3, Name: "alpha-expired", Key: "20000000000000000000000000000003", Status: common.RegistrationCodeStatusUnused, ExpiredTime: now - 10},
		{Id: 4, Name: "beta-used", Key: "20000000000000000000000000000004", Status: common.RegistrationCodeStatusUsed, UsedUserId: user.Id},
	}
	require.NoError(t, DB.Create(&codes).Error)

	tests := []struct {
		name      string
		keyword   string
		status    string
		wantTotal int64
		wantIds   []int
	}{
		{name: "no filters returns all rows", wantTotal: 4, wantIds: []int{4, 3, 2, 1}},
		{name: "keyword filters by name prefix", keyword: "alpha", wantTotal: 3, wantIds: []int{3, 2, 1}},
		{name: "unused status excludes expired rows", status: "1", wantTotal: 2, wantIds: []int{2, 1}},
		{name: "expired status returns unused expired rows", status: "expired", wantTotal: 1, wantIds: []int{3}},
		{name: "used status", status: "3", wantTotal: 1, wantIds: []int{4}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rows, total, err := SearchRegistrationCodes(tt.keyword, tt.status, 0, 10)
			require.NoError(t, err)
			assert.Equal(t, tt.wantTotal, total)
			gotIds := make([]int, 0, len(rows))
			for _, row := range rows {
				gotIds = append(gotIds, row.Id)
			}
			assert.Equal(t, tt.wantIds, gotIds)
		})
	}

	// The used row must expose the consuming user's name via the JOIN.
	rows, _, err := SearchRegistrationCodes("", "3", 0, 10)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "regcode-user", rows[0].UsedUsername)
}

func TestConsumeRegistrationCodeExactlyOnce(t *testing.T) {
	setupRegistrationCodeFixture(t)

	key := "30000000000000000000000000000001"
	require.NoError(t, DB.Create(&RegistrationCode{
		Name:        "consume-test",
		Key:         key,
		Status:      common.RegistrationCodeStatusUnused,
		CreatedTime: common.GetTimestamp(),
	}).Error)

	require.NoError(t, ConsumeRegistrationCode(key, 42))

	var code RegistrationCode
	require.NoError(t, DB.First(&code, "name = ?", "consume-test").Error)
	assert.Equal(t, common.RegistrationCodeStatusUsed, code.Status)
	assert.Equal(t, 42, code.UsedUserId)
	assert.NotZero(t, code.UsedTime)

	err := ConsumeRegistrationCode(key, 43)
	require.ErrorIs(t, err, ErrRegistrationCodeUsed)
	require.NoError(t, DB.First(&code, "name = ?", "consume-test").Error)
	assert.Equal(t, 42, code.UsedUserId, "second consume must not steal the code")
}

func TestConsumeRegistrationCodeRejectsInvalidAndExpired(t *testing.T) {
	setupRegistrationCodeFixture(t)

	require.ErrorIs(t, ConsumeRegistrationCode("missing-key", 1), ErrRegistrationCodeInvalid)

	expiredKey := "30000000000000000000000000000002"
	require.NoError(t, DB.Create(&RegistrationCode{
		Name:        "expired-test",
		Key:         expiredKey,
		Status:      common.RegistrationCodeStatusUnused,
		ExpiredTime: common.GetTimestamp() - 10,
	}).Error)
	require.ErrorIs(t, ConsumeRegistrationCode(expiredKey, 1), ErrRegistrationCodeExpired)

	var code RegistrationCode
	require.NoError(t, DB.First(&code, "name = ?", "expired-test").Error)
	assert.Equal(t, common.RegistrationCodeStatusUnused, code.Status, "expired code must stay unconsumed")
}

// Exactly one of several concurrent consumers of the same code may win.
func TestConsumeRegistrationCodeConcurrentSingleSuccess(t *testing.T) {
	setupRegistrationCodeFixture(t)

	key := "30000000000000000000000000000003"
	require.NoError(t, DB.Create(&RegistrationCode{
		Name:   "concurrent-test",
		Key:    key,
		Status: common.RegistrationCodeStatusUnused,
	}).Error)

	const goroutines = 5
	successes := make([]bool, goroutines)
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			defer wg.Done()
			if err := ConsumeRegistrationCode(key, idx+1); err == nil {
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
	assert.Equal(t, 1, successCount, "exactly one concurrent consume should succeed")
}
