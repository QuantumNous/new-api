package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupAgentPlanOfferTest(t *testing.T) {
	t.Helper()
	for _, table := range []interface{}{
		&model.SubscriptionPlan{}, &model.AgentPlanOffer{},
		&model.AgentPurchaseOrder{}, &model.Redemption{},
	} {
		if !model.DB.Migrator().HasTable(table) {
			require.NoError(t, model.DB.AutoMigrate(table))
		}
	}
	for _, table := range []string{"redemptions", "agent_purchase_orders", "agent_plan_offers", "subscription_plans"} {
		require.NoError(t, model.DB.Exec("DELETE FROM "+table).Error)
	}
	t.Cleanup(func() {
		for _, table := range []string{"redemptions", "agent_purchase_orders", "agent_plan_offers", "subscription_plans"} {
			require.NoError(t, model.DB.Exec("DELETE FROM "+table).Error)
		}
	})
}

func createAgentOfferPlan(t *testing.T, title string) model.SubscriptionPlan {
	t.Helper()
	plan := model.SubscriptionPlan{
		Title: title, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth,
		DurationValue: 1, Enabled: true,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	return plan
}

func TestAgentPlanOfferRejectsInvalidTermsAndMissingPlan(t *testing.T) {
	setupAgentPlanOfferTest(t)
	plan := createAgentOfferPlan(t, "Monthly")
	validDays := 365

	tests := []struct {
		name  string
		input AgentPlanOfferInput
		want  error
	}{
		{
			name: "missing plan",
			input: AgentPlanOfferInput{PlanID: plan.Id + 1000, Enabled: true, UnitPrice: 6000,
				CodeValidDays: &validDays, RefundFeeBps: 500},
			want: ErrAgentPlanNotFound,
		},
		{
			name: "zero price",
			input: AgentPlanOfferInput{PlanID: plan.Id, Enabled: true, UnitPrice: 0,
				CodeValidDays: &validDays, RefundFeeBps: 500},
			want: ErrAgentOfferInvalidPrice,
		},
		{
			name: "negative price",
			input: AgentPlanOfferInput{PlanID: plan.Id, Enabled: true, UnitPrice: -1,
				CodeValidDays: &validDays, RefundFeeBps: 500},
			want: ErrAgentOfferInvalidPrice,
		},
		{
			name: "zero validity",
			input: AgentPlanOfferInput{PlanID: plan.Id, Enabled: true, UnitPrice: 6000,
				CodeValidDays: common.GetPointer(0), RefundFeeBps: 500},
			want: ErrAgentOfferInvalidValidity,
		},
		{
			name: "validity too large",
			input: AgentPlanOfferInput{PlanID: plan.Id, Enabled: true, UnitPrice: 6000,
				CodeValidDays: common.GetPointer(3651), RefundFeeBps: 500},
			want: ErrAgentOfferInvalidValidity,
		},
		{
			name: "negative fee",
			input: AgentPlanOfferInput{PlanID: plan.Id, Enabled: true, UnitPrice: 6000,
				CodeValidDays: &validDays, RefundFeeBps: -1},
			want: ErrAgentOfferInvalidRefundFee,
		},
		{
			name: "fee too large",
			input: AgentPlanOfferInput{PlanID: plan.Id, Enabled: true, UnitPrice: 6000,
				CodeValidDays: &validDays, RefundFeeBps: 10001},
			want: ErrAgentOfferInvalidRefundFee,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := UpsertAgentPlanOffer(tt.input)
			assert.ErrorIs(t, err, tt.want)
		})
	}

	var count int64
	require.NoError(t, model.DB.Model(&model.AgentPlanOffer{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAgentPlanOfferDefaultsValidityAndUpsertsOneRowPerPlan(t *testing.T) {
	setupAgentPlanOfferTest(t)
	plan := createAgentOfferPlan(t, "Monthly")

	created, err := UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: plan.Id, Enabled: true, UnitPrice: 6000, RefundFeeBps: 0,
	})
	require.NoError(t, err)
	assert.Equal(t, model.DefaultAgentCodeValidDays, created.CodeValidDays)
	assert.Equal(t, int64(6000), created.UnitPrice)
	assert.Zero(t, created.RefundFeeBps)

	updatedDays := 3650
	updated, err := UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: plan.Id, Enabled: true, UnitPrice: 7250,
		CodeValidDays: &updatedDays, RefundFeeBps: 10000,
	})
	require.NoError(t, err)
	assert.Equal(t, created.Id, updated.Id)
	assert.Equal(t, int64(7250), updated.UnitPrice)
	assert.Equal(t, 3650, updated.CodeValidDays)
	assert.Equal(t, 10000, updated.RefundFeeBps)

	var count int64
	require.NoError(t, model.DB.Model(&model.AgentPlanOffer{}).Where("plan_id = ?", plan.Id).Count(&count).Error)
	assert.Equal(t, int64(1), count)
	assert.Error(t, model.DB.Create(&model.AgentPlanOffer{
		PlanId: plan.Id, Enabled: true, UnitPrice: 1,
		CodeValidDays: 1, RefundFeeBps: 0,
	}).Error)
}

func TestAgentPlanOfferListReturnsCurrentPlans(t *testing.T) {
	setupAgentPlanOfferTest(t)
	firstPlan := createAgentOfferPlan(t, "Monthly")
	secondPlan := createAgentOfferPlan(t, "Annual")
	validDays := 365
	_, err := UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: firstPlan.Id, Enabled: true, UnitPrice: 6000,
		CodeValidDays: &validDays, RefundFeeBps: 500,
	})
	require.NoError(t, err)
	_, err = UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: secondPlan.Id, Enabled: false, UnitPrice: 60000,
		CodeValidDays: &validDays, RefundFeeBps: 500,
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).
		Where("id = ?", firstPlan.Id).Update("title", "Monthly Current").Error)

	records, err := ListAgentPlanOffers()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, secondPlan.Id, records[0].Offer.PlanId)
	assert.Equal(t, firstPlan.Id, records[1].Offer.PlanId)
	assert.Equal(t, "Monthly Current", records[1].Plan.Title)
}

func TestAgentPlanOfferDisableDoesNotModifySoldOrdersOrCodes(t *testing.T) {
	setupAgentPlanOfferTest(t)
	plan := createAgentOfferPlan(t, "Monthly")
	validDays := 365
	_, err := UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: plan.Id, Enabled: true, UnitPrice: 6000,
		CodeValidDays: &validDays, RefundFeeBps: 500,
	})
	require.NoError(t, err)

	order := model.AgentPurchaseOrder{
		OrderNo: "offer-history-order", AgentUserId: 100, PlanId: plan.Id,
		PlanTitle: plan.Title, Quantity: 1, UnitPrice: 6000, TotalPrice: 6000,
		CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: `{}`,
		IdempotencyKey: "offer-history-key", Status: model.AgentPurchaseOrderStatusCompleted,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	code := model.Redemption{
		Key: "offer-history-code", Type: common.RedemptionCodeTypeSubscription,
		Status: common.RedemptionCodeStatusEnabled, AgentUserId: 100,
		AgentOrderId: order.Id, SubscriptionPlanId: plan.Id,
	}
	require.NoError(t, model.DB.Create(&code).Error)
	beforeOrder := order
	beforeCode := code

	disabled, err := UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: plan.Id, Enabled: false, UnitPrice: 6500,
		CodeValidDays: &validDays, RefundFeeBps: 750,
	})
	require.NoError(t, err)
	assert.False(t, disabled.Enabled)

	require.NoError(t, model.DB.First(&order, order.Id).Error)
	require.NoError(t, model.DB.First(&code, code.Id).Error)
	assert.Equal(t, beforeOrder, order)
	assert.Equal(t, beforeCode, code)
}
