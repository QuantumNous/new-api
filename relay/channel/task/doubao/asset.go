package doubao

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

const (
	assetServiceName = "ark"
	assetAPIVersion  = "2024-01-01"
)

// ============================
// Asset API Request / Response
// ============================

type AssetFilter struct {
	GroupIds  []string `json:"GroupIds,omitempty"`
	GroupType string   `json:"GroupType" example:"AIGC"` // 可选，留空使用默认值(AIGC)
	Statuses  []string `json:"Statuses,omitempty"`
	Name      string   `json:"Name,omitempty"`
}

type ListAssetsRequest struct {
	Filter      *AssetFilter `json:"Filter,omitempty"`
	PageNumber  int64        `json:"PageNumber"`
	PageSize    int64        `json:"PageSize"`
	SortBy      string       `json:"SortBy,omitempty"`
	SortOrder   string       `json:"SortOrder,omitempty"`
	ProjectName string       `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

type AssetError struct {
	Code    string `json:"Code,omitempty"`
	Message string `json:"Message,omitempty"`
}

type AssetItem struct {
	Id          string     `json:"Id"`
	Name        string     `json:"Name"`
	URL         string     `json:"URL"`
	GroupId     string     `json:"GroupId"`
	AssetType   string     `json:"AssetType" example:"Image" enums:"Image,Video,Audio"` // 素材类型：Image=图像, Video=视频, Audio=音频
	Status      string     `json:"Status"`
	Error       AssetError `json:"Error,omitempty"`
	ProjectName string     `json:"ProjectName"`
	CreateTime  string     `json:"CreateTime"`
	UpdateTime  string     `json:"UpdateTime"`
}

type ListAssetsResponse struct {
	Items      []AssetItem `json:"Items"`
	TotalCount int64       `json:"TotalCount"`
	PageNumber int64       `json:"PageNumber"`
	PageSize   int64       `json:"PageSize"`
}

// ============================
// Credential helpers
// ============================

// getVolcAKSK reads Volcengine AK/SK from system settings (options table).
func getVolcAKSK() (accessKey, secretKey string, err error) {
	cfg := &system_setting.VolcAssetConfig
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return "", "", fmt.Errorf("VolcAssetConfig access_key or secret_key is not configured in system settings")
	}
	return cfg.AccessKey, cfg.SecretKey, nil
}

// applyDefaults fills empty ProjectName / GroupId / GroupType with system defaults.
func applyDefaults(projectName, groupId, groupType *string) {
	cfg := &system_setting.VolcAssetConfig
	if projectName != nil && *projectName == "" {
		*projectName = cfg.ProjectName
	}
	if groupId != nil && *groupId == "" {
		*groupId = cfg.GroupId
	}
	if groupType != nil && *groupType == "" {
		*groupType = cfg.GetGroupType()
	}
}

// ============================
// Volcengine HMAC-SHA256 signing
// ============================

func signVolcengineRequest(req *http.Request, bodyBytes []byte, accessKey, secretKey string) {
	hexPayloadHash := hex.EncodeToString(common.Sha256Raw(bodyBytes))

	t := time.Now().UTC()
	xDate := t.Format("20060102T150405Z")
	shortDate := t.Format("20060102")

	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("X-Date", xDate)
	req.Header.Set("X-Content-Sha256", hexPayloadHash)

	// Canonical query string
	queryParams := req.URL.Query()
	sortedKeys := make([]string, 0, len(queryParams))
	for k := range queryParams {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)
	var queryParts []string
	for _, k := range sortedKeys {
		values := queryParams[k]
		sort.Strings(values)
		for _, v := range values {
			queryParts = append(queryParts, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(v)))
		}
	}
	canonicalQueryString := strings.Join(queryParts, "&")

	// Canonical headers
	headersToSign := map[string]string{
		"host":             req.URL.Host,
		"x-date":           xDate,
		"x-content-sha256": hexPayloadHash,
	}
	if req.Header.Get("Content-Type") != "" {
		headersToSign["content-type"] = req.Header.Get("Content-Type")
	}

	var signedHeaderKeys []string
	for k := range headersToSign {
		signedHeaderKeys = append(signedHeaderKeys, k)
	}
	sort.Strings(signedHeaderKeys)

	var canonicalHeaders strings.Builder
	for _, k := range signedHeaderKeys {
		canonicalHeaders.WriteString(k)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(headersToSign[k]))
		canonicalHeaders.WriteString("\n")
	}
	signedHeaders := strings.Join(signedHeaderKeys, ";")

	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		req.Method,
		req.URL.Path,
		canonicalQueryString,
		canonicalHeaders.String(),
		signedHeaders,
		hexPayloadHash,
	)

	hexHashedCanonicalRequest := hex.EncodeToString(common.Sha256Raw([]byte(canonicalRequest)))

	region := system_setting.VolcAssetConfig.GetRegion()
	credentialScope := fmt.Sprintf("%s/%s/%s/request", shortDate, region, assetServiceName)
	stringToSign := fmt.Sprintf("HMAC-SHA256\n%s\n%s\n%s",
		xDate,
		credentialScope,
		hexHashedCanonicalRequest,
	)

	kDate := common.HmacSha256Raw([]byte(shortDate), []byte(secretKey))
	kRegion := common.HmacSha256Raw([]byte(region), kDate)
	kService := common.HmacSha256Raw([]byte(assetServiceName), kRegion)
	kSigning := common.HmacSha256Raw([]byte("request"), kService)
	signature := hex.EncodeToString(common.HmacSha256Raw([]byte(stringToSign), kSigning))

	authorization := fmt.Sprintf("HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		accessKey,
		credentialScope,
		signedHeaders,
		signature,
	)
	req.Header.Set("Authorization", authorization)
}

func filterEmptyStrings(s []string) []string {
	var result []string
	for _, v := range s {
		if v != "" {
			result = append(result, v)
		}
	}
	return result
}

// ============================
// Proxy handlers
// ============================

// doAssetAPICall is the common upstream call logic for all Asset API actions.
func doAssetAPICall(c *gin.Context, action string, body []byte) {
	accessKey, secretKey, err := getVolcAKSK()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upstreamURL := fmt.Sprintf("%s/?Action=%s&Version=%s", system_setting.VolcAssetConfig.GetBaseURL(), action, assetAPIVersion)

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, upstreamURL, bytes.NewBuffer(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create upstream request: %v", err)})
		return
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json")

	signVolcengineRequest(req, body, accessKey, secretKey)

	client, err := service.GetHttpClientWithProxy("")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create http client: %v", err)})
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("upstream request failed: %v", err)})
		return
	}
	defer resp.Body.Close()

	const maxRespSize = 10 << 20 // 10MB
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxRespSize))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to read upstream response"})
		return
	}

	var envelope struct {
		ResponseMetadata struct {
			Error struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"Error"`
		} `json:"ResponseMetadata"`
		Result json.RawMessage `json:"Result"`
	}
	if err := common.Unmarshal(respBody, &envelope); err != nil {
		c.Data(resp.StatusCode, "application/json", respBody)
		return
	}

	if envelope.ResponseMetadata.Error.Code != "" {
		c.JSON(resp.StatusCode, gin.H{
			"error": gin.H{
				"code":    envelope.ResponseMetadata.Error.Code,
				"message": envelope.ResponseMetadata.Error.Message,
			},
		})
		return
	}

	if len(envelope.Result) > 0 {
		c.Data(http.StatusOK, "application/json", envelope.Result)
		return
	}

	c.Data(resp.StatusCode, "application/json", respBody)
}

// HandleListAssets proxies a ListAssets request to the Doubao Asset API.
func HandleListAssets(c *gin.Context) {
	var listReq ListAssetsRequest
	if err := common.UnmarshalBodyReusable(c, &listReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	if listReq.Filter == nil {
		listReq.Filter = &AssetFilter{}
	}
	listReq.Filter.GroupIds = filterEmptyStrings(listReq.Filter.GroupIds)
	listReq.Filter.Statuses = filterEmptyStrings(listReq.Filter.Statuses)
	applyDefaults(&listReq.ProjectName, nil, &listReq.Filter.GroupType)

	body, err := common.Marshal(listReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}

	doAssetAPICall(c, "ListAssets", body)
}

// GetAssetRequest is the request for GetAsset API.
type GetAssetRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

// HandleGetAsset proxies a GetAsset request to the Doubao Asset API.
func HandleGetAsset(c *gin.Context) {
	var req GetAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	applyDefaults(&req.ProjectName, nil, nil)

	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "GetAsset", body)
}

// ============================
// CreateAsset
// ============================

type CreateAssetRequest struct {
	GroupId     string `json:"GroupId"` // 可选，留空使用默认值
	URL         string `json:"URL"`
	Name        string `json:"Name,omitempty"`
	AssetType   string `json:"AssetType" example:"Image" enums:"Image,Video,Audio"` // 素材类型：Image=图像, Video=视频, Audio=音频
	ProjectName string `json:"ProjectName,omitempty"`                               // 可选，留空使用默认值
}

func HandleCreateAsset(c *gin.Context) {
	var req CreateAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	applyDefaults(&req.ProjectName, &req.GroupId, nil)
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "CreateAsset", body)
}

// ============================
// UpdateAsset
// ============================

type UpdateAssetRequest struct {
	Id          string `json:"Id"`
	Name        string `json:"Name,omitempty"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleUpdateAsset(c *gin.Context) {
	var req UpdateAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	applyDefaults(&req.ProjectName, nil, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "UpdateAsset", body)
}

// ============================
// DeleteAsset
// ============================

type DeleteAssetRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleDeleteAsset(c *gin.Context) {
	var req DeleteAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	applyDefaults(&req.ProjectName, nil, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "DeleteAsset", body)
}

// ============================
// CreateAssetGroup
// ============================

type CreateAssetGroupRequest struct {
	Name        string `json:"Name"`
	Description string `json:"Description,omitempty"`
	GroupType   string `json:"GroupType,omitempty" example:"AIGC"` // 可选，留空使用默认值(AIGC)
	ProjectName string `json:"ProjectName,omitempty"`              // 可选，留空使用默认值
}

func HandleCreateAssetGroup(c *gin.Context) {
	var req CreateAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	applyDefaults(&req.ProjectName, nil, &req.GroupType)
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "CreateAssetGroup", body)
}

// ============================
// ListAssetGroups
// ============================

type AssetGroupFilter struct {
	Name      string   `json:"Name,omitempty"`
	GroupIds  []string `json:"GroupIds,omitempty"`
	GroupType string   `json:"GroupType" example:"AIGC"` // 可选，留空使用默认值(AIGC)
}

type ListAssetGroupsRequest struct {
	Filter      *AssetGroupFilter `json:"Filter,omitempty"`
	PageNumber  int64             `json:"PageNumber"`
	PageSize    int64             `json:"PageSize"`
	SortBy      string            `json:"SortBy,omitempty"`
	SortOrder   string            `json:"SortOrder,omitempty"`
	ProjectName string            `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

type AssetGroupItem struct {
	Id          string `json:"Id"`
	Name        string `json:"Name"`
	Description string `json:"Description"`
	GroupType   string `json:"GroupType" example:"AIGC"`
	ProjectName string `json:"ProjectName"`
	CreateTime  string `json:"CreateTime"`
	UpdateTime  string `json:"UpdateTime"`
}

type ListAssetGroupsResponse struct {
	Items      []AssetGroupItem `json:"Items"`
	TotalCount int64            `json:"TotalCount"`
	PageNumber int64            `json:"PageNumber"`
	PageSize   int64            `json:"PageSize"`
}

func HandleListAssetGroups(c *gin.Context) {
	var req ListAssetGroupsRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	if req.Filter == nil {
		req.Filter = &AssetGroupFilter{}
	}
	req.Filter.GroupIds = filterEmptyStrings(req.Filter.GroupIds)
	applyDefaults(&req.ProjectName, nil, &req.Filter.GroupType)
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "ListAssetGroups", body)
}

// ============================
// GetAssetGroup
// ============================

type GetAssetGroupRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleGetAssetGroup(c *gin.Context) {
	var req GetAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	applyDefaults(&req.ProjectName, nil, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "GetAssetGroup", body)
}

// ============================
// UpdateAssetGroup
// ============================

type UpdateAssetGroupRequest struct {
	Id          string `json:"Id"`
	Name        string `json:"Name,omitempty"`
	Description string `json:"Description,omitempty"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleUpdateAssetGroup(c *gin.Context) {
	var req UpdateAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	applyDefaults(&req.ProjectName, nil, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	doAssetAPICall(c, "UpdateAssetGroup", body)
}
