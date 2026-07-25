package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func useSubscriptionTermRefundQuotaPerUnit(t *testing.T) {
	t.Helper()
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})
}

func TestGetRefundableSubscriptionTermsReturnsApiSuccessEnvelope(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	useSubscriptionTermRefundQuotaPerUnit(t)
	insertSubscriptionControllerUser(t, 918)
	insertSubscriptionControllerPlan(t, 9918)
	now := common.GetTimestamp()
	contract := model.UserSubscriptionContract{UserId: 918, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: 9918}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 918, PlanId: 9918, TradeNo: "controller-refundable-list", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	term := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: 9918, SegmentIndex: 0, StartTime: now + 3600, EndTime: now + 86400, AllocatedMoney: 3.25, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&term).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 918)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self/refundable-terms", nil)

	GetRefundableSubscriptionTerms(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Equal(t, true, envelope["success"])
	data := envelope["data"].(map[string]any)
	require.Equal(t, float64(325), data["total_refund_quota"])
	require.Equal(t, float64(3.25), data["total_refund_money"])
	items := data["items"].([]any)
	require.Len(t, items, 1)
	item := items[0].(map[string]any)
	require.Equal(t, float64(term.Id), item["term_segment_id"])
	require.Equal(t, model.SubscriptionTermStatusNotStarted, item["status"])
	require.NotContains(t, recorder.Body.String(), "provider_subscription")
	require.NotContains(t, recorder.Body.String(), "price_")
}

func TestRefundSubscriptionTermEndpointReplaysAndRejectsForeignOrActiveTerms(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	useSubscriptionTermRefundQuotaPerUnit(t)
	insertSubscriptionControllerUser(t, 919)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       920,
		Username: "subscription_controller_user_foreign",
		Email:    "subscription-controller-foreign@example.com",
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "subscription_controller_aff_foreign",
	}).Error)
	insertSubscriptionControllerPlan(t, 9919)
	now := common.GetTimestamp()
	contract := model.UserSubscriptionContract{UserId: 919, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: 9919}
	require.NoError(t, model.DB.Create(&contract).Error)
	foreignContract := model.UserSubscriptionContract{UserId: 920, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: 9919}
	require.NoError(t, model.DB.Create(&foreignContract).Error)
	order := model.SubscriptionOrder{UserId: 919, PlanId: 9919, TradeNo: "controller-refundable-post", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	foreignOrder := model.SubscriptionOrder{UserId: 920, PlanId: 9919, TradeNo: "controller-refundable-foreign", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&foreignOrder).Error)
	refundable := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: 9919, SegmentIndex: 0, StartTime: now + 3600, EndTime: now + 86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusNotStarted}
	active := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: 9919, SegmentIndex: 1, StartTime: now - 3600, EndTime: now + 86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusActive}
	foreign := model.SubscriptionTermSegment{ContractId: foreignContract.Id, OrderId: foreignOrder.Id, PlanId: 9919, SegmentIndex: 0, StartTime: now + 3600, EndTime: now + 86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&refundable).Error)
	require.NoError(t, model.DB.Create(&active).Error)
	require.NoError(t, model.DB.Create(&foreign).Error)

	first := performRefundSubscriptionTermRequest(t, 919, refundable.Id)
	second := performRefundSubscriptionTermRequest(t, 919, refundable.Id)
	foreignResponse := performRefundSubscriptionTermRequest(t, 919, foreign.Id)
	activeResponse := performRefundSubscriptionTermRequest(t, 919, active.Id)

	require.Equal(t, true, first["success"])
	require.Equal(t, true, second["success"])
	firstData := first["data"].(map[string]any)
	secondData := second["data"].(map[string]any)
	require.Equal(t, firstData, secondData)
	require.Equal(t, float64(400), firstData["refunded_quota"])
	require.Equal(t, float64(4), firstData["refunded_money"])
	require.Equal(t, model.SubscriptionTermStatusRefunded, firstData["status"])
	require.Equal(t, false, foreignResponse["success"])
	require.Equal(t, false, activeResponse["success"])
	require.Contains(t, activeResponse["message"], "not_started")
}

func performRefundSubscriptionTermRequest(t *testing.T, userID int, termID int64) map[string]any {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userID)
	ctx.Params = gin.Params{{Key: "term_segment_id", Value: strconv.FormatInt(termID, 10)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/refundable-terms/1/refund", nil)

	RefundSubscriptionTerm(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	return envelope
}
