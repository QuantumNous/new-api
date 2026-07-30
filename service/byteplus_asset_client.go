package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/volcengineauth"
)

const (
	bytePlusAssetEndpoint         = "https://ark.ap-southeast-1.byteplusapi.com"
	bytePlusAssetAPIVersion       = "2024-01-01"
	bytePlusAssetRegion           = "ap-southeast-1"
	bytePlusAssetService          = "ark"
	bytePlusAssetResponseMaxBytes = 1 << 20
	bytePlusAssetRequestTimeout   = 30 * time.Second
)

type BytePlusAssetClient struct {
	httpClient     *http.Client
	endpoint       string
	now            func() time.Time
	requestTimeout time.Duration
}

type BytePlusCreateAssetRequest struct {
	GroupID            string
	URL                string
	AssetType          string
	Name               string
	ModerationStrategy string
}

type BytePlusAssetStatus struct {
	UpstreamAssetID string
	Status          string
	RequestID       string
	ErrorMessage    string
}

type bytePlusAssetResponse struct {
	ResponseMetadata bytePlusResponseMetadata `json:"ResponseMetadata"`
	Result           bytePlusAssetResult      `json:"Result"`
}

type bytePlusResponseMetadata struct {
	RequestID string                `json:"RequestId"`
	Error     bytePlusResponseError `json:"Error"`
}

type bytePlusResponseError struct {
	Code    string `json:"Code"`
	Message string `json:"Message"`
}

type bytePlusAssetResult struct {
	ID     string                 `json:"Id"`
	Status string                 `json:"Status"`
	Error  bytePlusAssetResultErr `json:"Error"`
}

type bytePlusAssetResultErr struct {
	Code    string `json:"Code"`
	Message string `json:"Message"`
}

func NewBytePlusAssetClient(httpClient *http.Client, endpoint string) *BytePlusAssetClient {
	if httpClient == nil {
		httpClient = GetHttpClient()
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = bytePlusAssetEndpoint
	}
	return &BytePlusAssetClient{
		httpClient:     httpClient,
		endpoint:       strings.TrimRight(endpoint, "/"),
		requestTimeout: bytePlusAssetRequestTimeout,
	}
}

func (c *BytePlusAssetClient) CreateAssetGroup(ctx context.Context, creds BytePlusCredentials, name string) (string, string, error) {
	if err := creds.ValidateAssets(); err != nil {
		return "", "", err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return "", "", errors.New("byteplus asset group name is required")
	}
	payload := map[string]string{
		"Name":        name,
		"Description": "Flatkey managed virtual portrait assets",
		"GroupType":   "AIGC",
		"ProjectName": creds.ProjectName,
	}
	var resp bytePlusAssetResponse
	if err := c.do(ctx, creds, "CreateAssetGroup", payload, &resp); err != nil {
		return "", "", err
	}
	if strings.TrimSpace(resp.Result.ID) == "" {
		return "", resp.ResponseMetadata.RequestID, upstreamAssetErr("missing result", resp.ResponseMetadata.RequestID)
	}
	return resp.Result.ID, resp.ResponseMetadata.RequestID, nil
}

func (c *BytePlusAssetClient) CreateAsset(ctx context.Context, creds BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error) {
	if err := creds.ValidateAssets(); err != nil {
		return "", "", err
	}
	request.AssetType = strings.TrimSpace(request.AssetType)
	switch request.AssetType {
	case "Image", "Video", "Audio":
	default:
		return "", "", errors.New("invalid byteplus asset type")
	}
	strategy := strings.TrimSpace(request.ModerationStrategy)
	if strategy == "" {
		strategy = "Default"
	}
	switch strategy {
	case "Default", "Skip":
	default:
		return "", "", errors.New("invalid byteplus moderation strategy")
	}
	request.GroupID = strings.TrimSpace(request.GroupID)
	if request.GroupID == "" {
		return "", "", errors.New("byteplus asset group id is required")
	}
	request.URL = strings.TrimSpace(request.URL)
	if err := validateBytePlusAssetSourceURL(request.URL); err != nil {
		return "", "", err
	}
	request.Name = strings.TrimSpace(request.Name)
	payload := map[string]any{
		"GroupId":   request.GroupID,
		"URL":       request.URL,
		"AssetType": request.AssetType,
		"Moderation": map[string]string{
			"Strategy": strategy,
		},
		"ProjectName": creds.ProjectName,
	}
	if strings.TrimSpace(request.Name) != "" {
		payload["Name"] = request.Name
	}
	var resp bytePlusAssetResponse
	if err := c.do(ctx, creds, "CreateAsset", payload, &resp); err != nil {
		return "", "", err
	}
	if strings.TrimSpace(resp.Result.ID) == "" {
		return "", resp.ResponseMetadata.RequestID, upstreamAssetErr("missing result", resp.ResponseMetadata.RequestID)
	}
	return resp.Result.ID, resp.ResponseMetadata.RequestID, nil
}

func (c *BytePlusAssetClient) GetAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (BytePlusAssetStatus, error) {
	if err := creds.ValidateAssets(); err != nil {
		return BytePlusAssetStatus{}, err
	}
	upstreamAssetID = strings.TrimSpace(upstreamAssetID)
	if upstreamAssetID == "" {
		return BytePlusAssetStatus{}, errors.New("byteplus upstream asset id is required")
	}
	payload := map[string]string{
		"Id":          upstreamAssetID,
		"ProjectName": creds.ProjectName,
	}
	var resp bytePlusAssetResponse
	if err := c.do(ctx, creds, "GetAsset", payload, &resp); err != nil {
		return BytePlusAssetStatus{}, err
	}
	resultID := strings.TrimSpace(resp.Result.ID)
	if resultID == "" || resultID != upstreamAssetID {
		return BytePlusAssetStatus{}, upstreamAssetErr("unexpected result", resp.ResponseMetadata.RequestID)
	}
	switch resp.Result.Status {
	case "Processing", "Active":
	case "Failed":
	default:
		return BytePlusAssetStatus{}, upstreamAssetErr("unknown status", resp.ResponseMetadata.RequestID)
	}
	return BytePlusAssetStatus{
		UpstreamAssetID: resultID,
		Status:          resp.Result.Status,
		RequestID:       resp.ResponseMetadata.RequestID,
		ErrorMessage:    sanitizedAssetResultError(resp.Result),
	}, nil
}

func (c *BytePlusAssetClient) do(ctx context.Context, creds BytePlusCredentials, action string, payload any, out *bytePlusAssetResponse) error {
	if ctx == nil {
		return errors.New("byteplus asset request context is required")
	}
	if c.requestTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.requestTimeout)
		defer cancel()
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	endpoint, err := c.actionURL(action)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	signer := volcengineauth.Signer{
		AccessKeyID:     creds.AccessKeyID,
		SecretAccessKey: creds.SecretAccessKey,
		Region:          bytePlusAssetRegion,
		Service:         bytePlusAssetService,
		Now:             c.now,
	}
	if err := signer.Sign(req, body); err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, bytePlusAssetResponseMaxBytes+1))
	if err != nil {
		return err
	}
	if len(raw) > bytePlusAssetResponseMaxBytes {
		return upstreamAssetErr("response too large", "")
	}
	var envelope bytePlusAssetResponse
	if len(bytes.TrimSpace(raw)) > 0 {
		if err := common.Unmarshal(raw, &envelope); err != nil {
			return upstreamAssetErr("invalid response", "")
		}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return upstreamAssetErr("upstream error", envelope.ResponseMetadata.RequestID)
	}
	if envelope.ResponseMetadata.Error.Code != "" || envelope.ResponseMetadata.Error.Message != "" {
		return upstreamAssetErr("upstream error", envelope.ResponseMetadata.RequestID)
	}
	*out = envelope
	return nil
}

func (c *BytePlusAssetClient) actionURL(action string) (string, error) {
	parsed, err := url.Parse(c.endpoint)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	query.Set("Action", action)
	query.Set("Version", bytePlusAssetAPIVersion)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func upstreamAssetErr(reason, requestID string) error {
	if strings.TrimSpace(requestID) == "" {
		return fmt.Errorf("byteplus asset %s", reason)
	}
	return fmt.Errorf("byteplus asset %s (request_id=%s)", reason, requestID)
}

func sanitizedAssetResultError(result bytePlusAssetResult) string {
	if result.Status != "Failed" {
		return ""
	}
	if strings.TrimSpace(result.Error.Code) == "" && strings.TrimSpace(result.Error.Message) == "" {
		return "upstream asset failed"
	}
	return "upstream asset failed"
}
