package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

const recallControllerBoundary = int64(1_721_100_000)

type recallControllerStripeFake struct {
	createCoupon        int
	createCustomer      int
	createPromotionCode int
	getCoupon           int
	getPrice            int
}

type recallControllerEmailTranslator struct {
	calls int
}

func (f *recallControllerEmailTranslator) Translate(_ context.Context, stages []service.RecallEmailStage) (map[int]map[string]service.RecallEmailTemplate, error) {
	f.calls++
	result := make(map[int]map[string]service.RecallEmailTemplate, len(stages))
	for _, stage := range stages {
		english := stage.Templates["en"]
		translations := make(map[string]service.RecallEmailTemplate, 7)
		for _, language := range []string{"zh", "es", "fr", "pt", "ru", "ja", "vi"} {
			translations[language] = service.RecallEmailTemplate{
				Subject:  language + ":" + english.Subject,
				BodyText: language + ":" + english.BodyText,
			}
		}
		result[stage.StageNo] = translations
	}
	return result, nil
}

func (f *recallControllerStripeFake) CreateCoupon(_ context.Context, _ *stripe.CouponParams) (*stripe.Coupon, error) {
	f.createCoupon++
	return &stripe.Coupon{ID: "coupon_created", Valid: true, Duration: stripe.CouponDurationOnce}, nil
}

func (f *recallControllerStripeFake) GetCoupon(_ context.Context, id string) (*stripe.Coupon, error) {
	f.getCoupon++
	return &stripe.Coupon{
		ID:         id,
		Valid:      true,
		Duration:   stripe.CouponDurationOnce,
		PercentOff: 20,
		AppliesTo:  &stripe.CouponAppliesTo{Products: []string{"prod_topup"}},
	}, nil
}

func (f *recallControllerStripeFake) CreateCustomer(_ context.Context, _ *stripe.CustomerParams) (*stripe.Customer, error) {
	f.createCustomer++
	return &stripe.Customer{ID: "cus_created"}, nil
}

func (f *recallControllerStripeFake) GetCustomer(_ context.Context, id string) (*stripe.Customer, error) {
	return &stripe.Customer{ID: id}, nil
}

func (f *recallControllerStripeFake) UpdateCustomer(_ context.Context, id string, _ *stripe.CustomerParams) (*stripe.Customer, error) {
	return &stripe.Customer{ID: id}, nil
}

func (f *recallControllerStripeFake) CreatePromotionCode(_ context.Context, _ *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
	f.createPromotionCode++
	return &stripe.PromotionCode{ID: "promo_created"}, nil
}

func (f *recallControllerStripeFake) GetPromotionCode(_ context.Context, id string) (*stripe.PromotionCode, error) {
	return &stripe.PromotionCode{ID: id}, nil
}

func (f *recallControllerStripeFake) GetPrice(_ context.Context, id string) (*stripe.Price, error) {
	f.getPrice++
	return &stripe.Price{
		ID:      id,
		Active:  true,
		Type:    stripe.PriceTypeOneTime,
		Product: &stripe.Product{ID: "prod_topup"},
	}, nil
}

func (f *recallControllerStripeFake) GetCheckoutSession(_ context.Context, id string, _ ...string) (*stripe.CheckoutSession, error) {
	return &stripe.CheckoutSession{ID: id}, nil
}

type recallControllerHarness struct {
	db         *gorm.DB
	runtime    *service.RecallRuntime
	stripe     *recallControllerStripeFake
	translator *recallControllerEmailTranslator
	sendCount  int
}

func setupRecallControllerHarness(t *testing.T) *recallControllerHarness {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/recall-controller.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalCryptoSecret := common.CryptoSecret
	originalTopUpPrices := setting.StripeTopUpPriceIds
	originalPrice := setting.StripePriceId
	originalPrice20 := setting.StripePriceId20
	originalPrice200 := setting.StripePriceId200
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.CryptoSecret = "recall-controller-secret"
	setting.StripeTopUpPriceIds = `{"10":"price_topup"}`
	setting.StripePriceId = ""
	setting.StripePriceId20 = ""
	setting.StripePriceId200 = ""
	require.NoError(t, db.AutoMigrate(
		&model.Option{},
		&model.User{},
		&model.TopUp{},
		&model.SubscriptionOrder{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.Log{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
		&model.RecallEmailQuotaWindow{},
	))

	setRecallControllerEnabled(t, true)
	stripeFake := &recallControllerStripeFake{}
	claims := service.NewRecallClaimService()
	audience := service.NewRecallAudienceSelector()
	translator := &recallControllerEmailTranslator{}
	harness := &recallControllerHarness{db: db, stripe: stripeFake, translator: translator}
	stripeService := service.NewRecallStripeService(stripeFake)
	harness.runtime = &service.RecallRuntime{
		Campaigns:   service.NewRecallCampaignServiceWithTranslator(audience, stripeService, translator),
		Claims:      claims,
		Recipients:  service.NewRecallRecipientWorker(stripeService, claims, "controller-test"),
		Emails:      service.NewRecallEmailWorker(func(_, _, _, _ string) error { harness.sendCount++; return nil }, audience, claims, "controller-test"),
		Attribution: service.NewRecallAttributionService(stripeFake),
	}
	originalProvider := recallRuntimeProvider
	recallRuntimeProvider = func() *service.RecallRuntime { return harness.runtime }
	t.Cleanup(func() {
		recallRuntimeProvider = originalProvider
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.CryptoSecret = originalCryptoSecret
		setting.StripeTopUpPriceIds = originalTopUpPrices
		setting.StripePriceId = originalPrice
		setting.StripePriceId20 = originalPrice20
		setting.StripePriceId200 = originalPrice200
		_ = sqlDB.Close()
	})
	return harness
}

func setRecallControllerEnabled(t *testing.T, enabled bool) {
	t.Helper()
	value := "false"
	if enabled {
		value = "true"
	}
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":            value,
		"recall_campaign_setting.batch_size":         "100",
		"recall_campaign_setting.tick_seconds":       "30",
		"recall_campaign_setting.email_hourly_limit": "100",
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.enabled":            "false",
			"recall_campaign_setting.batch_size":         "100",
			"recall_campaign_setting.tick_seconds":       "30",
			"recall_campaign_setting.email_hourly_limit": "100",
		}))
	})
}

func recallControllerDraft() service.RecallCampaignDraft {
	return service.RecallCampaignDraft{
		Name:             "Controller recall",
		AudienceTemplate: "first_purchase",
		Audience: service.RecallAudienceConfig{
			RegistrationAgeDays:  7,
			MinRequestCount:      1,
			MaxQuota:             100,
			RequireVerifiedEmail: true,
		},
		ExecutionMode:         "manual",
		CouponSource:          "automatic",
		Discount:              service.RecallDiscountConfig{Type: "percent", PercentOff: 20},
		Products:              service.RecallProductScope{TopUpPriceIDs: []string{"price_topup"}},
		PromotionValidSeconds: 7 * 24 * 60 * 60,
		EnrollmentLimit:       100,
		WorkerConcurrency:     2,
		Emails: []service.RecallEmailStage{{
			StageNo:      1,
			DelaySeconds: 0,
			Templates: map[string]service.RecallEmailTemplate{
				"en": {Subject: "Come back", BodyText: "Your Stripe offer is waiting."},
			},
		}},
	}
}

func recallControllerJSON(t *testing.T, value any) []byte {
	t.Helper()
	data, err := common.Marshal(value)
	require.NoError(t, err)
	return data
}

func invokeRecallHandler(t *testing.T, handler gin.HandlerFunc, method string, target string, body []byte, actorID int, params gin.Params) *httptest.ResponseRecorder {
	return invokeRecallHandlerWithRequestID(t, handler, method, target, body, actorID, params, "")
}

func invokeRecallHandlerWithRequestID(t *testing.T, handler gin.HandlerFunc, method string, target string, body []byte, actorID int, params gin.Params, requestID string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, target, bytes.NewReader(body))
	if requestID != "" {
		request = request.WithContext(context.WithValue(request.Context(), common.RequestIdKey, requestID))
	}
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = request
	ctx.Params = params
	if actorID != 0 {
		ctx.Set("id", actorID)
	}
	handler(ctx)
	return recorder
}

func recallControllerAdminEventID(action string, identity string) string {
	digest := sha256.Sum256([]byte(identity))
	return fmt.Sprintf("admin:%s:%x", action, digest)
}

func decodeRecallEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	payload := map[string]any{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func requireRecallFailure(t *testing.T, recorder *httptest.ResponseRecorder, contains string) {
	t.Helper()
	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, false, payload["success"])
	require.Contains(t, payload["message"], contains)
}

func seedRecallControllerCampaign(t *testing.T, harness *recallControllerHarness, status string) *model.RecallCampaign {
	t.Helper()
	campaign, err := harness.runtime.Campaigns.SaveDraft(context.Background(), 7, recallControllerDraft())
	require.NoError(t, err)
	if status != model.RecallCampaignDraft {
		require.NoError(t, harness.db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).UpdateColumns(map[string]any{
			"status":     status,
			"updated_at": recallControllerBoundary,
		}).Error)
		campaign, err = model.GetRecallCampaignByIDWithContext(context.Background(), campaign.Id)
		require.NoError(t, err)
	} else {
		require.NoError(t, harness.db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).UpdateColumn("updated_at", recallControllerBoundary).Error)
		campaign.UpdatedAt = recallControllerBoundary
	}
	return campaign
}

func seedRecallControllerUser(t *testing.T, harness *recallControllerHarness, id int, suffix string) model.User {
	t.Helper()
	user := model.User{
		Id:              id,
		Username:        "recall-" + suffix,
		Password:        "hash",
		DisplayName:     "Recall " + suffix,
		Role:            common.RoleCommonUser,
		Status:          common.UserStatusEnabled,
		Email:           suffix + "@example.com",
		EmailVerifiedAt: time.Now().Add(-time.Hour).Unix(),
		Group:           "plg",
		AffCode:         "aff-" + suffix,
		Quota:           0,
		RequestCount:    10,
		CreatedAt:       time.Now().Add(-30 * 24 * time.Hour).Unix(),
	}
	require.NoError(t, harness.db.Create(&user).Error)
	return user
}

const recallControllerEmailPreviewHTML = `<!doctype html><html><body>
<p>Hello {{.RecipientName}}</p>
<p>{{.PromotionCodeMasked}} - {{.ProductSummary}} - {{.ExpiresAt}}</p>
<p><a href="{{.ClaimURL}}">Claim offer</a></p>
<p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></p>
</body></html>`

func countRecallControllerRows[T any](t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var count int64
	require.NoError(t, db.Model(new(T)).Count(&count).Error)
	return count
}

func TestRecallCampaignEmailPreviewRendersUnsavedTemplateWithoutPersistence(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	beforeCampaigns := countRecallControllerRows[model.RecallCampaign](t, harness.db)
	beforeMessages := countRecallControllerRows[model.RecallMessage](t, harness.db)
	body := recallControllerJSON(t, service.RecallEmailPreviewRequest{
		Template: service.RecallEmailTemplate{
			Subject:  "Preview subject",
			BodyHTML: recallControllerEmailPreviewHTML,
		},
	})

	recorder := invokeRecallHandler(t, PreviewRecallEmailTemplate, http.MethodPost, "/", body, 0, nil)

	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, true, payload["success"])
	data := payload["data"].(map[string]any)
	require.Equal(t, "Preview subject", data["subject"])
	bodyHTML := data["body_html"].(string)
	require.Contains(t, bodyHTML, "Ada")
	require.Contains(t, bodyHTML, "SAVE****25")
	require.Contains(t, bodyHTML, "Top-ups: 50 USD, 10 USD; Subscriptions: Pro monthly (20 USD)")
	require.NotContains(t, bodyHTML, "price_")
	require.Contains(t, bodyHTML, time.Unix(1_900_000_000, 0).UTC().Format("2006-01-02 15:04 UTC"))
	require.Contains(t, bodyHTML, `href="https://flatkey.ai/recall/claim?preview=1"`)
	require.Contains(t, bodyHTML, `href="https://flatkey.ai/recall/unsubscribe?preview=1"`)
	require.Equal(t, beforeCampaigns, countRecallControllerRows[model.RecallCampaign](t, harness.db))
	require.Equal(t, beforeMessages, countRecallControllerRows[model.RecallMessage](t, harness.db))
}

func TestListRecallAudienceUsersSearchesByKeywordWithBounds(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	users := []model.User{
		{Id: 101, Username: "ada-keyword", Password: "hash", DisplayName: "Ada Lovelace", Email: "first@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-101"},
		{Id: 102, Username: "display-hit", Password: "hash", DisplayName: "Grace Ada", Email: "second@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-102"},
		{Id: 103, Username: "email-hit", Password: "hash", DisplayName: "Email Match", Email: "ada-email@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-103"},
		{Id: 104, Username: "no-match", Password: "hash", DisplayName: "No Match", Email: "none@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-104"},
	}
	for id := 105; id < 165; id++ {
		users = append(users, model.User{
			Id: id, Username: fmt.Sprintf("ada-extra-%03d", id), Password: "hash", DisplayName: "Extra Match", Email: fmt.Sprintf("extra-%03d@example.com", id),
			Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: fmt.Sprintf("aud-%03d", id),
		})
	}
	require.NoError(t, harness.db.Create(&users).Error)

	recorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword=%20ada%20&page_size=2", nil, 7, nil)

	options := decodeRecallAudienceUserOptions(t, recorder)
	require.Equal(t, []int{101, 102}, recallAudienceOptionIDs(options))

	defaultRecorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword=a", nil, 7, nil)
	require.Len(t, decodeRecallAudienceUserOptions(t, defaultRecorder), 20)

	cappedRecorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword=a&page_size=500", nil, 7, nil)
	require.Len(t, decodeRecallAudienceUserOptions(t, cappedRecorder), 50)

	invalidRecorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword=a&page_size=0", nil, 7, nil)
	requireRecallFailure(t, invalidRecorder, "page_size")
}

func TestListRecallAudienceUsersLimitsTrimmedKeywordTo128Runes(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	exactLimitKeyword := strings.Repeat("界", 128)
	require.NoError(t, harness.db.Create(&model.User{
		Id: 171, Username: "keyword-limit-user", Password: "hash", DisplayName: exactLimitKeyword, Email: "keyword-limit@example.com",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-171",
	}).Error)

	exactLimit := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword="+url.QueryEscape("  "+exactLimitKeyword+"  "), nil, 7, nil)
	require.Equal(t, []int{171}, recallAudienceOptionIDs(decodeRecallAudienceUserOptions(t, exactLimit)))

	overLimitKeyword := strings.Repeat("界", 129)
	overLimit := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword="+url.QueryEscape(overLimitKeyword), nil, 7, nil)
	requireRecallFailure(t, overLimit, "keyword")
	requireRecallFailure(t, overLimit, "128")
}

func TestListRecallAudienceUsersEscapesKeywordWildcardsAsLiterals(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	users := []model.User{
		{Id: 181, Username: "percent-user", Password: "hash", DisplayName: "Literal 100% User", Email: "percent@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-181"},
		{Id: 182, Username: "underscore_user", Password: "hash", DisplayName: "Literal Underscore User", Email: "underscore@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-182"},
		{Id: 183, Username: "bang-user", Password: "hash", DisplayName: "Literal Bang! User", Email: "bang@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-183"},
		{Id: 184, Username: "plain-user", Password: "hash", DisplayName: "Plain Wildcard Decoy", Email: "plain@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-184"},
	}
	require.NoError(t, harness.db.Create(&users).Error)

	for _, test := range []struct {
		name    string
		keyword string
		wantIDs []int
	}{
		{name: "percent", keyword: "%", wantIDs: []int{181}},
		{name: "underscore", keyword: "_", wantIDs: []int{182}},
		{name: "bang", keyword: "!", wantIDs: []int{183}},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?keyword="+url.QueryEscape(test.keyword), nil, 7, nil)
			require.Equal(t, test.wantIDs, recallAudienceOptionIDs(decodeRecallAudienceUserOptions(t, recorder)))
		})
	}
}

func TestListRecallAudienceUsersResolvesIDsSafely(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	users := []model.User{
		{Id: 201, Username: "enabled-user", Password: "hash", DisplayName: "Enabled User", Email: "enabled@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-201"},
		{Id: 202, Username: "disabled-user", Password: "hash", DisplayName: "Disabled User", Email: "disabled@example.com", Status: common.UserStatusDisabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-202"},
	}
	require.NoError(t, harness.db.Create(&users).Error)

	recorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?ids=202,%20201,202,999", nil, 7, nil)

	options := decodeRecallAudienceUserOptions(t, recorder)
	require.Equal(t, []int{201, 202}, recallAudienceOptionIDs(options))
	require.Equal(t, common.UserStatusDisabled, int(options[1]["status"].(float64)))
	require.Equal(t, "disabled@example.com", options[1]["email"])
}

func TestListRecallAudienceUsersRejectsUnsafeInputAndEmptyRequestDoesNotEnumerate(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	require.NoError(t, harness.db.Create(&[]model.User{
		{Id: 301, Username: "seed-one", Password: "hash", DisplayName: "Seed One", Email: "one@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-301"},
		{Id: 302, Username: "seed-two", Password: "hash", DisplayName: "Seed Two", Email: "two@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "plg", AffCode: "aud-302"},
	}).Error)

	empty := decodeRecallAudienceUserOptions(t, invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/", nil, 7, nil))
	require.Empty(t, empty)

	for _, target := range []string{
		"/?ids=abc",
		"/?ids=0",
		"/?ids=-1",
		"/?ids=" + strings.TrimRight(strings.Repeat("1,", 501), ","),
		"/?ids=301&keyword=seed",
	} {
		recorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, target, nil, 7, nil)
		requireRecallFailure(t, recorder, "audience")
	}
}

func TestListRecallAudienceUsersResponseOnlyExposesOptionFields(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	require.NoError(t, harness.db.Create(&model.User{
		Id: 401, Username: "shape-user", Password: "secret-password", DisplayName: "Shape User", Email: "shape@example.com",
		Status: common.UserStatusEnabled, Role: common.RoleAdminUser, Group: "default", Quota: 1000, RequestCount: 77,
		StripeCustomer: "cus_secret", StripeCardBound: true, AffCode: "aud-401",
	}).Error)

	recorder := invokeRecallHandler(t, ListRecallAudienceUsers, http.MethodGet, "/?ids=401", nil, 7, nil)

	rawOptions := decodeRecallAudienceRawOptions(t, recorder)
	require.Len(t, rawOptions, 1)
	require.ElementsMatch(t, []string{"id", "username", "display_name", "email", "status"}, recallAudienceOptionKeys(rawOptions[0]))
}

func decodeRecallAudienceRawOptions(t *testing.T, recorder *httptest.ResponseRecorder) []map[string]json.RawMessage {
	t.Helper()
	var payload struct {
		Success bool                         `json:"success"`
		Message string                       `json:"message"`
		Data    []map[string]json.RawMessage `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	return payload.Data
}

func decodeRecallAudienceUserOptions(t *testing.T, recorder *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var payload struct {
		Success bool             `json:"success"`
		Message string           `json:"message"`
		Data    []map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	return payload.Data
}

func recallAudienceOptionIDs(options []map[string]any) []int {
	ids := make([]int, 0, len(options))
	for _, option := range options {
		ids = append(ids, int(option["id"].(float64)))
	}
	return ids
}

func recallAudienceOptionKeys(option map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(option))
	for key := range option {
		keys = append(keys, key)
	}
	return keys
}

func TestRecallCampaignEmailPreviewRejectsInvalidHTMLWithoutPersistence(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	beforeCampaigns := countRecallControllerRows[model.RecallCampaign](t, harness.db)
	beforeMessages := countRecallControllerRows[model.RecallMessage](t, harness.db)
	body := recallControllerJSON(t, service.RecallEmailPreviewRequest{
		Template: service.RecallEmailTemplate{
			Subject:  "Preview subject",
			BodyHTML: `<html><body><script>alert(1)</script></body></html>`,
		},
	})

	recorder := invokeRecallHandler(t, PreviewRecallEmailTemplate, http.MethodPost, "/", body, 0, nil)

	requireRecallFailure(t, recorder, "body_html")
	require.Equal(t, beforeCampaigns, countRecallControllerRows[model.RecallCampaign](t, harness.db))
	require.Equal(t, beforeMessages, countRecallControllerRows[model.RecallMessage](t, harness.db))
}

func TestRecallCampaignDisabledAllowsConfigurationHandlers(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignDraft)
	setRecallControllerEnabled(t, false)
	body := recallControllerJSON(t, recallControllerDraft())

	tests := []struct {
		name    string
		handler gin.HandlerFunc
		method  string
		body    []byte
		params  gin.Params
	}{
		{name: "create", handler: CreateRecallCampaign, method: http.MethodPost, body: body},
		{name: "update", handler: UpdateRecallCampaign, method: http.MethodPut, body: body, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "preview", handler: PreviewRecallCampaign, method: http.MethodPost, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "stripe validate", handler: ValidateRecallStripeConfig, method: http.MethodPost, body: body},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := invokeRecallHandler(t, tt.handler, tt.method, "/", tt.body, 7, tt.params)
			require.Equal(t, true, decodeRecallEnvelope(t, recorder)["success"])
		})
	}
	require.Zero(t, harness.stripe.createCoupon)
	require.Zero(t, harness.stripe.createCustomer)
	require.Zero(t, harness.stripe.createPromotionCode)
}

func TestRecallCampaignDisabledRejectsExecutionAndWorkerAffectingHandlers(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignDraft)
	setRecallControllerEnabled(t, false)

	tests := []struct {
		name    string
		handler gin.HandlerFunc
		params  gin.Params
	}{
		{name: "activate", handler: ActivateRecallCampaign, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "pause", handler: PauseRecallCampaign, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "resume", handler: ResumeRecallCampaign, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "cancel", handler: CancelRecallCampaign, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "complete", handler: CompleteRecallCampaign, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}},
		{name: "retry", handler: RetryRecallRecipient, params: gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}, {Key: "rid", Value: "1"}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := invokeRecallHandler(t, tt.handler, http.MethodPost, "/", []byte(`{}`), 7, tt.params)
			requireRecallFailure(t, recorder, service.ErrRecallDisabled.Error())
		})
	}
	require.Zero(t, harness.stripe.createCoupon)
	require.Zero(t, harness.stripe.createCustomer)
	require.Zero(t, harness.stripe.createPromotionCode)
}

func TestRecallCampaignCreateAndUpdateRequireJSONAndAdminActor(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	validBody := recallControllerJSON(t, recallControllerDraft())

	for _, tt := range []struct {
		name    string
		handler gin.HandlerFunc
		method  string
		params  gin.Params
	}{
		{name: "create", handler: CreateRecallCampaign, method: http.MethodPost},
		{name: "update", handler: UpdateRecallCampaign, method: http.MethodPut, params: gin.Params{{Key: "id", Value: "1"}}},
	} {
		t.Run(tt.name+" invalid json", func(t *testing.T) {
			recorder := invokeRecallHandler(t, tt.handler, tt.method, "/", []byte(`{"name":`), 7, tt.params)
			requireRecallFailure(t, recorder, "unexpected EOF")
		})
		t.Run(tt.name+" missing actor", func(t *testing.T) {
			recorder := invokeRecallHandler(t, tt.handler, tt.method, "/", validBody, 0, tt.params)
			requireRecallFailure(t, recorder, "actor")
		})
	}

	created := invokeRecallHandler(t, CreateRecallCampaign, http.MethodPost, "/", validBody, 7, nil)
	require.Equal(t, true, decodeRecallEnvelope(t, created)["success"])
	var campaign model.RecallCampaign
	require.NoError(t, harness.db.Order("id DESC").First(&campaign).Error)
	draft := recallControllerDraft()
	draft.Name = "Updated controller recall"
	updated := invokeRecallHandler(t, UpdateRecallCampaign, http.MethodPut, "/", recallControllerJSON(t, draft), 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}})
	require.Equal(t, true, decodeRecallEnvelope(t, updated)["success"])
	require.NoError(t, harness.db.First(&campaign, campaign.Id).Error)
	require.Equal(t, draft.Name, campaign.Name)
}

func TestRecallEmailGenerationHandlerUpdatesAllTranslations(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignDraft)
	detail, err := harness.runtime.Campaigns.GetDetail(context.Background(), campaign.Id)
	require.NoError(t, err)
	detail.Draft.Emails[0].Templates["en"] = service.RecallEmailTemplate{Subject: "Generated English", BodyText: "Generated body"}
	beforeCalls := harness.translator.calls
	body := recallControllerJSON(t, service.RecallEmailGenerationRequest{
		ConfigRevision: campaign.ConfigRevision,
		Name:           campaign.Name,
		Emails:         detail.Draft.Emails,
	})

	recorder := invokeRecallHandler(t, GenerateRecallEmailTranslations, http.MethodPost, "/", body, 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}})

	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, true, payload["success"])
	require.Equal(t, beforeCalls+1, harness.translator.calls)
	data := payload["data"].(map[string]any)
	require.Equal(t, float64(campaign.ConfigRevision+1), data["config_revision"])
	emails := data["email_sequence"].([]any)
	templates := emails[0].(map[string]any)["templates"].(map[string]any)
	require.Equal(t, "fr:Generated English", templates["fr"].(map[string]any)["subject"])
}

func TestRecallEmailGenerationActivationReturnsStructuredBlockers(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	draft := recallControllerDraft()
	draft.DeferLocalization = true
	campaign, err := harness.runtime.Campaigns.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	recorder := invokeRecallHandler(t, ActivateRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}})

	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, false, payload["success"])
	data := payload["data"].(map[string]any)
	blockers := data["blockers"].([]any)
	require.NotEmpty(t, blockers)
	first := blockers[0].(map[string]any)
	require.Equal(t, float64(1), first["stage_no"])
	require.Equal(t, "zh", first["locale"])
	require.Equal(t, "missing", first["reason"])
}

func TestRecallEmailQuotaStatusRouteReturnsActivityOnlyWindow(t *testing.T) {
	setupRecallControllerHarness(t)
	_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 100)
	require.NoError(t, err)
	require.True(t, reserved)
	_, reserved, err = model.ReserveRecallEmailQuotaWithContext(context.Background(), 100)
	require.NoError(t, err)
	require.True(t, reserved)

	recorder := invokeRecallHandler(t, GetRecallEmailQuotaStatus, http.MethodGet, "/", nil, 7, nil)

	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, true, payload["success"])
	data := payload["data"].(map[string]any)
	require.Equal(t, float64(100), data["limit"])
	require.Equal(t, float64(2), data["used"])
	require.Equal(t, float64(98), data["remaining"])
	require.Equal(t, false, data["exhausted"])
	require.NotZero(t, data["window_started_at"])
	require.NotZero(t, data["resets_at"])
	require.Len(t, data, 6)
}

func TestUpdateRecallEmailQuotaLimitPersistsActivityScopedSetting(t *testing.T) {
	setupRecallControllerHarness(t)
	common.OptionMapRWMutex.Lock()
	previousOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
	})
	body := recallControllerJSON(t, map[string]any{"limit": 250})

	recorder := invokeRecallHandler(t, UpdateRecallEmailQuotaLimit, http.MethodPut, "/", body, 7, nil)

	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, true, payload["success"])
	data := payload["data"].(map[string]any)
	require.Equal(t, float64(250), data["limit"])
	require.Equal(t, 250, operation_setting.GetRecallCampaignSetting().EmailHourlyLimit)
	var option model.Option
	require.NoError(t, model.DB.Where("key = ?", "recall_campaign_setting.email_hourly_limit").First(&option).Error)
	require.Equal(t, "250", option.Value)
}

func TestRecallCampaignPreviewReturnsAudienceAndStripeWithoutCreateOrSend(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignDraft)
	seedRecallControllerUser(t, harness, 41, "preview")

	recorder := invokeRecallHandler(t, PreviewRecallCampaign, http.MethodPost, "/?sample_size=5", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}})
	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, true, payload["success"])
	data := payload["data"].(map[string]any)
	require.Equal(t, float64(1), data["eligible_total"])
	require.Len(t, data["sample"], 1)
	require.NotNil(t, data["exclusions"])
	stripePreview := data["stripe"].(map[string]any)
	require.Equal(t, []any{"price_topup"}, stripePreview["topup_price_ids"])
	require.Equal(t, []any{}, stripePreview["subscription_price_ids"])
	require.Equal(t, float64(1), float64(harness.stripe.getPrice))
	require.Zero(t, harness.stripe.createCoupon)
	require.Zero(t, harness.stripe.createCustomer)
	require.Zero(t, harness.stripe.createPromotionCode)
	require.Zero(t, harness.sendCount)
}

func TestRecallCampaignReadsMaskCodesAndOmitClaimAndTemplateSecrets(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	seedRecallControllerUser(t, harness, 42, "masked")
	promotionID := "promo_secret_id"
	claimHash := "claim-hash-secret"
	recipient := model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                42,
		EligibilitySnapshot:   `{"qualified":true}`,
		EmailSnapshot:         "masked@example.com",
		LanguageSnapshot:      "en",
		State:                 model.RecallRecipientContacting,
		StripeCustomerId:      "cus_masked",
		StripePromotionCodeId: &promotionID,
		PromotionCode:         "ABCDSECRETXYZ",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		ClaimTokenHash:        &claimHash,
	}
	require.NoError(t, harness.db.Create(&recipient).Error)
	leaseExpiresAt := time.Now().Add(-time.Minute).Unix()
	require.NoError(t, harness.db.Create(&model.RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateVersion:  3,
		TemplateSnapshot: "template-body-secret",
		ScheduledAt:      time.Now().Unix(),
		State:            model.RecallMessageSending,
		LeaseOwner:       "crashed-sender",
		LeaseExpiresAt:   leaseExpiresAt,
		ClaimTokenHash:   &claimHash,
	}).Error)

	responses := []*httptest.ResponseRecorder{
		invokeRecallHandler(t, ListRecallCampaigns, http.MethodGet, "/?p=1&page_size=10", nil, 7, nil),
		invokeRecallHandler(t, GetRecallCampaign, http.MethodGet, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}),
		invokeRecallHandler(t, ListRecallRecipients, http.MethodGet, "/?p=1&page_size=10", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}}),
	}
	for _, response := range responses {
		require.Equal(t, true, decodeRecallEnvelope(t, response)["success"])
		require.NotContains(t, response.Body.String(), "ABCDSECRETXYZ")
		require.NotContains(t, response.Body.String(), claimHash)
		require.NotContains(t, response.Body.String(), "template-body-secret")
		require.NotContains(t, response.Body.String(), `"eligibility_snapshot"`)
		require.NotContains(t, response.Body.String(), `"email_snapshot"`)
		require.NotContains(t, response.Body.String(), `{"qualified":true}`)
		require.NotContains(t, response.Body.String(), "masked@example.com")
	}
	require.Contains(t, responses[2].Body.String(), model.MaskPromotionCode(recipient.PromotionCode))
	require.Contains(t, responses[2].Body.String(), `"state":"sending"`)
	require.Contains(t, responses[2].Body.String(), fmt.Sprintf(`"lease_expires_at":%d`, leaseExpiresAt))
	require.NotContains(t, responses[2].Body.String(), "crashed-sender")
}

func TestRecallCampaignListNormalizesAndBoundsHTTPPagination(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaigns := make([]model.RecallCampaign, 101)
	for i := range campaigns {
		campaigns[i] = model.RecallCampaign{
			Name:                "bounded campaign",
			Status:              model.RecallCampaignDraft,
			AudienceTemplate:    "first_purchase",
			AudienceConfig:      `{}`,
			ExecutionMode:       "manual",
			CouponSource:        "automatic",
			DiscountConfig:      `{}`,
			ProductScope:        `{}`,
			EmailSequenceConfig: `[]`,
		}
	}
	require.NoError(t, harness.db.Create(&campaigns).Error)

	for _, test := range []struct {
		name         string
		query        string
		wantPage     float64
		wantPageSize float64
		wantItems    int
	}{
		{name: "negative", query: "?p=-9&page_size=-4", wantPage: 1, wantPageSize: float64(common.ItemsPerPage), wantItems: common.ItemsPerPage},
		{name: "zero", query: "?p=0&page_size=0", wantPage: 1, wantPageSize: float64(common.ItemsPerPage), wantItems: common.ItemsPerPage},
		{name: "oversize", query: "?p=1&page_size=1000", wantPage: 1, wantPageSize: 100, wantItems: 100},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := invokeRecallHandler(t, ListRecallCampaigns, http.MethodGet, "/"+test.query, nil, 7, nil)
			payload := decodeRecallEnvelope(t, recorder)
			require.Equal(t, true, payload["success"])
			page := payload["data"].(map[string]any)
			require.Equal(t, test.wantPage, page["page"])
			require.Equal(t, test.wantPageSize, page["page_size"])
			require.Len(t, page["items"], test.wantItems)
		})
	}
}

func TestRecallClaimUsesAuthenticatedUserAndRejectsAnotherUser(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	seedRecallControllerUser(t, harness, 51, "claim-owner")
	seedRecallControllerUser(t, harness, 52, "claim-other")
	claim := "signed-claim-value"
	digest := sha256.Sum256([]byte(claim))
	claimHash := fmt.Sprintf("%x", digest[:])
	promotionID := "promo_claim"
	recipient := model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                51,
		EligibilitySnapshot:   `{}`,
		EmailSnapshot:         "claim-owner@example.com",
		LanguageSnapshot:      "en",
		State:                 model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID,
		PromotionCode:         "CLAIMSECRET99",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		ClaimTokenHash:        &claimHash,
	}
	require.NoError(t, harness.db.Create(&recipient).Error)
	body := recallControllerJSON(t, recallClaimRequest{Claim: claim, PriceID: "price_topup", PurchaseKind: service.RecallPurchaseKindTopUp})

	wrong := invokeRecallHandler(t, ValidateRecallClaim, http.MethodPost, "/", body, 52, nil)
	requireRecallFailure(t, wrong, service.ErrRecallClaimWrongUser.Error())
	correct := invokeRecallHandler(t, ValidateRecallClaim, http.MethodPost, "/", body, 51, nil)
	payload := decodeRecallEnvelope(t, correct)
	require.Equal(t, true, payload["success"])
	require.NotContains(t, correct.Body.String(), claim)
	require.NotContains(t, correct.Body.String(), claimHash)
	require.NotContains(t, correct.Body.String(), "CLAIMSECRET99")
}

func TestListRecallOffersReturnsCurrentUserSafeFieldsAndNoStore(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	owner := seedRecallControllerUser(t, harness, 101, "offer-owner")
	other := seedRecallControllerUser(t, harness, 102, "offer-other")
	ownerPromotionID := "promo_owner_secret"
	otherPromotionID := "promo_other_secret"
	ownerClaimHash := strings.Repeat("a", 64)
	ownerRecipient := model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                owner.Id,
		EligibilitySnapshot:   `{"secret":"eligibility"}`,
		EmailSnapshot:         owner.Email,
		LanguageSnapshot:      "en",
		State:                 model.RecallRecipientContacting,
		StripeCustomerId:      "cus_owner_secret",
		StripePromotionCodeId: &ownerPromotionID,
		PromotionCode:         "OWNERSECRET99",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		PromotionIssuedAt:     recallControllerBoundary + 20,
		ClaimTokenHash:        &ownerClaimHash,
	}
	otherRecipient := model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                other.Id,
		EligibilitySnapshot:   `{"secret":"other"}`,
		EmailSnapshot:         other.Email,
		LanguageSnapshot:      "en",
		State:                 model.RecallRecipientContacting,
		StripeCustomerId:      "cus_other_secret",
		StripePromotionCodeId: &otherPromotionID,
		PromotionCode:         "OTHERSECRET99",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		PromotionIssuedAt:     recallControllerBoundary + 10,
	}
	require.NoError(t, harness.db.Create(&[]model.RecallRecipient{ownerRecipient, otherRecipient}).Error)

	recorder := invokeRecallHandler(t, ListRecallOffers, http.MethodGet, "/", nil, owner.Id, nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, true, payload["success"])
	offers := payload["data"].([]any)
	require.Len(t, offers, 1)
	offer := offers[0].(map[string]any)
	require.Equal(t, float64(campaign.Id), offer["campaign_id"])
	require.Equal(t, campaign.Name, offer["campaign_name"])
	require.Equal(t, model.MaskPromotionCode("OWNERSECRET99"), offer["promotion_code_masked"])
	require.NotContains(t, recorder.Body.String(), "promo_owner_secret")
	require.NotContains(t, recorder.Body.String(), "OWNERSECRET99")
	require.NotContains(t, recorder.Body.String(), ownerClaimHash)
	require.NotContains(t, strings.ToLower(recorder.Body.String()), "claim_token")
	require.NotContains(t, strings.ToLower(recorder.Body.String()), "claim_token_hash")
	require.NotContains(t, strings.ToLower(recorder.Body.String()), "promotion_code_id")
	require.NotContains(t, strings.ToLower(recorder.Body.String()), "stripe_promotion")
	require.NotContains(t, recorder.Body.String(), "cus_owner_secret")
	require.NotContains(t, recorder.Body.String(), owner.Email)
	require.NotContains(t, recorder.Body.String(), "eligibility")
	require.NotContains(t, recorder.Body.String(), "promo_other_secret")
	require.NotContains(t, recorder.Body.String(), "OTHERSECRET99")
	require.NotContains(t, recorder.Body.String(), other.Email)
}

func TestListRecallOffersReturnsEmptyArrayWhenDisabledOrNoCandidates(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	user := seedRecallControllerUser(t, harness, 103, "offer-empty")

	noCandidates := invokeRecallHandler(t, ListRecallOffers, http.MethodGet, "/", nil, user.Id, nil)
	require.Equal(t, http.StatusOK, noCandidates.Code)
	require.Equal(t, "no-store", noCandidates.Header().Get("Cache-Control"))
	payload := decodeRecallEnvelope(t, noCandidates)
	require.Equal(t, true, payload["success"])
	require.Empty(t, payload["data"].([]any))
	require.Contains(t, noCandidates.Body.String(), `"data":[]`)

	setRecallControllerEnabled(t, false)
	disabled := invokeRecallHandler(t, ListRecallOffers, http.MethodGet, "/", nil, user.Id, nil)
	require.Equal(t, http.StatusOK, disabled.Code)
	require.Equal(t, "no-store", disabled.Header().Get("Cache-Control"))
	payload = decodeRecallEnvelope(t, disabled)
	require.Equal(t, true, payload["success"])
	require.Empty(t, payload["data"].([]any))
	require.Contains(t, disabled.Body.String(), `"data":[]`)
}

func TestListRecallOffersReturnsApiErrorWithoutPartialCandidatesOnDBError(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	user := seedRecallControllerUser(t, harness, 104, "offer-error")
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	rawProducts, err := common.Marshal(service.RecallProductScope{SubscriptionPriceIDs: []string{"price_plan_error"}})
	require.NoError(t, err)
	require.NoError(t, harness.db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("product_scope", string(rawProducts)).Error)
	promotionID := "promo_error_secret"
	claimHash := strings.Repeat("b", 64)
	recipient := model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                user.Id,
		EligibilitySnapshot:   `{}`,
		EmailSnapshot:         user.Email,
		LanguageSnapshot:      "en",
		State:                 model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID,
		PromotionCode:         "ERRORSECRET99",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		ClaimTokenHash:        &claimHash,
	}
	require.NoError(t, harness.db.Create(&recipient).Error)
	require.NoError(t, harness.db.Migrator().DropTable(&model.SubscriptionPlan{}))

	recorder := invokeRecallHandler(t, ListRecallOffers, http.MethodGet, "/", nil, user.Id, nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	payload := decodeRecallEnvelope(t, recorder)
	require.Equal(t, false, payload["success"])
	require.NotContains(t, recorder.Body.String(), "ERRORSECRET99")
	require.NotContains(t, recorder.Body.String(), promotionID)
	require.NotContains(t, recorder.Body.String(), claimHash)
	require.NotContains(t, recorder.Body.String(), model.MaskPromotionCode("ERRORSECRET99"))
	require.NotContains(t, strings.ToLower(recorder.Body.String()), `"data"`)
}

func TestRecallUnsubscribeRequiresSignedTokenAndImmediatelySuppressesMail(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	user := seedRecallControllerUser(t, harness, 61, "unsubscribe")
	recipient := model.RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              user.Id,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       user.Email,
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientContacting,
	}
	require.NoError(t, harness.db.Create(&recipient).Error)
	message := model.RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateSnapshot: "secret-template",
		ScheduledAt:      time.Now().Add(time.Minute).Unix(),
		State:            model.RecallMessageScheduled,
	}
	require.NoError(t, harness.db.Create(&message).Error)

	invalid := invokeRecallHandler(t, UnsubscribeRecallEmail, http.MethodGet, "/api/recall/unsubscribe?token=invalid", nil, 0, nil)
	require.Equal(t, http.StatusBadRequest, invalid.Code)
	require.NotContains(t, invalid.Body.String(), user.Email)

	token, err := harness.runtime.Claims.CreateUnsubscribeToken(user.Id, time.Now().Add(time.Hour))
	require.NoError(t, err)
	valid := invokeRecallHandler(t, UnsubscribeRecallEmail, http.MethodGet, "/api/recall/unsubscribe?token="+token, nil, 0, nil)
	require.Equal(t, http.StatusOK, valid.Code)
	require.NotContains(t, valid.Body.String(), user.Email)
	require.NotContains(t, valid.Body.String(), token)
	require.NoError(t, harness.db.First(&user, user.Id).Error)
	require.True(t, user.GetSetting().RecallMarketingOptOut)
	require.NoError(t, harness.db.First(&message, message.Id).Error)
	require.Equal(t, model.RecallMessageCancelled, message.State)
	require.Equal(t, "user_opted_out", message.LastErrorCode)
}

func TestRecallRetryAcceptsFailedWorkAndRequiresAcknowledgementForUncertainMail(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	seedRecallControllerUser(t, harness, 71, "retry-recipient")
	seedRecallControllerUser(t, harness, 72, "retry-message")
	seedRecallControllerUser(t, harness, 73, "retry-uncertain")
	seedRecallControllerUser(t, harness, 74, "retry-active")
	seedRecallControllerUser(t, harness, 75, "retry-expired-sending")
	seedRecallControllerUser(t, harness, 76, "retry-live-sending")

	failedRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 71, EligibilitySnapshot: `{}`, EmailSnapshot: "retry-recipient@example.com", LanguageSnapshot: "en", State: model.RecallRecipientFailed, LastErrorCode: "stripe_permanent", UpdatedAt: recallControllerBoundary}
	failedMessageRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 72, EligibilitySnapshot: `{}`, EmailSnapshot: "retry-message@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	uncertainRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 73, EligibilitySnapshot: `{}`, EmailSnapshot: "retry-uncertain@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	activeRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 74, EligibilitySnapshot: `{}`, EmailSnapshot: "retry-active@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	expiredSendingRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 75, EligibilitySnapshot: `{}`, EmailSnapshot: "retry-expired-sending@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	liveSendingRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 76, EligibilitySnapshot: `{}`, EmailSnapshot: "retry-live-sending@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, harness.db.Create(&failedRecipient).Error)
	require.NoError(t, harness.db.Create(&failedMessageRecipient).Error)
	require.NoError(t, harness.db.Create(&uncertainRecipient).Error)
	require.NoError(t, harness.db.Create(&activeRecipient).Error)
	require.NoError(t, harness.db.Create(&expiredSendingRecipient).Error)
	require.NoError(t, harness.db.Create(&liveSendingRecipient).Error)
	failedMessage := model.RecallMessage{RecipientId: failedMessageRecipient.Id, StageNo: 1, TemplateSnapshot: "failed-template", State: model.RecallMessageFailed, AttemptCount: 2, FailedAt: recallControllerBoundary, UpdatedAt: recallControllerBoundary}
	uncertainMessage := model.RecallMessage{RecipientId: uncertainRecipient.Id, StageNo: 1, TemplateSnapshot: "uncertain-template", State: model.RecallMessageUncertain, AttemptCount: 1, FailedAt: recallControllerBoundary + 1, UpdatedAt: recallControllerBoundary + 1}
	expiredSendingMessage := model.RecallMessage{RecipientId: expiredSendingRecipient.Id, StageNo: 1, TemplateVersion: 6, TemplateSnapshot: "expired-sending-template", State: model.RecallMessageSending, AttemptCount: 1, LeaseOwner: "crashed", LeaseExpiresAt: 1, UpdatedAt: recallControllerBoundary + 2}
	liveSendingMessage := model.RecallMessage{RecipientId: liveSendingRecipient.Id, StageNo: 1, TemplateVersion: 7, TemplateSnapshot: "live-sending-template", State: model.RecallMessageSending, AttemptCount: 1, LeaseOwner: "live", LeaseExpiresAt: 9_999_999_999, UpdatedAt: recallControllerBoundary + 3}
	require.NoError(t, harness.db.Create(&failedMessage).Error)
	require.NoError(t, harness.db.Create(&uncertainMessage).Error)
	require.NoError(t, harness.db.Create(&expiredSendingMessage).Error)
	require.NoError(t, harness.db.Create(&liveSendingMessage).Error)

	retry := func(recipientID int64, body string) *httptest.ResponseRecorder {
		return invokeRecallHandler(t, RetryRecallRecipient, http.MethodPost, "/", []byte(body), 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}, {Key: "rid", Value: fmt.Sprint(recipientID)}})
	}
	require.Equal(t, true, decodeRecallEnvelope(t, retry(failedRecipient.Id, `{}`))["success"])
	require.NoError(t, harness.db.First(&failedRecipient, failedRecipient.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, failedRecipient.State)

	require.Equal(t, true, decodeRecallEnvelope(t, retry(failedMessageRecipient.Id, `{}`))["success"])
	require.NoError(t, harness.db.First(&failedMessage, failedMessage.Id).Error)
	require.Equal(t, model.RecallMessageRetryWait, failedMessage.State)

	requireRecallFailure(t, retry(uncertainRecipient.Id, `{}`), "acknowledge_uncertain")
	require.NoError(t, harness.db.First(&uncertainMessage, uncertainMessage.Id).Error)
	require.Equal(t, model.RecallMessageUncertain, uncertainMessage.State)
	require.Equal(t, true, decodeRecallEnvelope(t, retry(uncertainRecipient.Id, `{"acknowledge_uncertain":true}`))["success"])
	require.NoError(t, harness.db.First(&uncertainMessage, uncertainMessage.Id).Error)
	require.Equal(t, model.RecallMessageRetryWait, uncertainMessage.State)

	requireRecallFailure(t, retry(expiredSendingRecipient.Id, `{}`), "acknowledge_uncertain")
	require.Equal(t, true, decodeRecallEnvelope(t, retry(expiredSendingRecipient.Id, `{"acknowledge_uncertain":true}`))["success"])
	require.NoError(t, harness.db.First(&expiredSendingMessage, expiredSendingMessage.Id).Error)
	require.Equal(t, model.RecallMessageRetryWait, expiredSendingMessage.State)
	require.Equal(t, 6, expiredSendingMessage.TemplateVersion)
	require.Equal(t, "expired-sending-template", expiredSendingMessage.TemplateSnapshot)

	requireRecallFailure(t, retry(liveSendingRecipient.Id, `{"acknowledge_uncertain":true}`), "failed")
	require.NoError(t, harness.db.First(&liveSendingMessage, liveSendingMessage.Id).Error)
	require.Equal(t, model.RecallMessageSending, liveSendingMessage.State)

	requireRecallFailure(t, retry(activeRecipient.Id, `{}`), "failed")
}

func TestRecallCancelCompleteAndRetryWriteDeterministicAdminEvents(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	cancelCampaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	completeCampaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	seedRecallControllerUser(t, harness, 81, "audit-retry")
	retryRecipient := model.RecallRecipient{CampaignId: cancelCampaign.Id, UserId: 81, EligibilitySnapshot: `{}`, EmailSnapshot: "audit-retry@example.com", LanguageSnapshot: "en", State: model.RecallRecipientFailed, LastErrorCode: "stripe_permanent", UpdatedAt: recallControllerBoundary + 2}
	require.NoError(t, harness.db.Create(&retryRecipient).Error)

	cancel := invokeRecallHandler(t, CancelRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(cancelCampaign.Id)}})
	complete := invokeRecallHandler(t, CompleteRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(completeCampaign.Id)}})
	retry := invokeRecallHandler(t, RetryRecallRecipient, http.MethodPost, "/", []byte(`{}`), 7, gin.Params{{Key: "id", Value: fmt.Sprint(cancelCampaign.Id)}, {Key: "rid", Value: fmt.Sprint(retryRecipient.Id)}})
	require.Equal(t, true, decodeRecallEnvelope(t, cancel)["success"])
	require.Equal(t, true, decodeRecallEnvelope(t, complete)["success"])
	require.Equal(t, true, decodeRecallEnvelope(t, retry)["success"])

	duplicateCancel := invokeRecallHandler(t, CancelRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(cancelCampaign.Id)}})
	duplicateComplete := invokeRecallHandler(t, CompleteRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(completeCampaign.Id)}})
	duplicateRetry := invokeRecallHandler(t, RetryRecallRecipient, http.MethodPost, "/", []byte(`{}`), 7, gin.Params{{Key: "id", Value: fmt.Sprint(cancelCampaign.Id)}, {Key: "rid", Value: fmt.Sprint(retryRecipient.Id)}})
	require.Equal(t, true, decodeRecallEnvelope(t, duplicateCancel)["success"])
	require.Equal(t, true, decodeRecallEnvelope(t, duplicateComplete)["success"])
	requireRecallFailure(t, duplicateRetry, "failed")

	var events []model.RecallEvent
	require.NoError(t, harness.db.Where("source = ?", "admin").Order("id ASC").Find(&events).Error)
	require.Len(t, events, 3)
	require.Equal(t, "campaign_cancelled", events[0].EventType)
	require.Equal(t, recallControllerAdminEventID("cancel", fmt.Sprintf("actor:%d:campaign:%d:state:%s:updated:%d", 7, cancelCampaign.Id, model.RecallCampaignRunning, recallControllerBoundary)), events[0].SourceEventId)
	require.Equal(t, "campaign_completed", events[1].EventType)
	require.Equal(t, recallControllerAdminEventID("complete", fmt.Sprintf("actor:%d:campaign:%d:state:%s:updated:%d", 7, completeCampaign.Id, model.RecallCampaignRunning, recallControllerBoundary)), events[1].SourceEventId)
	require.Equal(t, "recipient_retry", events[2].EventType)
	require.Equal(t, recallControllerAdminEventID("retry", fmt.Sprintf("actor:%d:campaign:%d:recipient:%d:state:%s:updated:%d", 7, cancelCampaign.Id, retryRecipient.Id, model.RecallRecipientFailed, recallControllerBoundary+2)), events[2].SourceEventId)
	for i := range events {
		require.LessOrEqual(t, len(events[i].SourceEventId), 160)
		require.Contains(t, events[i].EventData, `"actor_id":7`)
		require.Contains(t, events[i].EventData, `"action":`)
	}
}

func TestRecallAdminMutationRollsBackWhenAuditIdentityAlreadyExists(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	cancelCampaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	completeCampaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	retryCampaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignRunning)
	seedRecallControllerUser(t, harness, 82, "audit-cancel")
	seedRecallControllerUser(t, harness, 83, "audit-recipient")
	seedRecallControllerUser(t, harness, 84, "audit-message")

	cancelRecipient := model.RecallRecipient{CampaignId: cancelCampaign.Id, UserId: 82, EligibilitySnapshot: `{}`, EmailSnapshot: "audit-cancel@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	failedRecipient := model.RecallRecipient{CampaignId: retryCampaign.Id, UserId: 83, EligibilitySnapshot: `{}`, EmailSnapshot: "audit-recipient@example.com", LanguageSnapshot: "en", State: model.RecallRecipientFailed, UpdatedAt: recallControllerBoundary + 3}
	failedMessageRecipient := model.RecallRecipient{CampaignId: retryCampaign.Id, UserId: 84, EligibilitySnapshot: `{}`, EmailSnapshot: "audit-message@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, harness.db.Create(&cancelRecipient).Error)
	require.NoError(t, harness.db.Create(&failedRecipient).Error)
	require.NoError(t, harness.db.Create(&failedMessageRecipient).Error)
	cancelMessage := model.RecallMessage{RecipientId: cancelRecipient.Id, StageNo: 1, TemplateSnapshot: "cancel-template", State: model.RecallMessageScheduled}
	failedMessage := model.RecallMessage{RecipientId: failedMessageRecipient.Id, StageNo: 1, TemplateSnapshot: "failed-template", State: model.RecallMessageFailed, AttemptCount: 2, FailedAt: recallControllerBoundary + 4, UpdatedAt: recallControllerBoundary + 4}
	require.NoError(t, harness.db.Create(&cancelMessage).Error)
	require.NoError(t, harness.db.Create(&failedMessage).Error)

	insertCollision := func(campaignID int64, recipientID int64, action string, requestID string) {
		require.NoError(t, harness.db.Create(&model.RecallEvent{
			CampaignId:    campaignID,
			RecipientId:   recipientID,
			EventType:     "preexisting_admin_event",
			Source:        "admin",
			SourceEventId: recallControllerAdminEventID(action, requestID),
			EventData:     `{}`,
		}).Error)
	}

	cancelRequestID := "request-cancel-audit-collision"
	insertCollision(cancelCampaign.Id, 0, "cancel", cancelRequestID)
	cancel := invokeRecallHandlerWithRequestID(t, CancelRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(cancelCampaign.Id)}}, cancelRequestID)
	requireRecallFailure(t, cancel, "audit")
	require.NoError(t, harness.db.First(cancelCampaign, cancelCampaign.Id).Error)
	require.Equal(t, model.RecallCampaignRunning, cancelCampaign.Status)
	require.NoError(t, harness.db.First(&cancelMessage, cancelMessage.Id).Error)
	require.Equal(t, model.RecallMessageScheduled, cancelMessage.State)

	completeRequestID := "request-complete-audit-collision"
	insertCollision(completeCampaign.Id, 0, "complete", completeRequestID)
	complete := invokeRecallHandlerWithRequestID(t, CompleteRecallCampaign, http.MethodPost, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(completeCampaign.Id)}}, completeRequestID)
	requireRecallFailure(t, complete, "audit")
	require.NoError(t, harness.db.First(completeCampaign, completeCampaign.Id).Error)
	require.Equal(t, model.RecallCampaignRunning, completeCampaign.Status)

	recipientRequestID := "request-recipient-retry-audit-collision"
	insertCollision(retryCampaign.Id, failedRecipient.Id, "retry", recipientRequestID)
	recipientRetry := invokeRecallHandlerWithRequestID(t, RetryRecallRecipient, http.MethodPost, "/", []byte(`{}`), 7, gin.Params{{Key: "id", Value: fmt.Sprint(retryCampaign.Id)}, {Key: "rid", Value: fmt.Sprint(failedRecipient.Id)}}, recipientRequestID)
	requireRecallFailure(t, recipientRetry, "audit")
	require.NoError(t, harness.db.First(&failedRecipient, failedRecipient.Id).Error)
	require.Equal(t, model.RecallRecipientFailed, failedRecipient.State)

	messageRequestID := "request-message-retry-audit-collision"
	insertCollision(retryCampaign.Id, failedMessageRecipient.Id, "retry", messageRequestID)
	messageRetry := invokeRecallHandlerWithRequestID(t, RetryRecallRecipient, http.MethodPost, "/", []byte(`{}`), 7, gin.Params{{Key: "id", Value: fmt.Sprint(retryCampaign.Id)}, {Key: "rid", Value: fmt.Sprint(failedMessageRecipient.Id)}}, messageRequestID)
	requireRecallFailure(t, messageRetry, "audit")
	require.NoError(t, harness.db.First(&failedMessage, failedMessage.Id).Error)
	require.Equal(t, model.RecallMessageFailed, failedMessage.State)
}

func TestRecallExportMasksCodesAndSeparatesCurrencyAmounts(t *testing.T) {
	harness := setupRecallControllerHarness(t)
	campaign := seedRecallControllerCampaign(t, harness, model.RecallCampaignCompleted)
	seedRecallControllerUser(t, harness, 91, "export-usd")
	seedRecallControllerUser(t, harness, 92, "export-eur")
	recipients := []model.RecallRecipient{
		{CampaignId: campaign.Id, UserId: 91, EligibilitySnapshot: `{}`, EmailSnapshot: "export-usd@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, PromotionCode: "USDSECRET999", ConversionKind: model.RecallConversionDirect, ConversionCurrency: "usd", ConversionAmount: 1250, DiscountAmount: 250},
		{CampaignId: campaign.Id, UserId: 92, EligibilitySnapshot: `{}`, EmailSnapshot: "export-eur@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, PromotionCode: "EURSECRET888", ConversionKind: model.RecallConversionAssisted, ConversionCurrency: "eur", ConversionAmount: 900, DiscountAmount: 100},
	}
	require.NoError(t, harness.db.Create(&recipients).Error)

	recorder := invokeRecallHandler(t, ExportRecallCampaign, http.MethodGet, "/", nil, 7, gin.Params{{Key: "id", Value: fmt.Sprint(campaign.Id)}})
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "text/csv; charset=utf-8", recorder.Header().Get("Content-Type"))
	require.NotContains(t, recorder.Body.String(), "USDSECRET999")
	require.NotContains(t, recorder.Body.String(), "EURSECRET888")
	require.NotContains(t, strings.ToLower(recorder.Body.String()), "claim_token_hash")
	require.NotContains(t, strings.ToLower(recorder.Body.String()), "template_snapshot")
	require.Contains(t, recorder.Body.String(), model.MaskPromotionCode("USDSECRET999"))

	rows, err := csv.NewReader(strings.NewReader(recorder.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, rows, 3)
	require.Equal(t, []string{"recipient_id", "user_id", "state", "promotion_code_masked", "conversion_kind", "currency", "conversion_amount", "discount_amount", "converted_at"}, rows[0])
	require.Equal(t, "USD", rows[1][5])
	require.Equal(t, "1250", rows[1][6])
	require.Equal(t, "250", rows[1][7])
	require.Equal(t, "EUR", rows[2][5])
	require.Equal(t, "900", rows[2][6])
	require.Equal(t, "100", rows[2][7])
}
