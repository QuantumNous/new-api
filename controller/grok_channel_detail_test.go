package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// newGetChannelContext 构造一个带 id path param 的 gin 上下文（GetChannel 从 c.Param("id") 取渠道）。
func newGetChannelContext(t *testing.T, id int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/channel/"+strconv.Itoa(id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(id)}}
	return ctx, rec
}

type getChannelResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Id            int    `json:"id"`
		Type          int    `json:"type"`
		GrokAuthState *struct {
			AuthStatus    string `json:"auth_status"`
			BillingPlan   string `json:"billing_plan"`
			TierRaw       string `json:"tier_raw"`
			LastRefreshAt int64  `json:"last_refresh_at"`
		} `json:"grok_auth_state"`
	} `json:"data"`
}

// TestGetChannelProjectsGrokAuthStateFor113 守护本任务核心：113 渠道的 detail 响应
// 携带非秘密 grok_auth_state.auth_status，且响应体绝不含 last_error / lease / 敏感哨兵。
func TestGetChannelProjectsGrokAuthStateFor113(t *testing.T) {
	setupGrokAuthTestDB(t)
	ch := seedGrokChannel(t)

	// 预置一行"塞满敏感字段"的 state：detail 只能透出 4 白名单字段。
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:             ch.Id,
		AuthStatus:            model.GrokAuthStatusActive,
		BillingPlan:           "SuperGrok",
		TierRaw:               "tier-x",
		QuotaSnapshot:         `{"remaining":5}`,
		RefreshLeaseOwner:     "SENSITIVE-lease-owner-node",
		RefreshLeaseExpiresAt: 1893456000,
		LastRefreshAt:         1700000000,
		LastError:             "SENSITIVE-upstream-desc-with-token-xyz",
	}))

	ctx, rec := newGetChannelContext(t, ch.Id)
	GetChannel(ctx)
	require.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	// 安全回归：detail 响应绝不能夹带 LastError / lease / quota 敏感串。
	for _, banned := range []string{
		"last_error", "refresh_lease", "quota_snapshot",
		"SENSITIVE-upstream-desc-with-token-xyz", "SENSITIVE-lease-owner-node",
	} {
		require.NotContains(t, body, banned, "detail response must not leak %q", banned)
	}

	var resp getChannelResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.NotNil(t, resp.Data.GrokAuthState, "113 channel must carry grok_auth_state")
	require.Equal(t, model.GrokAuthStatusActive, resp.Data.GrokAuthState.AuthStatus)
	require.Equal(t, "SuperGrok", resp.Data.GrokAuthState.BillingPlan)
	require.Equal(t, "tier-x", resp.Data.GrokAuthState.TierRaw)
	require.Equal(t, int64(1700000000), resp.Data.GrokAuthState.LastRefreshAt)
}

// TestGetChannelProjectsNeedsReauthState 守护 needs_reauth 端到端：detail 如实透出该状态，
// 响应体同样不得夹带 last_error / lease / 敏感哨兵（needs_reauth 正是 LastError 最可能非空的态）。
func TestGetChannelProjectsNeedsReauthState(t *testing.T) {
	setupGrokAuthTestDB(t)
	ch := seedGrokChannel(t)

	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:  ch.Id,
		AuthStatus: model.GrokAuthStatusNeedsReauth,
		LastError:  "SENSITIVE-refresh-failed-desc-xyz",
	}))

	ctx, rec := newGetChannelContext(t, ch.Id)
	GetChannel(ctx)
	require.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	for _, banned := range []string{
		"last_error", "refresh_lease", "SENSITIVE-refresh-failed-desc-xyz",
	} {
		require.NotContains(t, body, banned, "detail response must not leak %q", banned)
	}

	var resp getChannelResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.NotNil(t, resp.Data.GrokAuthState, "needs_reauth channel must carry grok_auth_state")
	require.Equal(t, model.GrokAuthStatusNeedsReauth, resp.Data.GrokAuthState.AuthStatus)
}

// TestGetChannelNoGrokStateStillReturns 守护 state 行不存在（渠道刚建、未授权）时
// detail 仍 200 返回、不 500，且 grok_auth_state 因 omitempty 省略（前端据此显示 pending）。
func TestGetChannelNoGrokStateStillReturns(t *testing.T) {
	setupGrokAuthTestDB(t)
	ch := seedGrokChannel(t) // 未写任何 GrokChannelState 行

	ctx, rec := newGetChannelContext(t, ch.Id)
	GetChannel(ctx)
	require.Equal(t, http.StatusOK, rec.Code)

	var resp getChannelResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.Equal(t, ch.Id, resp.Data.Id)
	require.Nil(t, resp.Data.GrokAuthState, "missing state must omit grok_auth_state, not 500")
}

// TestGetChannelNonGrokTypeNoProjection 守护非 113 渠道不触发 state 查询、不带 grok_auth_state。
func TestGetChannelNonGrokTypeNoProjection(t *testing.T) {
	setupGrokAuthTestDB(t)
	ch := model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Key:    "sk-whatever",
		Models: "gpt-4",
		Group:  "default",
		Status: 1,
	}
	require.NoError(t, model.DB.Create(&ch).Error)

	ctx, rec := newGetChannelContext(t, ch.Id)
	GetChannel(ctx)
	require.Equal(t, http.StatusOK, rec.Code)

	var resp getChannelResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.Nil(t, resp.Data.GrokAuthState, "non-113 channel must not carry grok_auth_state")
}
