package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func FetchCodexChannelModels(channel *model.Channel) ([]string, error) {
	if channel == nil || channel.Type != constant.ChannelTypeCodex {
		return nil, fmt.Errorf("channel type is not Codex")
	}
	if channel.ChannelInfo.IsMultiKey {
		return nil, fmt.Errorf("codex channel does not support multi-key model discovery")
	}

	baseClient, err := NewProxyHttpClient(channel.GetSetting().Proxy)
	if err != nil {
		return nil, err
	}
	client := *baseClient
	client.Timeout = 20 * time.Second

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	clientVersion, err := GetLatestCodexClientVersion(ctx, &client)
	if err != nil {
		return nil, fmt.Errorf("failed to get Codex client version: %w", err)
	}

	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[constant.ChannelTypeCodex]
	}
	return fetchCodexChannelModels(ctx, channel, baseURL, &client, clientVersion)
}

func fetchCodexChannelModels(
	ctx context.Context,
	channel *model.Channel,
	baseURL string,
	client *http.Client,
	clientVersion string,
) ([]string, error) {
	if channel == nil {
		return nil, fmt.Errorf("nil channel")
	}
	oauthKey, err := parseCodexOAuthKey(strings.TrimSpace(channel.Key))
	if err != nil {
		return nil, err
	}

	statusCode, models, err := FetchCodexModels(ctx, client, baseURL, oauthKey, clientVersion)
	if err != nil {
		return nil, err
	}
	if statusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("codex channel credential expired; refresh it before retrying model fetch")
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("upstream status: %d", statusCode)
	}

	modelVariants := make([]string, 0, len(models)*2)
	seen := make(map[string]struct{}, len(models)*2)
	for _, modelName := range models {
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}
		modelVariants = append(modelVariants, modelName)
	}
	for _, modelName := range models {
		if modelName == "codex-auto-review" {
			continue
		}
		compactModel := ratio_setting.WithCompactModelSuffix(modelName)
		if _, ok := seen[compactModel]; ok {
			continue
		}
		seen[compactModel] = struct{}{}
		modelVariants = append(modelVariants, compactModel)
	}
	return modelVariants, nil
}
