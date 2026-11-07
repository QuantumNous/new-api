package controller

import (
	"context"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

// Only expose resource fields, never the upstream payment/account metadata.
type novelAIBalance struct {
	Active    *bool  `json:"active"`
	Tier      *int   `json:"tier"`
	ExpiresAt *int64 `json:"expiresAt"`
	Points    *struct {
		Fixed     *int64 `json:"fixedTrainingStepsLeft"`
		Purchased *int64 `json:"purchasedTrainingSteps"`
	} `json:"trainingStepsLeft"`
	Usage *struct {
		Negative    *bool  `json:"isNegative"`
		Percent     *int   `json:"percent"`
		Purchased   *int   `json:"purchasedPercent"`
		NextPercent *int64 `json:"timeUntilNextPercent"`
	} `json:"usage"`
	SampledAt int64 `json:"sampled_at"`
}

func fetchNovelAIBalance(channel *model.Channel) (channelBalanceResult, error) {
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		baseURL = constant.GetChannelBaseURL(constant.ChannelTypeNovelAI)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/user/subscription", nil)
	if err != nil {
		return channelBalanceResult{}, common.NewMessage("NovelAI balance request failed")
	}
	key := strings.TrimSpace(channel.Key)
	request.Header = GetAuthHeader(key)
	if err := applyFetchModelsHeaderOverrides(channel, key, request.Header); err != nil {
		return channelBalanceResult{}, common.NewMessage("NovelAI balance request failed")
	}
	if host := request.Header.Get("Host"); host != "" {
		request.Host = host
	}
	setting := channel.GetSetting()
	client, err := service.GetHttpClientWithProxySettings(setting.Proxy, setting)
	if err != nil {
		return channelBalanceResult{}, common.NewMessage("NovelAI balance request failed")
	}
	// Subscription queries must not forward credentials through redirects.
	boundedClient := *client
	boundedClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	response, err := boundedClient.Do(request)
	if err != nil {
		return channelBalanceResult{}, common.NewMessage("NovelAI balance request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return channelBalanceResult{}, common.NewMessage("NovelAI balance request failed (HTTP {{status}})", map[string]any{"status": response.StatusCode})
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAdvancedCustomBalanceResponseBytes+1))
	if err != nil || len(body) > maxAdvancedCustomBalanceResponseBytes {
		return channelBalanceResult{}, common.NewMessage("Invalid NovelAI subscription response")
	}
	var balance novelAIBalance
	if err := common.Unmarshal(body, &balance); err != nil || balance.Active == nil || balance.Tier == nil {
		return channelBalanceResult{}, common.NewMessage("Invalid NovelAI subscription response")
	}
	if points := balance.Points; points != nil {
		for _, value := range []*int64{points.Fixed, points.Purchased} {
			if value != nil && (*value < 0 || *value > 1<<52-1) {
				return channelBalanceResult{}, common.NewMessage("Invalid NovelAI subscription response")
			}
		}
	}
	if usage := balance.Usage; usage != nil {
		if (usage.Percent != nil && *usage.Percent < 0) ||
			(usage.Purchased != nil && (*usage.Purchased < 0 || *usage.Purchased > 400)) ||
			(usage.NextPercent != nil && *usage.NextPercent < 0) {
			return channelBalanceResult{}, common.NewMessage("Invalid NovelAI subscription response")
		}
	}
	balance.SampledAt = time.Now().Unix()
	// Anlas and regenerating allowance are not a USD balance.
	return channelBalanceResult{NovelAI: &balance}, nil
}
