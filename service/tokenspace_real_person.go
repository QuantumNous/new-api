package service

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type tokenSpaceVisualValidationResultRequest struct {
	BytedToken string `json:"BytedToken"`
}

type tokenSpaceListAssetsRequest struct {
	Filter struct {
		GroupType string   `json:"GroupType"`
		GroupIDs  []string `json:"GroupIds"`
		Statuses  []string `json:"Statuses,omitempty"`
		Name      string   `json:"Name,omitempty"`
	} `json:"Filter"`
	PageNumber  int    `json:"PageNumber"`
	PageSize    int    `json:"PageSize"`
	SortBy      string `json:"SortBy,omitempty"`
	SortOrder   string `json:"SortOrder,omitempty"`
	ProjectName string `json:"ProjectName"`
}

func (p tokenSpaceRealPersonProvider) CreateVisualValidateSession(ctx context.Context, _ string) (BytePlusVisualValidationSession, error) {
	payload, err := common.Marshal(struct{}{})
	if err != nil {
		return BytePlusVisualValidationSession{}, tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "CreateVisualValidateSession", payload)
	if err != nil {
		return BytePlusVisualValidationSession{}, err
	}
	bytedToken := strings.TrimSpace(response.Result.BytedToken)
	h5Link := strings.TrimSpace(response.Result.H5Link)
	if bytedToken == "" || h5Link == "" {
		return BytePlusVisualValidationSession{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace verification result missing"))
	}
	return BytePlusVisualValidationSession{
		BytedToken: bytedToken,
		H5Link:     h5Link,
		RequestID:  tokenSpaceMaterialRequestID(response),
	}, nil
}

func (p tokenSpaceRealPersonProvider) GetVisualValidateResult(ctx context.Context, bytedToken string) (BytePlusVisualValidationResult, error) {
	bytedToken = strings.TrimSpace(bytedToken)
	if bytedToken == "" {
		return BytePlusVisualValidationResult{}, tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace verification token missing"))
	}
	payload, err := common.Marshal(tokenSpaceVisualValidationResultRequest{BytedToken: bytedToken})
	if err != nil {
		return BytePlusVisualValidationResult{}, tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "GetVisualValidateResult", payload)
	if err != nil {
		return BytePlusVisualValidationResult{}, err
	}
	groupID := strings.TrimSpace(response.Result.GroupID)
	if groupID == "" {
		return BytePlusVisualValidationResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace verification group missing"))
	}
	return BytePlusVisualValidationResult{
		GroupID:   groupID,
		RequestID: tokenSpaceMaterialRequestID(response),
	}, nil
}

func (p tokenSpaceRealPersonProvider) CreateAsset(ctx context.Context, request BytePlusCreateAssetRequest) (string, string, error) {
	assetType, err := tokenSpaceMaterialNormalizeType(request.AssetType)
	if err != nil {
		return "", "", tokenSpaceMaterialProtocolFailure(0, err)
	}
	request.GroupID = strings.TrimSpace(request.GroupID)
	request.URL = strings.TrimSpace(request.URL)
	if request.GroupID == "" || request.URL == "" {
		return "", "", tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace real person asset input missing"))
	}
	payload, err := common.Marshal(tokenSpaceMaterialCreateRequest{
		GroupID:   request.GroupID,
		URL:       request.URL,
		Name:      strings.TrimSpace(request.Name),
		AssetType: assetType,
	})
	if err != nil {
		return "", "", tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "CreateAsset", payload)
	if err != nil {
		return "", "", err
	}
	assetID := strings.TrimSpace(response.Result.ID)
	if assetID == "" {
		return "", tokenSpaceMaterialRequestID(response), tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace real person asset id missing"))
	}
	return assetID, tokenSpaceMaterialRequestID(response), nil
}

func (p tokenSpaceRealPersonProvider) GetAsset(ctx context.Context, upstreamAssetID string) (BytePlusAssetStatus, error) {
	upstreamAssetID = strings.TrimSpace(upstreamAssetID)
	if upstreamAssetID == "" {
		return BytePlusAssetStatus{}, tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace real person asset id missing"))
	}
	payload, err := common.Marshal(tokenSpaceMaterialGetRequest{ID: upstreamAssetID})
	if err != nil {
		return BytePlusAssetStatus{}, tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "GetAsset", payload)
	if err != nil {
		return BytePlusAssetStatus{}, err
	}
	if strings.TrimSpace(response.Result.ID) != upstreamAssetID {
		return BytePlusAssetStatus{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace real person asset id mismatch"))
	}
	status, ok := tokenSpaceRealPersonAssetStatus(response.Result.Status)
	if !ok {
		return BytePlusAssetStatus{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace real person asset status invalid"))
	}
	return BytePlusAssetStatus{
		UpstreamAssetID: upstreamAssetID,
		Status:          status,
		RequestID:       tokenSpaceMaterialRequestID(response),
		ErrorMessage:    strings.TrimSpace(response.Result.Error.Message),
	}, nil
}

func (p tokenSpaceRealPersonProvider) ListAssets(ctx context.Context, request BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	if len(request.GroupIDs) == 0 {
		return BytePlusListAssetsResult{}, tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace real person group missing"))
	}
	payloadRequest := tokenSpaceListAssetsRequest{
		PageNumber:  request.PageNumber,
		PageSize:    request.PageSize,
		SortBy:      strings.TrimSpace(request.SortBy),
		SortOrder:   strings.TrimSpace(request.SortOrder),
		ProjectName: "default",
	}
	payloadRequest.Filter.GroupType = "LivenessFace"
	payloadRequest.Filter.GroupIDs = request.GroupIDs
	payloadRequest.Filter.Statuses = request.Statuses
	payloadRequest.Filter.Name = strings.TrimSpace(request.Name)
	payload, err := common.Marshal(payloadRequest)
	if err != nil {
		return BytePlusListAssetsResult{}, tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "ListAssets", payload)
	if err != nil {
		return BytePlusListAssetsResult{}, err
	}
	allowedGroups := make(map[string]bool, len(request.GroupIDs))
	for _, groupID := range request.GroupIDs {
		allowedGroups[strings.TrimSpace(groupID)] = true
	}
	items := make([]BytePlusListedAsset, 0, len(response.Result.Items))
	for _, item := range response.Result.Items {
		groupID := strings.TrimSpace(item.GroupID)
		if !allowedGroups[groupID] {
			return BytePlusListAssetsResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace real person asset group mismatch"))
		}
		createTime, err := tokenSpaceRealPersonTimestamp(item.CreateTime)
		if err != nil {
			return BytePlusListAssetsResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, err)
		}
		updateTime, err := tokenSpaceRealPersonTimestamp(item.UpdateTime)
		if err != nil {
			return BytePlusListAssetsResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, err)
		}
		status, ok := tokenSpaceRealPersonAssetStatus(item.Status)
		if !ok {
			return BytePlusListAssetsResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace real person listed asset status invalid"))
		}
		items = append(items, BytePlusListedAsset{
			ID:          strings.TrimSpace(item.ID),
			Name:        strings.TrimSpace(item.Name),
			GroupID:     groupID,
			AssetType:   strings.TrimSpace(item.AssetType),
			Status:      status,
			Moderation:  item.Moderation,
			ProjectName: strings.TrimSpace(item.ProjectName),
			CreateTime:  createTime,
			UpdateTime:  updateTime,
		})
	}
	return BytePlusListAssetsResult{Items: items, TotalCount: response.Result.TotalCount, RequestID: tokenSpaceMaterialRequestID(response)}, nil
}

func (p tokenSpaceRealPersonProvider) DeleteAsset(ctx context.Context, upstreamAssetID string) (string, error) {
	upstreamAssetID = strings.TrimSpace(upstreamAssetID)
	if upstreamAssetID == "" {
		return "", tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace real person asset id missing"))
	}
	payload, err := common.Marshal(tokenSpaceMaterialGetRequest{ID: upstreamAssetID})
	if err != nil {
		return "", tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "DeleteAsset", payload)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(response.Result.ID) != upstreamAssetID {
		return "", tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace real person deleted asset id mismatch"))
	}
	return tokenSpaceMaterialRequestID(response), nil
}

func tokenSpaceRealPersonAssetStatus(status string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case strings.ToLower(model.BytePlusAssetStatusActive):
		return model.BytePlusAssetStatusActive, true
	case strings.ToLower("Pending"), strings.ToLower(model.BytePlusAssetStatusProcessing):
		return model.BytePlusAssetStatusProcessing, true
	case strings.ToLower(model.BytePlusAssetStatusFailed):
		return model.BytePlusAssetStatusFailed, true
	default:
		return "", false
	}
}

func tokenSpaceRealPersonTimestamp(value string) (int64, error) {
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(value))
	if err != nil {
		return 0, errors.New("tokenspace real person asset timestamp invalid")
	}
	return parsed.Unix(), nil
}
