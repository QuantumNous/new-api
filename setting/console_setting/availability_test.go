package console_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAvailabilityStatusFromSuccessRate(t *testing.T) {
	t.Parallel()

	assert.Equal(t, "ok", AvailabilityStatusFromSuccessRate(1, 0))
	assert.Equal(t, "ok", AvailabilityStatusFromSuccessRate(0.95, 100))
	assert.Equal(t, "ok", AvailabilityStatusFromSuccessRate(1, 100))
	assert.Equal(t, "warn", AvailabilityStatusFromSuccessRate(0.949, 100))
	assert.Equal(t, "warn", AvailabilityStatusFromSuccessRate(0.80, 100))
	assert.Equal(t, "error", AvailabilityStatusFromSuccessRate(0.799, 100))
}

func TestGetCustomPagesForRoleVisibility(t *testing.T) {
	previous := consoleSetting.CustomPages
	t.Cleanup(func() {
		consoleSetting.CustomPages = previous
	})

	consoleSetting.CustomPages = `[
		{"id":"cp_all","title":"All","icon":"Link","url":"https://a.example.com","enabled":true,"visibility":"all","sort":1},
		{"id":"cp_admin","title":"Admin","icon":"Link","url":"https://b.example.com","enabled":true,"visibility":"admin","sort":2}
	]`

	forAll := GetCustomPagesForRole(false)
	assert.Len(t, forAll, 1)
	assert.Equal(t, "cp_all", forAll[0]["id"])

	forAdmin := GetCustomPagesForRole(true)
	assert.Len(t, forAdmin, 2)
}

func TestIsAvailabilityMonitorVisible(t *testing.T) {
	previousEnabled := consoleSetting.AvailabilityMonitorEnabled
	previousVisibility := consoleSetting.AvailabilityMonitorVisibility
	t.Cleanup(func() {
		consoleSetting.AvailabilityMonitorEnabled = previousEnabled
		consoleSetting.AvailabilityMonitorVisibility = previousVisibility
	})

	consoleSetting.AvailabilityMonitorEnabled = true
	consoleSetting.AvailabilityMonitorVisibility = "all"
	assert.True(t, IsAvailabilityMonitorVisible(false))
	assert.True(t, IsAvailabilityMonitorVisible(true))

	consoleSetting.AvailabilityMonitorVisibility = "admin"
	assert.False(t, IsAvailabilityMonitorVisible(false))
	assert.True(t, IsAvailabilityMonitorVisible(true))

	consoleSetting.AvailabilityMonitorEnabled = false
	assert.False(t, IsAvailabilityMonitorVisible(true))
}

func TestValidateAvailabilityMonitorRefreshInterval(t *testing.T) {
	t.Parallel()

	assert.NoError(t, ValidateAvailabilityMonitorRefreshInterval("5"))
	assert.NoError(t, ValidateAvailabilityMonitorRefreshInterval("10"))
	assert.NoError(t, ValidateAvailabilityMonitorRefreshInterval("3600"))
	assert.Error(t, ValidateAvailabilityMonitorRefreshInterval("4"))
	assert.Error(t, ValidateAvailabilityMonitorRefreshInterval("3601"))
	assert.Error(t, ValidateAvailabilityMonitorRefreshInterval("abc"))
}

func TestGetAvailabilityMonitorRefreshInterval(t *testing.T) {
	previous := consoleSetting.AvailabilityMonitorRefreshInterval
	t.Cleanup(func() {
		consoleSetting.AvailabilityMonitorRefreshInterval = previous
	})

	consoleSetting.AvailabilityMonitorRefreshInterval = 60
	assert.Equal(t, 60, GetAvailabilityMonitorRefreshInterval())

	consoleSetting.AvailabilityMonitorRefreshInterval = 1
	assert.Equal(t, 5, GetAvailabilityMonitorRefreshInterval())

	consoleSetting.AvailabilityMonitorRefreshInterval = 99999
	assert.Equal(t, 3600, GetAvailabilityMonitorRefreshInterval())
}
