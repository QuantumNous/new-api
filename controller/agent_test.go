package controller

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	kittypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentAccessHistoryAndTopUps(t *testing.T) {
	r, _ := setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 81002).Update("inviter_id", 81001).Error)
	child := model.User{Id: 81003, Username: "grandchild", AffCode: "grand", InviterId: 81002, Status: 1}
	require.NoError(t, model.DB.Create(&child).Error)
	r.GET("/agent/self", AgentSelf)
	r.GET("/agent/customers", AgentCustomers)
	r.GET("/agent/customers/:id/topups", AgentCustomerTopUps)
	r.PUT("/agent/price", AgentPrice)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, httptest.NewRequest("GET", "/agent/customers", nil))
	assert.Equal(t, 403, res.Code)
	profile, err := model.UpdateAgentProfile(81001, 1, 3, true, 0, false)
	require.NoError(t, err)
	assert.EqualValues(t, 1, profile.Version)
	for _, topup := range []model.TopUp{
		{UserId: 81002, Amount: 9999, Money: 12.3, TradeNo: "paid", Status: common.TopUpStatusSuccess, PaymentProvider: "epay", PaymentMethod: "alipay"},
		{UserId: 81002, Money: 50, TradeNo: "unpaid", Status: common.TopUpStatusPending, PaymentProvider: "epay", PaymentMethod: "alipay"},
		{UserId: 81003, Money: 99, TradeNo: "other", Status: common.TopUpStatusSuccess, PaymentProvider: "epay", PaymentMethod: "alipay"},
		{UserId: 81002, Money: 5, TradeNo: "dollars", Status: common.TopUpStatusSuccess, PaymentProvider: "stripe", PaymentMethod: "stripe"},
	} {
		require.NoError(t, model.DB.Create(&topup).Error)
	}
	clients, total, sums, err := model.AgentCustomers(81001, 0, 20)
	require.NoError(t, err)
	require.Len(t, clients, 1)
	assert.EqualValues(t, 1, total)
	assert.Equal(t, 81002, clients[0].ID)
	require.Len(t, sums, 2)
	summary, paying, err := model.AgentTopUpSummary(81001)
	require.NoError(t, err)
	require.Len(t, summary, 2)
	assert.EqualValues(t, 1, paying)
	for _, row := range summary {
		if row.PaymentProvider == "epay" {
			assert.InDelta(t, 12.3, row.Money, 0.0001)
		} else {
			assert.Equal(t, "stripe", row.PaymentProvider)
			assert.Equal(t, 5.0, row.Money)
		}
	}
	res = httptest.NewRecorder()
	r.ServeHTTP(res, httptest.NewRequest("GET", "/agent/customers/81003/topups", nil))
	assert.Equal(t, 404, res.Code)
	res = httptest.NewRecorder()
	r.ServeHTTP(res, httptest.NewRequest("GET", "/agent/customers/81002/topups", nil))
	require.Equal(t, 200, res.Code)
	assert.NotContains(t, res.Body.String(), "unpaid")
	assert.NotContains(t, res.Body.String(), "paid\"")
	for _, cents := range []int{-2, 0, 1, 7, 1000000} {
		_, err = model.UpdateAgentProfile(81001, 81001, cents, true, 1, true)
		assert.ErrorIs(t, err, model.ErrAgentPriceRange)
	}
	_, err = model.UpdateAgentProfile(81001, 81002, 2, true, 1, true)
	assert.ErrorIs(t, err, model.ErrAgentForbidden)
	_, err = model.UpdateAgentProfile(81001, 81001, 2, true, 0, true)
	assert.ErrorIs(t, err, model.ErrAgentConflict)
	_, err = model.UpdateAgentProfile(81001, 1, 3, false, 1, false)
	require.NoError(t, err)
	res = httptest.NewRecorder()
	r.ServeHTTP(res, httptest.NewRequest("GET", "/agent/customers", nil))
	assert.Equal(t, 403, res.Code)
	var role int
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 81001).Select("role").Scan(&role).Error)
	assert.Equal(t, 1, role)
	var changes int64
	require.NoError(t, model.DB.Model(&model.AgentPriceChange{}).Count(&changes).Error)
	assert.EqualValues(t, 2, changes)
}

func TestAgentBatchPriceLockAndAPISettlement(t *testing.T) {
	r, png := setupDrawingTests(t)
	oldRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = oldRate })
	oldGroups := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":4}`))
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroups)) })
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 81002).Update("inviter_id", 81001).Error)
	_, err := model.UpdateAgentProfile(81001, 1, 3, true, 0, false)
	require.NoError(t, err)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		calls.Add(1)
		var input struct {
			N      int    `json:"n"`
			Prompt string `json:"prompt"`
		}
		require.NoError(t, common.DecodeJson(req.Body, &input))
		if strings.Contains(input.Prompt, "fail-and-change-price") {
			_, updateErr := model.UpdateAgentProfile(81001, 81001, 5, true, 2, true)
			require.NoError(t, updateErr)
			w.WriteHeader(400)
			_, _ = w.Write([]byte(`{"error":{"message":"rejected","type":"invalid_request_error"}}`))
			return
		}
		data := []map[string]string{}
		for i := 0; i < input.N; i++ {
			data = append(data, map[string]string{"b64_json": base64.StdEncoding.EncodeToString(png)})
		}
		body, marshalErr := common.Marshal(map[string]any{"data": data})
		require.NoError(t, marshalErr)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	defer upstream.Close()
	service.InitHttpClient()
	channel := model.Channel{Type: 1, Key: "agent-fixture-only", Name: "agent-pricing-test", BaseURL: &upstream.URL, Models: "gpt-image-2", Group: "default", Status: 1}
	require.NoError(t, channel.Insert())
	count := 8
	v1 := int64(1)
	submission := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: "Product", Count: &count, ExpectedAgentPriceVersion: &v1}
	response := submitDrawingTestBatch(t, r, submission, nil, "second")
	require.Equal(t, 202, response.Code, response.Body.String())
	var batch model.DrawingBatch
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &batch))
	_, err = model.UpdateAgentProfile(81001, 81001, 2, true, 1, true)
	require.NoError(t, err)
	v2 := int64(2)
	submission.ExpectedAgentPriceVersion = &v2
	duplicate := submitDrawingTestBatch(t, r, submission, nil, "second")
	require.Equal(t, 202, duplicate.Code, duplicate.Body.String())
	var original model.DrawingBatch
	require.NoError(t, common.Unmarshal(duplicate.Body.Bytes(), &original))
	assert.Equal(t, batch.ID, original.ID, "retrying the same submit after a price change returns the original locked batch")
	for i := 0; i < 8; i++ {
		item, claimErr := model.ClaimDrawingItem(service.DrawingNow(), 4)
		require.NoError(t, claimErr)
		require.NotNil(t, item)
		executeDrawingItem(item)
		assert.Equal(t, "succeeded", item.Status, item.Error)
	}
	user, err := model.GetUserById(81002, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000-120_000, user.Quota, "8 images retain 0.03 CNY each despite group multiplier 4 and subsequent price 0.02")
	response = submitDrawingTestBatch(t, r, drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: "Product", Count: &count, ExpectedAgentPriceVersion: &v1}, nil, "second")
	assert.Equal(t, 409, response.Code)
	assert.EqualValues(t, 8, calls.Load())
	apiToken := model.Token{UserId: 81002, Name: "agent-client-key", Key: strings.Repeat("t", 48), Status: common.TokenStatusEnabled, RemainQuota: 1_000_000, ExpiredTime: -1, Group: "default"}
	require.NoError(t, model.DB.Create(&apiToken).Error)
	api := gin.New()
	api.Use(middleware.BodyStorageCleanup())
	api.POST("/v1/images/generations", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) { Relay(c, kittypes.RelayFormatOpenAIImage) })
	send := func(prompt string, n int) *httptest.ResponseRecorder {
		body := fmt.Sprintf(`{"model":"gpt-image-2","prompt":%q,"n":%d,"size":"1024x1024","price":0,"agent_id":9999}`, prompt, n)
		req := httptest.NewRequest("POST", "/v1/images/generations", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer sk-"+apiToken.Key)
		out := httptest.NewRecorder()
		api.ServeHTTP(out, req)
		return out
	}
	response = send("normal", 3)
	require.Equal(t, 200, response.Code, response.Body.String())
	user, err = model.GetUserById(81002, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000-165_000, user.Quota, "API retains customer-specific 0.03 price and ignores client supplied price and agent")
	response = send("fail-and-change-price", 1)
	assert.Equal(t, 400, response.Code)
	require.Eventually(t, func() bool {
		refundedUser, userErr := model.GetUserById(81002, false)
		var refundedToken model.Token
		tokenErr := model.DB.First(&refundedToken, apiToken.Id).Error
		return userErr == nil && tokenErr == nil && refundedUser.Quota == 10_000_000-165_000 && refundedToken.RemainQuota == 955_000
	}, 2*time.Second, 10*time.Millisecond, "async refund uses reserved 0.03, not the new 0.05 price")
	response = send("after-change", 1)
	require.Equal(t, 200, response.Code, response.Body.String())
	user, err = model.GetUserById(81002, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000-180_000, user.Quota)
}

func TestAgentCannotEscalateOrTargetAnotherAccount(t *testing.T) {
	_, _ = setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.UserSession{}))
	oldSecret := common.SessionSecret
	common.SessionSecret = "agent-permissions-test-secret"
	t.Cleanup(func() { common.SessionSecret = oldSecret })
	_, err := model.UpdateAgentProfile(81001, 1, 3, true, 0, false)
	require.NoError(t, err)
	session, err := service.CreateLoginSession(81001, "password", "127.0.0.1", "agent-test")
	require.NoError(t, err)
	r := gin.New()
	r.PUT("/agent/price", middleware.UserAuth(), AgentPrice)
	r.PUT("/agents/:id", middleware.RootAuth(), AdminAgentProfile)
	request := func(path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("PUT", path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+session.AccessToken)
		out := httptest.NewRecorder()
		r.ServeHTTP(out, req)
		return out
	}
	assert.Equal(t, 403, request("/agents/81002", `{"enabled":true,"price_cents":2,"version":0}`).Code)
	out := request("/agent/price", `{"agent_id":81002,"user_id":81002,"price_cents":2,"version":1}`)
	require.Equal(t, 200, out.Code, out.Body.String())
	own, err := model.GetAgentProfile(81001)
	require.NoError(t, err)
	assert.Equal(t, 2, own.PriceCents)
	other, err := model.GetAgentProfile(81002)
	require.NoError(t, err)
	assert.False(t, other.Enabled)
	assert.Equal(t, 6, other.PriceCents)
}
