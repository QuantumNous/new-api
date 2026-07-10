package operation_setting

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

// helper: 重置 billing group 相关全局状态
func resetBillingGroupState() {
	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{}
	billingGroupSettingMu.Unlock()

	billingGroupGroupSetMu.Lock()
	billingGroupGroupSet = map[string]struct{}{}
	billingGroupGroupSetMu.Unlock()
}

func TestIsPersonalFundingGroup_EmptyConfig_ReturnsFalse(t *testing.T) {
	resetBillingGroupState()

	assert.False(t, IsPersonalFundingGroup("paid_model"))
	assert.False(t, IsPersonalFundingGroup("default"))
}

func TestIsPersonalFundingGroup_EmptyGroupName_ReturnsFalse(t *testing.T) {
	resetBillingGroupState()

	assert.False(t, IsPersonalFundingGroup(""))
}

func TestIsPersonalFundingGroup_GroupInList_ReturnsTrue(t *testing.T) {
	resetBillingGroupState()

	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{
		PersonalFundingGroups: []string{"paid_model", "image_model", "premium_model"},
	}
	billingGroupSettingMu.Unlock()

	assert.True(t, IsPersonalFundingGroup("paid_model"))
	assert.True(t, IsPersonalFundingGroup("image_model"))
	assert.True(t, IsPersonalFundingGroup("premium_model"))
}

func TestIsPersonalFundingGroup_GroupNotInList_ReturnsFalse(t *testing.T) {
	resetBillingGroupState()

	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{
		PersonalFundingGroups: []string{"paid_model"},
	}
	billingGroupSettingMu.Unlock()

	assert.False(t, IsPersonalFundingGroup("company_basic"))
	assert.False(t, IsPersonalFundingGroup("default"))
}

func TestIsPersonalFundingGroup_ConfigChange_UpdatesCache(t *testing.T) {
	resetBillingGroupState()

	// 初始配置
	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{
		PersonalFundingGroups: []string{"old_group"},
	}
	billingGroupSettingMu.Unlock()

	assert.True(t, IsPersonalFundingGroup("old_group"))
	assert.False(t, IsPersonalFundingGroup("new_group"))

	// 更新配置
	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{
		PersonalFundingGroups: []string{"new_group"},
	}
	billingGroupSettingMu.Unlock()

	// 缓存应自动刷新
	assert.False(t, IsPersonalFundingGroup("old_group"))
	assert.True(t, IsPersonalFundingGroup("new_group"))
}

func TestGetBillingGroupSetting_ReturnsPointer(t *testing.T) {
	resetBillingGroupState()

	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{
		PersonalFundingGroups: []string{"test_group"},
	}
	billingGroupSettingMu.Unlock()

	setting := GetBillingGroupSetting()
	assert.NotNil(t, setting)
	assert.Equal(t, []string{"test_group"}, setting.PersonalFundingGroups)
}

// 确保并发安全不 panic
func TestIsPersonalFundingGroup_ConcurrentSafe(t *testing.T) {
	resetBillingGroupState()

	billingGroupSettingMu.Lock()
	billingGroupSetting = BillingGroupSetting{
		PersonalFundingGroups: []string{"paid_model", "image_model"},
	}
	billingGroupSettingMu.Unlock()

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = IsPersonalFundingGroup("paid_model")
		}()
	}
	wg.Wait()
}
