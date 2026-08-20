package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const tokenSpaceMaterialAssetPath = "/api/material"

var tokenSpaceMaterialAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
	return GetHttpClientWithProxy(strings.TrimSpace(channel.GetSetting().Proxy))
}

type tokenSpaceMaterialAssetBindingMaterializer struct {
	config assetMaterializationChannelConfig
}

type tokenSpaceMaterialCreateRequest struct {
	GroupID   string `json:"GroupId"`
	URL       string `json:"URL"`
	Name      string `json:"Name"`
	AssetType string `json:"AssetType"`
}

type tokenSpaceMaterialGetRequest struct {
	ID string `json:"Id"`
}

type tokenSpaceMaterialResponse struct {
	ResponseMetadata struct {
		RequestID string `json:"RequestId"`
	} `json:"ResponseMetadata"`
	Result struct {
		ID      string `json:"Id"`
		GroupID string `json:"GroupId"`
		Status  string `json:"Status"`
		Error   struct {
			Code    string `json:"Code"`
			Message string `json:"Message"`
		} `json:"Error"`
	} `json:"Result"`
}

func (tokenSpaceMaterialAssetBindingMaterializer) CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	config, ok := tokenSpaceMaterialConfig(input.Channel)
	if !ok {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	assetType, err := tokenSpaceMaterialNormalizeType(input.Asset.AssetType)
	if err != nil {
		return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorDefinitive, 0, "", 0, "", err)
	}
	sourceURL := strings.TrimSpace(input.SourceURL)
	if sourceURL == "" && input.SignSource != nil {
		sourceURL, err = input.SignSource(ctx, input.Asset)
		if err != nil {
			return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorProcessing, 0, "", 0, "", err)
		}
	}
	if sourceURL == "" {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	payload, err := common.Marshal(tokenSpaceMaterialCreateRequest{
		GroupID:   config.GroupID,
		URL:       sourceURL,
		Name:      opaqueBytePlusAssetName(),
		AssetType: assetType,
	})
	if err != nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	response, err := tokenSpaceMaterialDo(ctx, input.Channel, input.APIKey, input.IdempotencyKey, config.GatewayOrigin, "CreateAsset", payload)
	if err != nil {
		return AssetMaterializeResult{}, err
	}
	upstreamID := strings.TrimSpace(response.Result.ID)
	if upstreamID == "" {
		return AssetMaterializeResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace material asset id missing"))
	}
	return AssetMaterializeResult{
		UpstreamGroupID: config.GroupID,
		UpstreamAssetID: upstreamID,
		Status:          model.AssetStatusProcessing,
	}, nil
}

func (tokenSpaceMaterialAssetBindingMaterializer) GetAsset(ctx context.Context, input AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	config, ok := tokenSpaceMaterialConfig(input.Channel)
	if !ok {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	upstreamAssetID = strings.TrimSpace(upstreamAssetID)
	if upstreamAssetID == "" {
		return AssetMaterializeResult{}, tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace material asset id missing"))
	}
	payload, err := common.Marshal(tokenSpaceMaterialGetRequest{ID: upstreamAssetID})
	if err != nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	response, err := tokenSpaceMaterialDo(ctx, input.Channel, input.APIKey, "", config.GatewayOrigin, "GetAsset", payload)
	if err != nil {
		return AssetMaterializeResult{}, err
	}
	observedID := strings.TrimSpace(response.Result.ID)
	if observedID == "" {
		return AssetMaterializeResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace material asset id missing"))
	}
	if observedID != upstreamAssetID {
		return AssetMaterializeResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace material asset id mismatch"))
	}
	upstreamGroupID := strings.TrimSpace(response.Result.GroupID)
	if upstreamGroupID == "" || upstreamGroupID != config.GroupID {
		return AssetMaterializeResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace material group id mismatch"))
	}
	status, ok := tokenSpaceMaterialNormalizeStatus(response.Result.Status)
	if !ok {
		return AssetMaterializeResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace material asset status invalid"))
	}
	return AssetMaterializeResult{
		UpstreamGroupID: upstreamGroupID,
		UpstreamAssetID: observedID,
		Status:          status,
	}, nil
}

func tokenSpaceMaterialConfig(channel *model.Channel) (assetMaterializationChannelConfig, bool) {
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil || !explicit || config.Provider != assetMaterializationProviderTokenSpaceMaterial {
		return assetMaterializationChannelConfig{}, false
	}
	return config, true
}

func tokenSpaceMaterialNormalizeType(assetType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(assetType)) {
	case strings.ToLower("Image"):
		return "Image", nil
	case strings.ToLower("Video"):
		return "Video", nil
	case strings.ToLower("Audio"):
		return "Audio", nil
	default:
		return "", errors.New("tokenspace material asset type unsupported")
	}
}

func tokenSpaceMaterialNormalizeStatus(status string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case strings.ToLower(model.AssetStatusActive):
		return model.AssetStatusActive, true
	case strings.ToLower("Pending"), strings.ToLower(model.AssetStatusProcessing):
		return model.AssetStatusProcessing, true
	case strings.ToLower(model.AssetStatusFailed):
		return model.AssetStatusFailed, true
	default:
		return "", false
	}
}

func tokenSpaceMaterialBindingScope(origin string, groupID string, apiKey string) string {
	origin = strings.TrimSpace(origin)
	groupID = strings.TrimSpace(groupID)
	apiKey = strings.TrimSpace(apiKey)
	if origin == "" || groupID == "" || apiKey == "" {
		return ""
	}
	digest := sha256.Sum256([]byte(origin + "\x00" + groupID + "\x00" + apiKey))
	return tokenSpaceMaterialBindingScopePrefix + hex.EncodeToString(digest[:])
}

func tokenSpaceMaterialDo(ctx context.Context, channel *model.Channel, apiKey string, idempotencyKey string, gatewayOrigin string, action string, payload []byte) (tokenSpaceMaterialResponse, error) {
	client, err := tokenSpaceMaterialAssetHTTPClientFactory(channel)
	if err != nil || client == nil {
		return tokenSpaceMaterialResponse{}, ErrAssetBindingUnavailable
	}
	requestURL, err := tokenSpaceMaterialActionURL(gatewayOrigin, action)
	if err != nil {
		return tokenSpaceMaterialResponse{}, ErrAssetBindingUnavailable
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(payload))
	if err != nil {
		return tokenSpaceMaterialResponse{}, ErrAssetBindingUnavailable
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if apiKey = strings.TrimSpace(apiKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	if idempotencyKey = strings.TrimSpace(idempotencyKey); idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || isNetTimeout(err) {
			return tokenSpaceMaterialResponse{}, newAssetMaterializeFailure(AssetMaterializeErrorTimeout, 0, "", 0, "", err)
		}
		return tokenSpaceMaterialResponse{}, newAssetMaterializeFailure(AssetMaterializeErrorProcessing, 0, "", 0, "", err)
	}
	defer httpResponse.Body.Close()
	body, err := io.ReadAll(io.LimitReader(httpResponse.Body, techMobiAssetResponseMaxSize+1))
	if err != nil || len(body) > techMobiAssetResponseMaxSize {
		return tokenSpaceMaterialResponse{}, tokenSpaceMaterialProtocolFailure(httpResponse.StatusCode, err)
	}
	var upstream tokenSpaceMaterialResponse
	if err := common.Unmarshal(body, &upstream); err != nil {
		if httpResponse.StatusCode >= 400 {
			return tokenSpaceMaterialResponse{}, tokenSpaceMaterialHTTPFailure(httpResponse, upstream, err)
		}
		return tokenSpaceMaterialResponse{}, tokenSpaceMaterialProtocolFailure(httpResponse.StatusCode, err)
	}
	if code := tokenSpaceMaterialUpstreamCode(upstream); code != "" {
		if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
			return tokenSpaceMaterialResponse{}, newAssetMaterializeFailure(AssetMaterializeErrorDefinitive, httpResponse.StatusCode, code, 0, tokenSpaceMaterialRequestID(upstream), nil)
		}
	}
	if httpResponse.StatusCode < 200 || httpResponse.StatusCode >= 300 {
		return tokenSpaceMaterialResponse{}, tokenSpaceMaterialHTTPFailure(httpResponse, upstream, nil)
	}
	return upstream, nil
}

func tokenSpaceMaterialActionURL(gatewayOrigin string, action string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(gatewayOrigin))
	if err != nil {
		return "", err
	}
	parsed.Path = tokenSpaceMaterialAssetPath
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	query := parsed.Query()
	query.Set("Action", action)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func tokenSpaceMaterialHTTPFailure(response *http.Response, upstream tokenSpaceMaterialResponse, cause error) error {
	status := 0
	var header http.Header
	if response != nil {
		status = response.StatusCode
		header = response.Header
	}
	return newAssetMaterializeFailure(
		assetMaterializeClassForHTTPStatus(status, tokenSpaceMaterialUpstreamCode(upstream)),
		status,
		tokenSpaceMaterialUpstreamCode(upstream),
		parseAssetMaterializeRetryAfter(header.Get("Retry-After"), time.Now()),
		tokenSpaceMaterialRequestID(upstream),
		cause,
	)
}

func tokenSpaceMaterialProtocolFailure(status int, cause error) error {
	return newAssetMaterializeFailure(AssetMaterializeErrorProcessing, status, "", 0, "", cause)
}

func tokenSpaceMaterialUpstreamCode(upstream tokenSpaceMaterialResponse) string {
	return strings.TrimSpace(upstream.Result.Error.Code)
}

func tokenSpaceMaterialRequestID(upstream tokenSpaceMaterialResponse) string {
	return strings.TrimSpace(upstream.ResponseMetadata.RequestID)
}
