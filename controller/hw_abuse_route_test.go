package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hwAbuseRouter replaces the customer-facing router of the environment with the
// route families the free-group guard covers: /v1, /v1beta and /pg. Every family
// runs token authentication and distribution in the production order, so the
// guard runs from the auth hook there; this router mounts no gate of its own.
func (e *hwEnv) hwAbuseRouter() *gin.Engine {
	require.NoError(e.t, e.db.AutoMigrate(&model.HwAccountFlag{}, &model.HwCreditPackage{}, &model.HwCreditExtension{}))
	router := gin.New()
	router.Use(middleware.RequestId())
	v1 := router.Group("/v1")
	v1.Use(middleware.HwMask(), middleware.TokenAuth(), middleware.Distribute())
	v1.POST("/chat/completions", func(c *gin.Context) { Relay(c, types.RelayFormatOpenAI) })
	v1.POST("/messages", func(c *gin.Context) { Relay(c, types.RelayFormatClaude) })

	beta := router.Group("/v1beta")
	beta.Use(middleware.HwMask(), middleware.TokenAuth(), middleware.Distribute())
	beta.POST("/models/*path", func(c *gin.Context) { Relay(c, types.RelayFormatGemini) })

	playground := router.Group("/pg")
	playground.Use(middleware.HwMask(), middleware.TokenAuth(), middleware.Distribute())
	playground.POST("/chat/completions", Playground)
	e.engine = router
	return router
}

// hwAbusePost sends one request through the environment's router with the
// customer's token and an optional JSON body.
func (e *hwEnv) hwAbusePost(t *testing.T, path string, payload map[string]any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var body []byte
	if payload != nil {
		var err error
		body, err = common.Marshal(payload)
		require.NoError(t, err)
	}
	request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer sk-"+e.token.Key)
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	recorder := httptest.NewRecorder()
	e.engine.ServeHTTP(recorder, request)
	return recorder
}

// hwAbuseChannel creates a supplier channel plus its ability row for one model
// name, so a test can prove which group and model a request actually reached.
func hwAbuseChannel(t *testing.T, env *hwEnv, name, group, modelName string) *hwFakeSupplier {
	t.Helper()
	supplier := env.fake("lumia")
	baseURL := supplier.server.URL
	priority := int64(0)
	weight := uint(1)
	channel := &model.Channel{
		Name:     name,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-fake-" + name,
		Status:   common.ChannelStatusEnabled,
		BaseURL:  &baseURL,
		Group:    group,
		Models:   modelName,
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, env.db.Create(channel).Error)
	require.NoError(t, env.db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: channel.Id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
	return supplier
}

// H1: a free account that holds a token in another group, or whose playground
// body names another group, still may not call a model outside the catalog (the whole catalog is open to it since 4 Nov 2026). The request is
// refused before any supplier is touched, whatever group the channels are
// configured for.
func TestHwFreeGroupCannotReachAnUnsoldModelThroughAnotherGroup(t *testing.T) {
	env := hwNewEnv(t, "free", 1_000_000)
	hwGrantTokenGroup(t, "free", "default")
	// A token in the default group: TokenAuth accepts it for a free account, and
	// the old rule read the token group from here.
	require.NoError(t, env.db.Model(&model.Token{}).Where("id = ?", env.token.Id).Update("group", "default").Error)
	hwAbuseChannel(t, env, "free-unsold", "free", "claude-opus-5")
	supplier := hwAbuseChannel(t, env, "default-unsold", "default", "claude-opus-5")
	env.hwAbuseRouter()

	request := hwChatRequest("claude-opus-5", false)
	for _, path := range []string{"/v1/chat/completions", "/v1/messages"} {
		recorder := env.hwAbusePost(t, path, request, nil)
		assert.Equal(t, http.StatusForbidden, recorder.Code, "%s refuses a free account a model outside the catalog", path)
	}

	// The playground body names another group; the account group still decides.
	recorder := env.hwAbusePost(t, "/pg/chat/completions", map[string]any{
		"model":    "claude-opus-5",
		"group":    "default",
		"stream":   false,
		"messages": []map[string]any{{"role": "user", "content": "hello"}},
	}, nil)
	assert.Equal(t, http.StatusForbidden, recorder.Code, "a playground body group does not widen the free class")

	// The Gemini path carries the model in the URL.
	recorder = env.hwAbusePost(t, "/v1beta/models/claude-opus-5:generateContent", map[string]any{
		"contents": []map[string]any{{"parts": []map[string]any{{"text": "hello"}}}},
	}, nil)
	assert.Equal(t, http.StatusForbidden, recorder.Code, "the /v1beta path does not widen the free class")

	assert.Equal(t, 0, supplier.callCount(), "no supplier is called for a refused class")
}

// The same free account may still call the Haiku class, so the refusal above is
// the model class and not the account.
func TestHwFreeGroupStillCallsHaikuWithAnotherTokenGroup(t *testing.T) {
	env := hwNewEnv(t, "free", 1_000_000)
	hwGrantTokenGroup(t, "free", "default")
	require.NoError(t, env.db.Model(&model.Token{}).Where("id = ?", env.token.Id).Update("group", "default").Error)
	supplier := hwAbuseChannel(t, env, "default-haiku", "default", "claude-haiku-5-5")
	env.hwAbuseRouter()

	recorder := env.hwAbusePost(t, "/v1/chat/completions", hwChatRequest("claude-haiku-5-5", false), nil)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 1, supplier.callCount())
}

// H1 for the request budget: the free limit follows the account as well, so a
// token in another group still ends at the minute budget. The limiter counts per
// process and per account id, so this case takes its own account: the free
// counter of the environment account is shared with the other cases above.
func TestHwFreeGroupBudgetFollowsTheAccountOnMessages(t *testing.T) {
	env := hwNewEnv(t, "free", 1_000_000)
	t.Setenv("HW_FREE_GROUP_PER_MINUTE", "1")
	t.Setenv("HW_FREE_GROUP_PER_DAY", "10")
	hwGrantTokenGroup(t, "free", "default")
	budgetUser := &model.User{
		Username: "hw-budget", Status: common.UserStatusEnabled,
		Group: "free", Quota: 1_000_000, AffCode: "hwaffbudget",
	}
	require.NoError(t, env.db.Create(budgetUser).Error)
	budgetToken := &model.Token{
		UserId: budgetUser.Id, Key: "hwbudgettoken", Name: "hw-budget-token",
		Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true,
	}
	require.NoError(t, env.db.Create(budgetToken).Error)
	env.token = budgetToken
	hwAbuseChannel(t, env, "default-haiku", "default", "claude-haiku-5-5")
	env.hwAbuseRouter()

	first := env.hwAbusePost(t, "/v1/messages", hwClaudeRequest("claude-haiku-5-5", false), nil)
	second := env.hwAbusePost(t, "/v1/messages", hwClaudeRequest("claude-haiku-5-5", false), nil)
	assert.Equal(t, http.StatusOK, first.Code)
	assert.Equal(t, http.StatusTooManyRequests, second.Code, "a token group does not lift the free budget")
}

// H2: a frozen account gets a clean 403 on the free credit, and unfreezing opens
// the door again.
func TestHwFrozenAccountBlockedOnFreeCredit(t *testing.T) {
	env := hwNewEnv(t, "free", 1_000_000)
	hwAbuseChannel(t, env, "free-sonnet", "free", "claude-sonnet-5-5")
	env.hwAbuseRouter()
	request := hwChatRequest("claude-sonnet-5-5", false)

	recorder := env.hwAbusePost(t, "/v1/chat/completions", request, nil)
	require.Equal(t, http.StatusOK, recorder.Code, "the free account may spend its credit before the freeze")

	frozen, err := model.FreezeHwAccounts([]int{env.user.Id}, model.HwFreezeReasonSignupWave, common.GetTimestamp())
	require.NoError(t, err)
	require.Equal(t, 1, frozen)

	recorder = env.hwAbusePost(t, "/v1/chat/completions", request, map[string]string{"Accept-Language": "en"})
	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), string(service.HwErrorCodeAccountFrozen))
	assert.Contains(t, recorder.Body.String(), "under review")
	assert.NotContains(t, recorder.Body.String(), "lumia")
	assert.NotContains(t, recorder.Body.String(), "openrouter")

	recorder = env.hwAbusePost(t, "/v1/chat/completions", request, map[string]string{"Accept-Language": "tr-TR"})
	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "inceleme", "a Turkish reader gets the Turkish text")

	unfrozen, err := model.HwUnfreezeAccount(env.user.Id, 1, common.GetTimestamp())
	require.NoError(t, err)
	require.True(t, unfrozen)
	recorder = env.hwAbusePost(t, "/v1/chat/completions", request, nil)
	assert.Equal(t, http.StatusOK, recorder.Code, "an unfrozen account uses the free credit again")
}

// H2: the freeze only covers the free credit. A paid account keeps working,
// which is what makes the review hold safe for a paying customer.
func TestHwFrozenAccountKeepsPaidCredit(t *testing.T) {
	env := hwNewEnv(t, "paid", 1_000_000)
	supplier := hwAbuseChannel(t, env, "paid-sonnet", "paid", "claude-sonnet-5-5")
	env.hwAbuseRouter()

	frozen, err := model.FreezeHwAccounts([]int{env.user.Id}, model.HwFreezeReasonSharedPhone, common.GetTimestamp())
	require.NoError(t, err)
	require.Equal(t, 1, frozen)

	recorder := env.hwAbusePost(t, "/v1/chat/completions", hwChatRequest("claude-sonnet-5-5", false), nil)
	assert.Equal(t, http.StatusOK, recorder.Code, "paid credit stays usable while the account is frozen")
	assert.Equal(t, 1, supplier.callCount())
}
