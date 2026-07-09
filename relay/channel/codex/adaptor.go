package codex

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	projectconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
)

type Adaptor struct {
}

var (
	codexAutoResetTimeout = 15 * time.Second
	codexAutoResetGroup   singleflight.Group
)

const codexAutoResetLockTTL = 15 * time.Minute

type codexRateLimitWindow struct {
	UsedPercent        float64 `json:"used_percent"`
	LimitWindowSeconds int64   `json:"limit_window_seconds"`
}

type codexUsagePayload struct {
	PlanType  string `json:"plan_type"`
	RateLimit struct {
		PlanType        string                `json:"plan_type"`
		PrimaryWindow   *codexRateLimitWindow `json:"primary_window"`
		SecondaryWindow *codexRateLimitWindow `json:"secondary_window"`
	} `json:"rate_limit"`
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/messages endpoint not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("codex channel: endpoint not supported")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/chat/completions endpoint not supported")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/rerank endpoint not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("codex channel: /v1/embeddings endpoint not supported")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	isCompact := info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact

	if info != nil && info.ChannelSetting.SystemPrompt != "" {
		systemPrompt := info.ChannelSetting.SystemPrompt

		if len(request.Instructions) == 0 {
			if b, err := common.Marshal(systemPrompt); err == nil {
				request.Instructions = b
			} else {
				return nil, err
			}
		} else if info.ChannelSetting.SystemPromptOverride {
			var existing string
			if err := common.Unmarshal(request.Instructions, &existing); err == nil {
				existing = strings.TrimSpace(existing)
				if existing == "" {
					if b, err := common.Marshal(systemPrompt); err == nil {
						request.Instructions = b
					} else {
						return nil, err
					}
				} else {
					if b, err := common.Marshal(systemPrompt + "\n" + existing); err == nil {
						request.Instructions = b
					} else {
						return nil, err
					}
				}
			} else {
				if b, err := common.Marshal(systemPrompt); err == nil {
					request.Instructions = b
				} else {
					return nil, err
				}
			}
		}
	}
	// Codex backend requires the `instructions` field to be present.
	// Keep it consistent with Codex CLI behavior by defaulting to an empty string.
	if len(request.Instructions) == 0 {
		request.Instructions = json.RawMessage(`""`)
	}

	if isCompact {
		return request, nil
	}
	// codex: store must be false
	request.Store = json.RawMessage("false")
	// rm max_output_tokens
	request.MaxOutputTokens = nil
	request.Temperature = nil
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info == nil || !info.ChannelOtherSettings.AutoResetUsageEnabled || requestBody == nil {
		return channel.DoApiRequest(a, c, info, requestBody)
	}

	maxBytes := int64(projectconstant.MaxRequestBodyMB)
	if maxBytes <= 0 {
		maxBytes = 128
	}
	storage, err := common.CreateBodyStorageFromReader(requestBody, info.UpstreamRequestBodySize, maxBytes<<20)
	if err != nil {
		return nil, err
	}
	defer storage.Close()

	if _, err = storage.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	resp, err := channel.DoApiRequest(a, c, info, common.ReaderOnly(storage))
	if err != nil {
		return nil, err
	}
	if resp == nil || resp.StatusCode != http.StatusTooManyRequests {
		return resp, nil
	}

	if !consumeCodexResetCredit(c, info) {
		return resp, nil
	}
	_ = resp.Body.Close()

	if _, err = storage.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return channel.DoApiRequest(a, c, info, common.ReaderOnly(storage))
}

func consumeCodexResetCredit(c *gin.Context, info *relaycommon.RelayInfo) bool {
	oauthKey, err := ParseOAuthKey(strings.TrimSpace(info.ApiKey))
	if err != nil {
		logger.LogWarn(c, "codex auto reset usage skipped: "+err.Error())
		return false
	}

	client := service.GetHttpClient()
	if info.ChannelSetting.Proxy != "" {
		client, err = service.NewProxyHttpClient(info.ChannelSetting.Proxy)
		if err != nil {
			logger.LogWarn(c, "codex auto reset usage skipped: "+err.Error())
			return false
		}
	}

	requestContext := context.Background()
	if c != nil && c.Request != nil {
		requestContext = c.Request.Context()
	}
	resetKey := codexAutoResetKey(info.ChannelBaseUrl, oauthKey.AccountID)
	resultChannel := codexAutoResetGroup.DoChan(resetKey, func() (any, error) {
		ctx, cancel := context.WithTimeout(context.Background(), codexAutoResetTimeout)
		defer cancel()

		if common.RedisEnabled && common.RDB != nil {
			acquired, lockErr := common.RDB.SetNX(
				ctx,
				"codex:auto-reset:lock:"+resetKey,
				"1",
				codexAutoResetLockTTL,
			).Result()
			if lockErr == nil && !acquired {
				return false, nil
			}
			if lockErr != nil {
				logger.LogWarn(c, "codex auto reset Redis lock unavailable: "+lockErr.Error())
			}
		}

		eligible, eligibilityErr := checkCodexAutoResetEligibility(ctx, client, info, oauthKey)
		if eligibilityErr != nil || !eligible {
			return false, eligibilityErr
		}
		return performCodexAutoReset(ctx, client, info, oauthKey)
	})

	select {
	case result := <-resultChannel:
		if result.Err != nil {
			if !result.Shared {
				logger.LogWarn(c, "codex auto reset usage failed: "+result.Err.Error())
			}
			return false
		}
		reset, ok := result.Val.(bool)
		if reset && !result.Shared {
			logger.LogInfo(c, "codex auto reset usage ready for retry")
		}
		return ok && reset
	case <-requestContext.Done():
		return false
	}
}

func checkCodexAutoResetEligibility(ctx context.Context, client *http.Client, info *relaycommon.RelayInfo, oauthKey *OAuthKey) (bool, error) {
	statusCode, body, err := service.FetchCodexWhamUsage(
		ctx,
		client,
		info.ChannelBaseUrl,
		oauthKey.AccessToken,
		oauthKey.AccountID,
	)
	if err != nil {
		return false, fmt.Errorf("fetch usage: %w", err)
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("fetch usage: upstream_status=%d", statusCode)
	}

	var usage codexUsagePayload
	if err = common.Unmarshal(body, &usage); err != nil {
		return false, fmt.Errorf("parse usage: %w", err)
	}
	weeklyExhausted := false
	for _, window := range []*codexRateLimitWindow{
		usage.RateLimit.PrimaryWindow,
		usage.RateLimit.SecondaryWindow,
	} {
		if window != nil && window.LimitWindowSeconds >= int64((24*time.Hour)/time.Second) && window.UsedPercent >= 100 {
			weeklyExhausted = true
			break
		}
	}
	planType := usage.PlanType
	if planType == "" {
		planType = usage.RateLimit.PlanType
	}
	if !weeklyExhausted && strings.EqualFold(planType, "free") && usage.RateLimit.PrimaryWindow != nil {
		weeklyExhausted = usage.RateLimit.PrimaryWindow.UsedPercent >= 100
	}
	if !weeklyExhausted {
		return false, nil
	}

	statusCode, body, err = service.FetchCodexWhamRateLimitResetCredits(
		ctx,
		client,
		info.ChannelBaseUrl,
		oauthKey.AccessToken,
		oauthKey.AccountID,
	)
	if err != nil {
		return false, fmt.Errorf("fetch reset credits: %w", err)
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("fetch reset credits: upstream_status=%d", statusCode)
	}
	var credits struct {
		AvailableCount int `json:"available_count"`
	}
	if err = common.Unmarshal(body, &credits); err != nil {
		return false, fmt.Errorf("parse reset credits: %w", err)
	}
	if credits.AvailableCount <= 0 {
		return false, nil
	}
	return true, nil
}

func performCodexAutoReset(ctx context.Context, client *http.Client, info *relaycommon.RelayInfo, oauthKey *OAuthKey) (bool, error) {
	statusCode, body, err := service.ConsumeCodexWhamRateLimitResetCredit(
		ctx,
		client,
		info.ChannelBaseUrl,
		oauthKey.AccessToken,
		oauthKey.AccountID,
	)
	if err != nil {
		return false, fmt.Errorf("consume reset credit: %w", err)
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("consume reset credit: upstream_status=%d", statusCode)
	}
	var resetResult struct {
		WindowsReset int `json:"windows_reset"`
	}
	if err = common.Unmarshal(body, &resetResult); err != nil {
		return false, fmt.Errorf("parse reset result: %w", err)
	}
	return resetResult.WindowsReset > 0, nil
}

func codexAutoResetKey(baseURL string, accountID string) string {
	identity := strings.TrimRight(strings.TrimSpace(baseURL), "/") + "|" + strings.TrimSpace(accountID)
	return fmt.Sprintf("%x", sha256.Sum256([]byte(identity)))
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return nil, types.NewError(errors.New("codex channel: endpoint not supported"), types.ErrorCodeInvalidRequest)
	}

	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		return openai.OaiResponsesCompactionHandler(c, resp)
	}

	if info.IsStream {
		return openai.OaiResponsesStreamHandler(c, info, resp)
	}
	return openai.OaiResponsesHandler(c, info, resp)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return "", errors.New("codex channel: only /v1/responses and /v1/responses/compact are supported")
	}
	path := "/backend-api/codex/responses"
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		path = "/backend-api/codex/responses/compact"
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, path, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	key := strings.TrimSpace(info.ApiKey)
	if !strings.HasPrefix(key, "{") {
		return errors.New("codex channel: key must be a JSON object")
	}

	oauthKey, err := ParseOAuthKey(key)
	if err != nil {
		return err
	}

	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)

	if accessToken == "" {
		return errors.New("codex channel: access_token is required")
	}
	if accountID == "" {
		return errors.New("codex channel: account_id is required")
	}

	req.Set("Authorization", "Bearer "+accessToken)
	req.Set("chatgpt-account-id", accountID)

	if req.Get("OpenAI-Beta") == "" {
		req.Set("OpenAI-Beta", "responses=experimental")
	}
	if req.Get("originator") == "" {
		req.Set("originator", "codex_cli_rs")
	}

	// chatgpt.com/backend-api/codex/responses is strict about Content-Type.
	// Clients may omit it or include parameters like `application/json; charset=utf-8`,
	// which can be rejected by the upstream. Force the exact media type.
	req.Set("Content-Type", "application/json")
	if info.IsStream {
		req.Set("Accept", "text/event-stream")
	} else if req.Get("Accept") == "" {
		req.Set("Accept", "application/json")
	}

	return nil
}
