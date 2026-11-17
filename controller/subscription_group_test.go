package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeQuotaUsableGroups(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "empty", raw: "", want: ""},
		{name: "single", raw: "default", want: "default"},
		{name: "trims whitespace", raw: " default , vip ", want: "default,vip"},
		{name: "dedupes", raw: "default,default,vip", want: "default,vip"},
		{name: "drops empty entries", raw: ",,default,,vip,", want: "default,vip"},
		{name: "only separators", raw: " , , ", want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, normalizeQuotaUsableGroups(tt.raw))
		})
	}
}

func TestValidateQuotaUsableGroups(t *testing.T) {
	require.NoError(t, i18n.Init())
	previousRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios)) })
	longGroup := strings.Repeat("g", 255)
	cjkGroup := strings.Repeat("组", 255)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(fmt.Sprintf(
		`{"default":1,"vip":1,%q:1,%q:1}`, longGroup, cjkGroup)))

	tests := []struct {
		name   string
		groups string
		want   bool
	}{
		{name: "empty is unrestricted", groups: "", want: true},
		{name: "all groups exist", groups: "default,vip", want: true},
		{name: "unknown group rejected", groups: "default,does-not-exist", want: false},
		{name: "255 characters accepted", groups: longGroup, want: true},
		{name: "256 characters rejected", groups: longGroup + "x", want: false},
		{name: "length counts runes not bytes", groups: cjkGroup, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			assert.Equal(t, tt.want, validateQuotaUsableGroups(c, tt.groups))
		})
	}
}

// Exercises group-restricted subscription billing through the same public
// entry points used by the relay: pre-consume, settle, refund and retry reuse.
func TestSubscriptionGroupBillingDatabaseMatrix(t *testing.T) {
	require.NoError(t, i18n.Init())
	previousConfig := config.GlobalConfig.ExportAllConfigs()
	previousTrust := operation_setting.GetQuotaSetting().TrustQuotaUSD
	operation_setting.GetQuotaSetting().TrustQuotaUSD = 0
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previousConfig))
		operation_setting.GetQuotaSetting().TrustQuotaUSD = previousTrust
	})
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			require.NoError(t, db.AutoMigrate(&model.Token{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}))

			seq := 0
			seedUser := func(wallet, tokenQuota int) (model.User, model.Token) {
				t.Helper()
				seq++
				user := model.User{Username: fmt.Sprintf("grp-billing-user-%d", seq), Quota: wallet, Group: "default", AffCode: fmt.Sprintf("grp-billing-aff-%d", seq)}
				require.NoError(t, db.Create(&user).Error)
				token := model.Token{UserId: user.Id, Key: fmt.Sprintf("grp-billing-token-%d", seq), RemainQuota: tokenQuota}
				require.NoError(t, db.Create(&token).Error)
				return user, token
			}
			seedPlan := func(groups string, overflow bool) model.SubscriptionPlan {
				t.Helper()
				plan := model.SubscriptionPlan{
					Title:               "grp-billing",
					PriceAmount:         1,
					DurationUnit:        model.SubscriptionDurationMonth,
					DurationValue:       1,
					TotalAmount:         100000,
					QuotaUsableGroups:   groups,
					AllowWalletOverflow: &overflow,
				}
				require.NoError(t, db.Create(&plan).Error)
				model.InvalidateSubscriptionPlanCache(plan.Id)
				t.Cleanup(func() { model.InvalidateSubscriptionPlanCache(plan.Id) })
				return plan
			}
			seedSub := func(userId, planId int, used int64, overflow bool) model.UserSubscription {
				t.Helper()
				now := common.GetTimestamp()
				sub := model.UserSubscription{
					UserId: userId, PlanId: planId,
					AmountTotal: 100000, AmountUsed: used,
					StartTime: now - 3600, EndTime: now + 30*24*3600,
					Status: "active", AllowWalletOverflow: overflow,
				}
				require.NoError(t, db.Create(&sub).Error)
				return sub
			}
			newRelay := func(user model.User, token model.Token, pref, group string) (*gin.Context, *relaycommon.RelayInfo) {
				t.Helper()
				seq++
				ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
				ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
				ctx.Set("token_quota", token.RemainQuota)
				info := &relaycommon.RelayInfo{
					UserId: user.Id, TokenId: token.Id, TokenKey: token.Key,
					RequestId:       fmt.Sprintf("grp-billing-req-%d", seq),
					OriginModelName: "grp-billing-model",
					UserGroup:       "default",
					UsingGroup:      group,
				}
				info.UserSetting.BillingPreference = pref
				return ctx, info
			}
			subUsed := func(id int) int64 {
				t.Helper()
				var sub model.UserSubscription
				require.NoError(t, db.First(&sub, id).Error)
				return sub.AmountUsed
			}
			walletOf := func(id int) int {
				t.Helper()
				var user model.User
				require.NoError(t, db.First(&user, id).Error)
				return user.Quota
			}
			tokenRemain := func(id int) int {
				t.Helper()
				var token model.Token
				require.NoError(t, db.First(&token, id).Error)
				return token.RemainQuota
			}

			t.Run("eligible group consumes subscription", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_first", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceSubscription, info.BillingSource)
				assert.Equal(t, 500000, walletOf(user.Id))
				assert.EqualValues(t, 1000, subUsed(sub.Id))
				assert.Equal(t, 499000, tokenRemain(token.Id))

				require.NoError(t, info.Billing.Settle(600))
				assert.EqualValues(t, 600, subUsed(sub.Id))
				assert.Equal(t, 499400, tokenRemain(token.Id))
				assert.Equal(t, 500000, walletOf(user.Id))
				require.NoError(t, info.Billing.Settle(600))
				assert.EqualValues(t, 600, subUsed(sub.Id))
			})

			t.Run("other group consumes wallet", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_first", "vip")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceWallet, info.BillingSource)
				assert.Equal(t, 499000, walletOf(user.Id))
				assert.EqualValues(t, 0, subUsed(sub.Id))
			})

			t.Run("subscription_only other group falls back to wallet", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_only", "vip")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceWallet, info.BillingSource)
				assert.Equal(t, 499000, walletOf(user.Id))
				assert.EqualValues(t, 0, subUsed(sub.Id))
			})

			t.Run("subscription_only without subscription fails", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				ctx, info := newRelay(user, token, "subscription_only", "default")

				require.NotNil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Nil(t, info.Billing)
				assert.Equal(t, 500000, walletOf(user.Id))
			})

			t.Run("wallet_only ignores eligible subscription", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "wallet_only", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceWallet, info.BillingSource)
				assert.Equal(t, 499000, walletOf(user.Id))
				assert.EqualValues(t, 0, subUsed(sub.Id))
			})

			t.Run("wallet_first falls back to subscription", func(t *testing.T) {
				user, token := seedUser(0, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "wallet_first", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceSubscription, info.BillingSource)
				assert.EqualValues(t, 1000, subUsed(sub.Id))
				assert.Equal(t, 0, walletOf(user.Id))
			})

			t.Run("unrelated strict plan does not block overflow", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				relaxed := seedPlan("default", true)
				seedSub(user.Id, relaxed.Id, 100000, true) // exhausted
				strict := seedPlan("vip", false)
				seedSub(user.Id, strict.Id, 0, false) // strict but only for vip
				ctx, info := newRelay(user, token, "subscription_first", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceWallet, info.BillingSource)
				assert.Equal(t, 499000, walletOf(user.Id))
			})

			t.Run("eligible strict plan blocks overflow", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				strict := seedPlan("default", false)
				seedSub(user.Id, strict.Id, 100000, false) // exhausted and strict
				ctx, info := newRelay(user, token, "subscription_first", "default")

				require.NotNil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, 500000, walletOf(user.Id))
			})

			t.Run("empty group cannot use restricted plan", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_first", "")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				assert.Equal(t, service.BillingSourceWallet, info.BillingSource)
				assert.EqualValues(t, 0, subUsed(sub.Id))
			})

			t.Run("refund restores subscription and token", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_first", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				info.Billing.Refund(ctx)
				require.Eventually(t, func() bool {
					return subUsed(sub.Id) == 0 && tokenRemain(token.Id) == 500000
				}, 5*time.Second, 20*time.Millisecond)
				var record model.SubscriptionPreConsumeRecord
				require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&record).Error)
				assert.Equal(t, "refunded", record.Status)
				assert.Equal(t, 500000, walletOf(user.Id))
			})

			t.Run("refund restores wallet and token", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				ctx, info := newRelay(user, token, "wallet_only", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				info.Billing.Refund(ctx)
				require.Eventually(t, func() bool {
					return walletOf(user.Id) == 500000 && tokenRemain(token.Id) == 500000
				}, 5*time.Second, 20*time.Millisecond)
			})

			t.Run("retry group switch is guarded", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_first", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				info.UsingGroup = "vip"
				require.NotNil(t, service.PreConsumeBilling(ctx, 2000, info),
					"a subscription reserved for another group must not fund the retry")
				assert.EqualValues(t, 1000, subUsed(sub.Id))
				assert.Equal(t, 500000, walletOf(user.Id))

				info.UsingGroup = "default"
				require.Nil(t, service.PreConsumeBilling(ctx, 2500, info))
				assert.EqualValues(t, 2500, subUsed(sub.Id))
				assert.Equal(t, 497500, tokenRemain(token.Id))
			})

			t.Run("tiered retry group switch is guarded", func(t *testing.T) {
				user, token := seedUser(500000, 500000)
				plan := seedPlan("default", true)
				sub := seedSub(user.Id, plan.Id, 0, true)
				ctx, info := newRelay(user, token, "subscription_first", "default")

				require.Nil(t, service.PreConsumeBilling(ctx, 1000, info))
				info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{
					BillingMode:               "tiered_expr",
					GroupRatio:                1,
					EstimatedQuotaBeforeGroup: 2000,
					EstimatedQuotaAfterGroup:  2000,
					QuotaPerUnit:              500000,
				}
				info.PriceData.GroupRatioInfo.GroupRatio = 2
				info.UsingGroup = "vip"
				apiErr := service.PrepareTieredBillingForSelectedGroup(ctx, info)
				require.NotNil(t, apiErr, "tiered retry preparation must reject an ineligible group")
				assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
				assert.EqualValues(t, 1000, subUsed(sub.Id))
				assert.Equal(t, 1.0, info.TieredBillingSnapshot.GroupRatio,
					"the guard must run before the snapshot refresh")

				info.UsingGroup = "default"
				require.Nil(t, service.PrepareTieredBillingForSelectedGroup(ctx, info))
				assert.EqualValues(t, 4000, subUsed(sub.Id))
			})
		})
	}
}
