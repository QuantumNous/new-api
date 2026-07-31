package service

import (
	"context"
	"errors"
	"strings"
)

type BytePlusVisualValidationSession struct {
	BytedToken  string
	H5Link      string
	CallbackURL string
	RequestID   string
}

type BytePlusVisualValidationResult struct {
	GroupID   string
	RequestID string
}

type BytePlusListAssetsRequest struct {
	GroupIDs   []string
	Statuses   []string
	Name       string
	PageNumber int
	PageSize   int
	SortBy     string
	SortOrder  string
}

type BytePlusListedAsset struct {
	ID          string
	Name        string
	GroupID     string
	AssetType   string
	Status      string
	Moderation  map[string]any
	ProjectName string
	CreateTime  int64
	UpdateTime  int64
}

type BytePlusListAssetsResult struct {
	Items      []BytePlusListedAsset
	TotalCount int
	RequestID  string
}

type bytePlusVisualValidationSessionResponse struct {
	ResponseMetadata bytePlusResponseMetadata               `json:"ResponseMetadata"`
	Result           bytePlusVisualValidationSessionPayload `json:"Result"`
}

type bytePlusVisualValidationSessionPayload struct {
	BytedToken  string `json:"BytedToken"`
	H5Link      string `json:"H5Link"`
	CallbackURL string `json:"CallbackURL"`
}

type bytePlusVisualValidationResultResponse struct {
	ResponseMetadata bytePlusResponseMetadata              `json:"ResponseMetadata"`
	Result           bytePlusVisualValidationResultPayload `json:"Result"`
}

type bytePlusVisualValidationResultPayload struct {
	GroupID string `json:"GroupId"`
}

type bytePlusListAssetsResponse struct {
	ResponseMetadata bytePlusResponseMetadata     `json:"ResponseMetadata"`
	Result           bytePlusListAssetsResultBody `json:"Result"`
}

type bytePlusListAssetsResultBody struct {
	Items      []BytePlusListedAsset `json:"Items"`
	TotalCount int                   `json:"TotalCount"`
}

type bytePlusDeleteAssetResponse struct {
	ResponseMetadata bytePlusResponseMetadata `json:"ResponseMetadata"`
	Result           map[string]any           `json:"Result"`
}

func (c *BytePlusAssetClient) CreateVisualValidateSession(ctx context.Context, creds BytePlusCredentials, callbackURL string) (BytePlusVisualValidationSession, error) {
	if err := creds.ValidateAssets(); err != nil {
		return BytePlusVisualValidationSession{}, err
	}
	callbackURL = strings.TrimSpace(callbackURL)
	if callbackURL == "" {
		return BytePlusVisualValidationSession{}, errors.New("byteplus callback url is required")
	}
	payload := map[string]string{
		"CallbackURL": callbackURL,
		"ProjectName": creds.ProjectName,
	}
	var resp bytePlusVisualValidationSessionResponse
	if err := c.do(ctx, creds, "CreateVisualValidateSession", payload, &resp); err != nil {
		return BytePlusVisualValidationSession{}, err
	}
	bytedToken := strings.TrimSpace(resp.Result.BytedToken)
	h5Link := strings.TrimSpace(resp.Result.H5Link)
	if bytedToken == "" || h5Link == "" {
		return BytePlusVisualValidationSession{}, upstreamAssetErr("missing result", resp.ResponseMetadata.RequestID)
	}
	return BytePlusVisualValidationSession{
		BytedToken:  bytedToken,
		H5Link:      h5Link,
		CallbackURL: strings.TrimSpace(resp.Result.CallbackURL),
		RequestID:   resp.ResponseMetadata.RequestID,
	}, nil
}

func (c *BytePlusAssetClient) GetVisualValidateResult(ctx context.Context, creds BytePlusCredentials, bytedToken string) (BytePlusVisualValidationResult, error) {
	if err := creds.ValidateAssets(); err != nil {
		return BytePlusVisualValidationResult{}, err
	}
	bytedToken = strings.TrimSpace(bytedToken)
	if bytedToken == "" {
		return BytePlusVisualValidationResult{}, errors.New("byteplus byted token is required")
	}
	payload := map[string]string{
		"BytedToken":  bytedToken,
		"ProjectName": creds.ProjectName,
	}
	var resp bytePlusVisualValidationResultResponse
	if err := c.do(ctx, creds, "GetVisualValidateResult", payload, &resp); err != nil {
		return BytePlusVisualValidationResult{}, err
	}
	groupID := strings.TrimSpace(resp.Result.GroupID)
	if groupID == "" {
		return BytePlusVisualValidationResult{}, upstreamAssetErr("missing result", resp.ResponseMetadata.RequestID)
	}
	return BytePlusVisualValidationResult{GroupID: groupID, RequestID: resp.ResponseMetadata.RequestID}, nil
}

func (c *BytePlusAssetClient) ListAssets(ctx context.Context, creds BytePlusCredentials, request BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	if err := creds.ValidateAssets(); err != nil {
		return BytePlusListAssetsResult{}, err
	}
	payload := map[string]any{
		"Filter": map[string]any{
			"GroupIds":  request.GroupIDs,
			"GroupType": "LivenessFace",
			"Statuses":  request.Statuses,
			"Name":      request.Name,
		},
		"PageNumber":  request.PageNumber,
		"PageSize":    request.PageSize,
		"SortBy":      request.SortBy,
		"SortOrder":   request.SortOrder,
		"ProjectName": creds.ProjectName,
	}
	var resp bytePlusListAssetsResponse
	if err := c.do(ctx, creds, "ListAssets", payload, &resp); err != nil {
		return BytePlusListAssetsResult{}, err
	}
	return BytePlusListAssetsResult{
		Items:      resp.Result.Items,
		TotalCount: resp.Result.TotalCount,
		RequestID:  resp.ResponseMetadata.RequestID,
	}, nil
}

func (c *BytePlusAssetClient) DeleteAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (string, error) {
	if err := creds.ValidateAssets(); err != nil {
		return "", err
	}
	upstreamAssetID = strings.TrimSpace(upstreamAssetID)
	if upstreamAssetID == "" {
		return "", errors.New("byteplus upstream asset id is required")
	}
	payload := map[string]string{
		"Id":          upstreamAssetID,
		"ProjectName": creds.ProjectName,
	}
	var resp bytePlusDeleteAssetResponse
	if err := c.do(ctx, creds, "DeleteAsset", payload, &resp); err != nil {
		return "", err
	}
	return resp.ResponseMetadata.RequestID, nil
}
