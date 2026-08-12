package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestPricingVisibilityFiltersAllRowsForHiddenGroup(t *testing.T) {
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "enforce")
	db := setupModelListControllerTestDB(t)
	user := &model.User{Id: 3101, Username: "pricing-hidden-user", Password: "password", Group: "default", AffCode: "pricing-hidden-user-aff", Status: common.UserStatusEnabled}
	other := &model.User{Id: 3102, Username: "pricing-hidden-other", Password: "password", Group: "default", AffCode: "pricing-hidden-other-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create([]*model.User{user, other}).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "zz-hidden-all-pricing", ChannelId: 1, Enabled: true}).Error)
	require.NoError(t, model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityHidden,
	}))

	pricing := []model.Pricing{{ModelName: "zz-hidden-all-pricing", EnableGroup: []string{"all"}}}
	filtered, err := filterPricingByVisibilityForUser(pricing, other.Id)
	require.NoError(t, err)
	require.Empty(t, filtered, "EnableGroup=all must not bypass hidden visibility")

	// The anonymous endpoint retains its established public pricing behavior.
	filtered, err = filterPricingByVisibilityForUser(pricing, 0)
	require.NoError(t, err)
	require.Len(t, filtered, 1)
}

func TestPricingVisibilityFiltersAllRowsForTargetedDirectGroup(t *testing.T) {
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "enforce")
	db := setupModelListControllerTestDB(t)
	target := &model.User{Id: 3201, Username: "pricing-target", Password: "password", Group: "default", AffCode: "pricing-target-aff", Status: common.UserStatusEnabled}
	other := &model.User{Id: 3202, Username: "pricing-other", Password: "password", Group: "default", AffCode: "pricing-other-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create([]*model.User{target, other}).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "svip", Model: "zz-targeted-all-pricing", ChannelId: 1, Enabled: true}).Error)
	require.NoError(t, model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "svip", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id},
	}))

	pricing := []model.Pricing{{ModelName: "zz-targeted-all-pricing", EnableGroup: []string{"all"}}}
	filtered, err := filterPricingByVisibilityForUser(pricing, target.Id)
	require.NoError(t, err)
	require.Len(t, filtered, 1, "targeted user must see a direct-granted group even when pricing says all")

	filtered, err = filterPricingByVisibilityForUser(pricing, other.Id)
	require.NoError(t, err)
	require.Empty(t, filtered, "non-target user must not see a targeted direct group")

	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "shadow")
	filtered, err = filterPricingByVisibilityForUser(pricing, other.Id)
	require.NoError(t, err)
	require.Len(t, filtered, 1, "shadow mode must preserve legacy pricing output")
}
