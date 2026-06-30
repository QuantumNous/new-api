package doubao

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
// Volcengine HMAC-SHA256 signing
// ============================

func signVolcengineRequest(req *http.Request, bodyBytes []byte, accessKey, secretKey, region string) {
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
// Upstream transport
// ============================

type assetAPIError struct {
	Code    string
	Message string
}

// ============================
// Billing + logging
// ============================

// proxyAssetCall 执行一次面向用户的资产调用：先做额度门槛校验，成功后扣费并记日志。
func proxyAssetCall(c *gin.Context, ob system_setting.AssetOutbound, action string, body []byte) {
	userId := c.GetInt("id")
	cost := system_setting.VolcAssetConfig.ActionPrice(action)
	if cost > 0 && !ensureAssetQuota(c, userId, cost) {
		return
	}

	result, apiErr, status, err := callAssetAPI(c.Request.Context(), ob, action, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if apiErr != nil {
		c.JSON(status, gin.H{"error": gin.H{"code": apiErr.Code, "message": apiErr.Message}})
		return
	}

	settleAssetBilling(c, action, cost, result)
	c.Data(status, "application/json", result)
}

// ensureAssetQuota 校验用户与令牌额度是否足够支付一次操作，不足时直接写 402 响应。
func ensureAssetQuota(c *gin.Context, userId, cost int) bool {
	userQuota := common.GetContextKeyInt(c, constant.ContextKeyUserQuota)
	if userQuota < cost {
		if fresh, err := model.GetUserQuota(userId, false); err == nil {
			userQuota = fresh
		}
	}
	if userQuota < cost {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "insufficient user quota for asset operation"})
		return false
	}
	if !c.GetBool("token_unlimited_quota") && c.GetInt("token_quota") < cost {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "insufficient token quota for asset operation"})
		return false
	}
	return true
}

// settleAssetBilling 在调用成功后扣减用户与令牌额度（cost>0 时），并写入消费日志用于审计。
func settleAssetBilling(c *gin.Context, action string, cost int, result []byte) {
	userId := c.GetInt("id")
	if cost > 0 {
		tokenId := c.GetInt("token_id")
		_ = model.DecreaseUserQuota(userId, cost, false)
		if !c.GetBool("token_unlimited_quota") && tokenId > 0 {
			_ = model.DecreaseTokenQuota(tokenId, c.GetString("token_key"), cost)
		}
		model.UpdateUserUsedQuotaAndRequestCount(userId, cost)
	}

	other := map[string]interface{}{
		"action":       action,
		"request_path": c.Request.URL.Path,
	}
	if assetId := extractAssetId(result); assetId != "" {
		other["asset_id"] = assetId
	}
	model.RecordConsumeLog(c, userId, model.RecordConsumeLogParams{
		ModelName: "volc-asset/" + action,
		TokenName: c.GetString("token_name"),
		TokenId:   c.GetInt("token_id"),
		Quota:     cost,
		Content:   fmt.Sprintf("Volcengine asset operation: %s", action),
		Group:     common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		Other:     other,
	})
}

func extractAssetId(result []byte) string {
	if len(result) == 0 {
		return ""
	}
	var item struct {
		Id string `json:"Id"`
	}
	if err := common.Unmarshal(result, &item); err != nil {
		return ""
	}
	return item.Id
}

// ============================
// Per-user isolation
// ============================

// assetScope 是某个用户在某个出口上的资产隔离边界：其全部资产读写都被限定在 groupId 内。
type assetScope struct {
	userId      int
	outbound    system_setting.AssetOutbound
	projectName string
	groupId     string
	groupType   string
}

// resolveAssetOutbound 依据客户端选择头(默认 X-Asset-Outbound)、默认出口与 failover 解析出一个可用出口。
// 解析失败时直接写响应。
func resolveAssetOutbound(c *gin.Context) (system_setting.AssetOutbound, bool) {
	cfg := &system_setting.VolcAssetConfig
	selector := strings.TrimSpace(c.GetHeader(cfg.GetOutboundSelectorHeader()))
	if selector == "" {
		selector = strings.TrimSpace(c.Query("outbound"))
	}
	candidates := cfg.ResolveOutboundCandidates(selector)
	if len(candidates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no configured asset outbound available"})
		return system_setting.AssetOutbound{}, false
	}
	return candidates[0], true
}

// resolveAssetScope 校验配置、解析出口并确保调用者在该出口拥有已开通的专属分组，返回其隔离边界。
func resolveAssetScope(c *gin.Context) (*assetScope, bool) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}
	ob, ok := resolveAssetOutbound(c)
	if !ok {
		return nil, false
	}
	groupId, groupType, err := ensureUserAssetGroup(c, ob, userId)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed to provision user asset group: %v", err)})
		return nil, false
	}
	return &assetScope{userId: userId, outbound: ob, projectName: ob.ProjectName, groupId: groupId, groupType: groupType}, true
}

// ensureUserAssetGroup 返回用户在该出口专属分组的 Id 与 GroupType，必要时在上游开通并持久化映射。
// 映射以 (用户, 出口Id) 为键：不同出口对应不同上游，各自拥有独立分组。
// 当出口/project 与映射记录不一致时会重新开通，避免使用失效分组。
// GroupType 取自映射记录（即分组创建时的类型），以免后续配置变更导致 List 过滤与实际分组错位。
func ensureUserAssetGroup(c *gin.Context, ob system_setting.AssetOutbound, userId int) (string, string, error) {
	outboundId := ob.EffectiveId()
	if binding, err := model.GetVolcAssetUserGroupBinding(userId, outboundId); err == nil {
		if binding.GroupId != "" && binding.ProjectName == ob.ProjectName {
			return binding.GroupId, binding.GroupType, nil
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", "", err
	}

	groupType := ob.GetGroupType()
	groupId, err := provisionUserAssetGroup(c, ob, userId)
	if err != nil {
		return "", "", err
	}
	if err := model.SaveVolcAssetUserGroupBinding(userId, model.AssetGroupBinding{
		OutboundId:  outboundId,
		Format:      ob.EffectiveFormat(),
		ProjectName: ob.ProjectName,
		GroupId:     groupId,
		GroupType:   groupType,
	}); err != nil {
		logger.LogWarn(c, "failed to persist volc asset user group mapping: "+err.Error())
	}
	return groupId, groupType, nil
}

// provisionUserAssetGroup 幂等地为用户在该出口开通专属分组并返回其 Id。
func provisionUserAssetGroup(c *gin.Context, ob system_setting.AssetOutbound, userId int) (string, error) {
	groupName := fmt.Sprintf("newapi-user-%d", userId)

	// 已存在则直接复用（映射丢失或重复开通时幂等）。
	if id, err := findAssetGroupIdByName(c.Request.Context(), ob, groupName); err == nil && id != "" {
		return id, nil
	}

	createBody, err := common.Marshal(CreateAssetGroupRequest{
		Name:        groupName,
		Description: fmt.Sprintf("Auto-managed personal asset group for new-api user %d", userId),
		GroupType:   ob.GetGroupType(),
		ProjectName: ob.ProjectName,
	})
	if err != nil {
		return "", err
	}
	result, apiErr, _, callErr := callAssetAPI(c.Request.Context(), ob, "CreateAssetGroup", createBody)
	if callErr != nil {
		return "", callErr
	}
	if apiErr != nil {
		// 可能因重名冲突失败，回退按名查找。
		if id, ferr := findAssetGroupIdByName(c.Request.Context(), ob, groupName); ferr == nil && id != "" {
			return id, nil
		}
		return "", fmt.Errorf("create asset group failed: %s %s", apiErr.Code, apiErr.Message)
	}

	if id := parseAssetGroupId(result); id != "" {
		return id, nil
	}
	if id, ferr := findAssetGroupIdByName(c.Request.Context(), ob, groupName); ferr == nil && id != "" {
		return id, nil
	}
	return "", errors.New("could not resolve created asset group id")
}

func findAssetGroupIdByName(ctx context.Context, ob system_setting.AssetOutbound, name string) (string, error) {
	body, err := common.Marshal(ListAssetGroupsRequest{
		Filter:      &AssetGroupFilter{Name: name, GroupType: ob.GetGroupType()},
		PageNumber:  1,
		PageSize:    50,
		ProjectName: ob.ProjectName,
	})
	if err != nil {
		return "", err
	}
	result, apiErr, _, callErr := callAssetAPI(ctx, ob, "ListAssetGroups", body)
	if callErr != nil {
		return "", callErr
	}
	if apiErr != nil {
		return "", fmt.Errorf("list asset groups failed: %s %s", apiErr.Code, apiErr.Message)
	}
	var resp ListAssetGroupsResponse
	if err := common.Unmarshal(result, &resp); err != nil {
		return "", err
	}
	for _, item := range resp.Items {
		if item.Name == name {
			return item.Id, nil
		}
	}
	return "", nil
}

func parseAssetGroupId(result []byte) string {
	if len(result) == 0 {
		return ""
	}
	var g struct {
		Id      string `json:"Id"`
		GroupId string `json:"GroupId"`
	}
	if err := common.Unmarshal(result, &g); err != nil {
		return ""
	}
	if g.Id != "" {
		return g.Id
	}
	return g.GroupId
}

// assetBelongsToScope 判断 GetAsset 结果中的资产是否归属调用者分组。
func assetBelongsToScope(result []byte, scope *assetScope) bool {
	var item AssetItem
	if err := common.Unmarshal(result, &item); err != nil {
		return false
	}
	return item.GroupId != "" && item.GroupId == scope.groupId
}

// verifyAssetOwnership 通过一次内部 GetAsset 校验资产归属当前用户，校验失败时直接写响应。
func verifyAssetOwnership(c *gin.Context, scope *assetScope, assetId string) bool {
	body, err := common.Marshal(GetAssetRequest{Id: assetId, ProjectName: scope.projectName})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal ownership check"})
		return false
	}
	result, apiErr, status, callErr := callAssetAPI(c.Request.Context(), scope.outbound, "GetAsset", body)
	if callErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": callErr.Error()})
		return false
	}
	if apiErr != nil {
		c.JSON(status, gin.H{"error": gin.H{"code": apiErr.Code, "message": apiErr.Message}})
		return false
	}
	if !assetBelongsToScope(result, scope) {
		c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
		return false
	}
	return true
}

// applyGroupDefaults 为分组管理接口（管理员）填充空的 ProjectName / GroupType（取自所选出口）。
func applyGroupDefaults(ob system_setting.AssetOutbound, projectName, groupType *string) {
	if projectName != nil && *projectName == "" {
		*projectName = ob.ProjectName
	}
	if groupType != nil && *groupType == "" {
		*groupType = ob.GetGroupType()
	}
}

// ============================
// Asset handlers (per-user isolated)
// ============================

// HandleListAssets 列出当前用户专属分组内的资产。
func HandleListAssets(c *gin.Context) {
	scope, ok := resolveAssetScope(c)
	if !ok {
		return
	}

	var listReq ListAssetsRequest
	if err := common.UnmarshalBodyReusable(c, &listReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	if listReq.Filter == nil {
		listReq.Filter = &AssetFilter{}
	}
	// 强制隔离：仅限定到调用者自己的分组与项目。
	listReq.Filter.GroupIds = []string{scope.groupId}
	listReq.Filter.GroupType = scope.groupType
	listReq.Filter.Statuses = filterEmptyStrings(listReq.Filter.Statuses)
	listReq.ProjectName = scope.projectName

	body, err := common.Marshal(listReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, scope.outbound, "ListAssets", body)
}

// GetAssetRequest is the request for GetAsset API.
type GetAssetRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

// HandleGetAsset 读取一个资产，并校验其归属当前用户。
func HandleGetAsset(c *gin.Context) {
	scope, ok := resolveAssetScope(c)
	if !ok {
		return
	}
	var req GetAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	req.ProjectName = scope.projectName

	cost := system_setting.VolcAssetConfig.ActionPrice("GetAsset")
	if cost > 0 && !ensureAssetQuota(c, scope.userId, cost) {
		return
	}

	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	result, apiErr, status, callErr := callAssetAPI(c.Request.Context(), scope.outbound, "GetAsset", body)
	if callErr != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": callErr.Error()})
		return
	}
	if apiErr != nil {
		c.JSON(status, gin.H{"error": gin.H{"code": apiErr.Code, "message": apiErr.Message}})
		return
	}
	if !assetBelongsToScope(result, scope) {
		c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
		return
	}
	settleAssetBilling(c, "GetAsset", cost, result)
	c.Data(status, "application/json", result)
}

// ============================
// CreateAsset
// ============================

type CreateAssetRequest struct {
	GroupId     string `json:"GroupId"` // 被服务端强制为用户专属分组
	URL         string `json:"URL"`
	Name        string `json:"Name,omitempty"`
	AssetType   string `json:"AssetType" example:"Image" enums:"Image,Video,Audio"` // 素材类型：Image=图像, Video=视频, Audio=音频
	ProjectName string `json:"ProjectName,omitempty"`                               // 可选，留空使用默认值
}

// HandleCreateAsset 在当前用户专属分组内创建资产。
func HandleCreateAsset(c *gin.Context) {
	scope, ok := resolveAssetScope(c)
	if !ok {
		return
	}
	var req CreateAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	// 强制隔离：落到调用者自己的分组与项目。
	req.GroupId = scope.groupId
	req.ProjectName = scope.projectName

	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, scope.outbound, "CreateAsset", body)
}

// ============================
// UpdateAsset
// ============================

type UpdateAssetRequest struct {
	Id          string `json:"Id"`
	Name        string `json:"Name,omitempty"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

// HandleUpdateAsset 更新一个资产，仅当其归属当前用户时允许。
func HandleUpdateAsset(c *gin.Context) {
	scope, ok := resolveAssetScope(c)
	if !ok {
		return
	}
	var req UpdateAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	req.ProjectName = scope.projectName
	if !verifyAssetOwnership(c, scope, req.Id) {
		return
	}

	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, scope.outbound, "UpdateAsset", body)
}

// ============================
// DeleteAsset
// ============================

type DeleteAssetRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

// HandleDeleteAsset 删除一个资产，仅当其归属当前用户时允许。
func HandleDeleteAsset(c *gin.Context) {
	scope, ok := resolveAssetScope(c)
	if !ok {
		return
	}
	var req DeleteAssetRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	req.ProjectName = scope.projectName
	if !verifyAssetOwnership(c, scope, req.Id) {
		return
	}

	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, scope.outbound, "DeleteAsset", body)
}

// ============================
// CreateAssetGroup (admin)
// ============================

type CreateAssetGroupRequest struct {
	Name        string `json:"Name"`
	Description string `json:"Description,omitempty"`
	GroupType   string `json:"GroupType,omitempty" example:"AIGC"` // 可选，留空使用默认值(AIGC)
	ProjectName string `json:"ProjectName,omitempty"`              // 可选，留空使用默认值
}

func HandleCreateAssetGroup(c *gin.Context) {
	ob, ok := resolveAssetOutbound(c)
	if !ok {
		return
	}
	var req CreateAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	applyGroupDefaults(ob, &req.ProjectName, &req.GroupType)
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, ob, "CreateAssetGroup", body)
}

// ============================
// ListAssetGroups (admin)
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
	ob, ok := resolveAssetOutbound(c)
	if !ok {
		return
	}
	var req ListAssetGroupsRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}

	if req.Filter == nil {
		req.Filter = &AssetGroupFilter{}
	}
	req.Filter.GroupIds = filterEmptyStrings(req.Filter.GroupIds)
	applyGroupDefaults(ob, &req.ProjectName, &req.Filter.GroupType)
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, ob, "ListAssetGroups", body)
}

// ============================
// GetAssetGroup (admin)
// ============================

type GetAssetGroupRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleGetAssetGroup(c *gin.Context) {
	ob, ok := resolveAssetOutbound(c)
	if !ok {
		return
	}
	var req GetAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	applyGroupDefaults(ob, &req.ProjectName, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, ob, "GetAssetGroup", body)
}

// ============================
// UpdateAssetGroup (admin)
// ============================

type UpdateAssetGroupRequest struct {
	Id          string `json:"Id"`
	Name        string `json:"Name,omitempty"`
	Description string `json:"Description,omitempty"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleUpdateAssetGroup(c *gin.Context) {
	ob, ok := resolveAssetOutbound(c)
	if !ok {
		return
	}
	var req UpdateAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	applyGroupDefaults(ob, &req.ProjectName, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, ob, "UpdateAssetGroup", body)
}

// ============================
// DeleteAssetGroup (admin)
// ============================

type DeleteAssetGroupRequest struct {
	Id          string `json:"Id"`
	ProjectName string `json:"ProjectName,omitempty"` // 可选，留空使用默认值
}

func HandleDeleteAssetGroup(c *gin.Context) {
	ob, ok := resolveAssetOutbound(c)
	if !ok {
		return
	}
	var req DeleteAssetGroupRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request body: %v", err)})
		return
	}
	applyGroupDefaults(ob, &req.ProjectName, nil)
	if req.Id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Id is required"})
		return
	}
	body, err := common.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal request"})
		return
	}
	proxyAssetCall(c, ob, "DeleteAssetGroup", body)
}
