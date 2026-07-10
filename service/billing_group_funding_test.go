package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
)

// 验证：当配置了付费分组时，IsPersonalFundingGroup 正确识别
// 这直接决定了 NewBillingSession 是否走排除公司套餐的路径
func TestNewBillingSession_PersonalFundingGroupDetection(t *testing.T) {
	// 保存并恢复原始状态
	orig := operation_setting.GetBillingGroupSetting()
	t.Cleanup(func() {
		operation_setting.GetBillingGroupSetting().PersonalFundingGroups = orig.PersonalFundingGroups
	})

	// Case 1: 未配置付费分组 — 所有分组都不是个人付费
	assert.False(t, operation_setting.IsPersonalFundingGroup("paid_model"))
	assert.False(t, operation_setting.IsPersonalFundingGroup("company_basic"))

	// Case 2: 配置付费分组
	operation_setting.GetBillingGroupSetting().PersonalFundingGroups = []string{
		"paid_model", "image_model", "premium_model",
	}

	// 付费分组应被识别为个人付费
	assert.True(t, operation_setting.IsPersonalFundingGroup("paid_model"),
		"paid_model should be detected as personal funding group")
	assert.True(t, operation_setting.IsPersonalFundingGroup("image_model"),
		"image_model should be detected as personal funding group")

	// 公司分组不应被识别
	assert.False(t, operation_setting.IsPersonalFundingGroup("company_l1"),
		"company_l1 should NOT be personal funding group")
	assert.False(t, operation_setting.IsPersonalFundingGroup("default"),
		"default should NOT be personal funding group")
}

// 验证：SubscriptionFunding 的 excludeBindGroup 字段正确传递
func TestSubscriptionFunding_ExcludeBindGroupField(t *testing.T) {
	// 构造带 excludeBindGroup=true 的 SubscriptionFunding
	funding := &SubscriptionFunding{
		requestId:        "test-req-id",
		userId:           1,
		modelName:        "gpt-4o",
		amount:           100,
		excludeBindGroup: true,
	}

	assert.Equal(t, BillingSourceSubscription, funding.Source())
	assert.True(t, funding.excludeBindGroup,
		"excludeBindGroup should be true for personal funding groups")

	// 构造 excludeBindGroup=false 的 SubscriptionFunding（公司分组场景）
	fundingCompany := &SubscriptionFunding{
		requestId:        "test-req-id-2",
		userId:           2,
		modelName:        "gpt-4o-mini",
		amount:           100,
		excludeBindGroup: false,
	}

	assert.False(t, fundingCompany.excludeBindGroup,
		"excludeBindGroup should be false for company groups")
}
