package service

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const seedanceProxyAssetUploadPath = "/api/seedance/proxy/assets"

var seedanceProxyAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
	return GetHttpClientWithProxy(strings.TrimSpace(channel.GetSetting().Proxy))
}

type seedanceProxyAssetBindingMaterializer struct {
	config assetMaterializationChannelConfig
}

type seedanceProxyAssetCreateRequest struct {
	GroupID   string `json:"GroupId"`
	URL       string `json:"URL"`
	AssetType string `json:"AssetType"`
	Name      string `json:"Name,omitempty"`
}

type seedanceProxyAssetResponse struct {
	Result seedanceProxyAssetResponseResult `json:"Result"`
	Error  seedanceProxyAssetResponseError  `json:"Error"`
}

type seedanceProxyAssetResponseResult struct {
	ID      string                          `json:"Id"`
	GroupID string                          `json:"GroupId"`
	Status  string                          `json:"Status"`
	Error   seedanceProxyAssetResponseError `json:"Error"`
}

type seedanceProxyAssetResponseError struct {
	Code    string `json:"Code"`
	Message string `json:"Message"`
}

func (seedanceProxyAssetBindingMaterializer) CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	config, ok := seedanceProxyMaterializationConfig(input.Channel)
	if !ok {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	assetType, err := seedanceProxyAssetNormalizeType(input.Asset.AssetType)
	if err != nil {
		return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorDefinitive, 0, "", 0, "", err)
	}
	sourceURL := strings.TrimSpace(input.SourceURL)
	if sourceURL == "" && input.SignSource != nil {
		var err error
		sourceURL, err = input.SignSource(ctx, input.Asset)
		if err != nil {
			return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorProcessing, 0, "", 0, "", err)
		}
	}
	if sourceURL == "" {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	client, err := seedanceProxyAssetHTTPClientFactory(input.Channel)
	if err != nil || client == nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	requestURL := strings.TrimRight(config.GatewayBaseURL, "/") + seedanceProxyAssetUploadPath
	payload, err := common.Marshal(seedanceProxyAssetCreateRequest{
		GroupID:   config.GroupID,
		URL:       sourceURL,
		AssetType: assetType,
		Name:      opaqueBytePlusAssetName(),
	})
	if err != nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(payload))
	if err != nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if apiKey := strings.TrimSpace(input.APIKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	if idempotencyKey := strings.TrimSpace(input.IdempotencyKey); idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || isNetTimeout(err) {
			return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorTimeout, 0, "", 0, "", err)
		}
		return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorProcessing, 0, "", 0, "", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, techMobiAssetResponseMaxSize+1))
	if err != nil || len(body) > techMobiAssetResponseMaxSize {
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, err)
	}
	var upstream seedanceProxyAssetResponse
	if err := common.Unmarshal(body, &upstream); err != nil {
		if response.StatusCode >= 400 {
			return AssetMaterializeResult{}, seedanceProxyAssetHTTPFailure(response, upstream, err)
		}
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return AssetMaterializeResult{}, seedanceProxyAssetHTTPFailure(response, upstream, nil)
	}
	upstreamID := strings.TrimSpace(upstream.Result.ID)
	if upstreamID == "" {
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, errors.New("seedance proxy asset id missing"))
	}
	upstreamGroupID := strings.TrimSpace(upstream.Result.GroupID)
	if upstreamGroupID == "" {
		upstreamGroupID = config.GroupID
	}
	status, ok := seedanceProxyAssetNormalizeStatus(upstream.Result.Status, true)
	if !ok {
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, errors.New("seedance proxy asset status invalid"))
	}
	return AssetMaterializeResult{
		UpstreamGroupID: upstreamGroupID,
		UpstreamAssetID: upstreamID,
		Status:          status,
	}, nil
}

func (seedanceProxyAssetBindingMaterializer) GetAsset(ctx context.Context, input AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	config, ok := seedanceProxyMaterializationConfig(input.Channel)
	if !ok {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	client, err := seedanceProxyAssetHTTPClientFactory(input.Channel)
	if err != nil || client == nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	escapedAssetID := url.PathEscape(strings.TrimSpace(upstreamAssetID))
	requestURL := strings.TrimRight(config.GatewayBaseURL, "/") + seedanceProxyAssetUploadPath + "/" + escapedAssetID
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return AssetMaterializeResult{}, ErrAssetBindingUnavailable
	}
	if apiKey := strings.TrimSpace(input.APIKey); apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	response, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || isNetTimeout(err) {
			return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorTimeout, 0, "", 0, "", err)
		}
		return AssetMaterializeResult{}, newAssetMaterializeFailure(AssetMaterializeErrorProcessing, 0, "", 0, "", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, techMobiAssetResponseMaxSize+1))
	if err != nil || len(body) > techMobiAssetResponseMaxSize {
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, err)
	}
	var upstream seedanceProxyAssetResponse
	if err := common.Unmarshal(body, &upstream); err != nil {
		if response.StatusCode >= 400 {
			return AssetMaterializeResult{}, seedanceProxyAssetHTTPFailure(response, upstream, err)
		}
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return AssetMaterializeResult{}, seedanceProxyAssetHTTPFailure(response, upstream, nil)
	}
	observedID := strings.TrimSpace(upstream.Result.ID)
	if observedID == "" {
		observedID = strings.TrimSpace(upstreamAssetID)
	}
	if observedID == "" {
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, errors.New("seedance proxy asset id missing"))
	}
	upstreamGroupID := strings.TrimSpace(upstream.Result.GroupID)
	if upstreamGroupID == "" {
		upstreamGroupID = config.GroupID
	}
	status, ok := seedanceProxyAssetNormalizeStatus(upstream.Result.Status, false)
	if !ok {
		return AssetMaterializeResult{}, seedanceProxyAssetProtocolFailure(response, errors.New("seedance proxy asset status invalid"))
	}
	return AssetMaterializeResult{
		UpstreamGroupID: upstreamGroupID,
		UpstreamAssetID: observedID,
		Status:          status,
	}, nil
}

func seedanceProxyMaterializationConfig(channel *model.Channel) (assetMaterializationChannelConfig, bool) {
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil || !explicit || config.Provider != assetMaterializationProviderSeedanceProxy {
		return assetMaterializationChannelConfig{}, false
	}
	if err := seedanceProxyValidateGatewayBaseURL(config.GatewayBaseURL); err != nil {
		return assetMaterializationChannelConfig{}, false
	}
	return config, true
}

func seedanceProxyAssetHTTPFailure(response *http.Response, upstream seedanceProxyAssetResponse, cause error) error {
	status := 0
	var header http.Header
	if response != nil {
		status = response.StatusCode
		header = response.Header
	}
	return newAssetMaterializeFailure(
		assetMaterializeClassForHTTPStatus(status, seedanceProxyAssetUpstreamCode(upstream)),
		status,
		seedanceProxyAssetUpstreamCode(upstream),
		parseAssetMaterializeRetryAfter(header.Get("Retry-After"), time.Now()),
		"",
		cause,
	)
}

func seedanceProxyAssetProtocolFailure(response *http.Response, cause error) error {
	status := 0
	if response != nil {
		status = response.StatusCode
	}
	return newAssetMaterializeFailure(AssetMaterializeErrorProcessing, status, "", 0, "", cause)
}

func seedanceProxyAssetUpstreamCode(upstream seedanceProxyAssetResponse) string {
	if code := strings.TrimSpace(upstream.Error.Code); code != "" {
		return code
	}
	return strings.TrimSpace(upstream.Result.Error.Code)
}

func seedanceProxyAssetNormalizeStatus(status string, allowEmpty bool) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "":
		if allowEmpty {
			return model.AssetStatusProcessing, true
		}
		return "", false
	case strings.ToLower(model.AssetStatusActive):
		return model.AssetStatusActive, true
	case strings.ToLower(model.AssetStatusProcessing):
		return model.AssetStatusProcessing, true
	case strings.ToLower(model.AssetStatusFailed):
		return model.AssetStatusFailed, true
	default:
		return "", false
	}
}

func seedanceProxyAssetNormalizeType(assetType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(assetType)) {
	case strings.ToLower("Image"):
		return "Image", nil
	case strings.ToLower("Video"):
		return "Video", nil
	case strings.ToLower("Audio"):
		return "Audio", nil
	default:
		return "", errors.New("seedance proxy asset type unsupported")
	}
}

func seedanceProxyValidateGatewayBaseURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return err
	}
	if parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Opaque != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return ErrAssetBindingUnavailable
	}
	if strings.ContainsAny(parsed.Path, "\\") || seedanceProxyGatewayPathHasTraversal(parsed.Path) || seedanceProxyGatewayPathHasTraversal(parsed.EscapedPath()) {
		return ErrAssetBindingUnavailable
	}
	return nil
}

func seedanceProxyGatewayPathHasTraversal(rawPath string) bool {
	for _, segment := range strings.Split(rawPath, "/") {
		if segment == "" {
			continue
		}
		decoded := segment
		for decodePass := 0; decodePass < 8; decodePass++ {
			unescaped, err := url.PathUnescape(decoded)
			if err != nil {
				return true
			}
			if unescaped == decoded {
				break
			}
			decoded = unescaped
			if decodePass == 7 {
				return true
			}
		}
		for _, decodedSegment := range strings.FieldsFunc(decoded, func(r rune) bool { return r == '/' || r == '\\' }) {
			if decodedSegment == "." || decodedSegment == ".." {
				return true
			}
		}
	}
	return false
}
