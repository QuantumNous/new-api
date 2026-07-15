package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type SeedanceAssetError struct {
	Status  int
	Code    string
	Message string
}

func (e *SeedanceAssetError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

func newSeedanceErr(status int, code, message string) *SeedanceAssetError {
	return &SeedanceAssetError{Status: status, Code: code, Message: message}
}

type seedanceGateway struct {
	BaseURL   string
	APIKey    string
	ChannelId int
}

func resolveSeedanceGateway() (*seedanceGateway, error) {
	cfg := operation_setting.GetSeedanceAssetSetting()
	if cfg == nil || !cfg.Enabled || cfg.GatewayChannelId <= 0 {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 素材网关未配置或未启用")
	}
	ch, err := model.CacheGetChannel(cfg.GatewayChannelId)
	if err != nil || ch == nil {
		ch, err = model.GetChannelById(cfg.GatewayChannelId, true)
	}
	if err != nil || ch == nil {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 素材网关渠道不存在")
	}
	key, _, keyErr := ch.GetNextEnabledKey()
	if keyErr != nil || strings.TrimSpace(key) == "" {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 素材网关渠道无可用 Key")
	}
	base := strings.TrimSuffix(strings.TrimSpace(ch.GetBaseURL()), "/")
	if base == "" {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 素材网关渠道未配置 Base URL")
	}
	return &seedanceGateway{
		BaseURL:   base,
		APIKey:    strings.TrimSpace(key),
		ChannelId: ch.Id,
	}, nil
}

func seedanceGatewayDo(gw *seedanceGateway, method, path string, body any) (status int, raw map[string]any, err error) {
	var reader io.Reader
	if body != nil {
		b, mErr := common.Marshal(body)
		if mErr != nil {
			return 0, nil, mErr
		}
		reader = bytes.NewReader(b)
	}
	fullURL := gw.BaseURL + path
	req, err := http.NewRequest(method, fullURL, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+gw.APIKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return 0, nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", err.Error())
	}
	defer resp.Body.Close()
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	raw = map[string]any{}
	if len(respBytes) > 0 {
		_ = common.Unmarshal(respBytes, &raw)
	}
	return resp.StatusCode, raw, nil
}

// MaybeChargeSeedanceAssetOp 计费钩子（本期空实现）
func MaybeChargeSeedanceAssetOp(userId int, op string) error {
	_ = userId
	_ = op
	return nil
}

func pickString(values ...any) string {
	for _, v := range values {
		switch t := v.(type) {
		case string:
			if s := strings.TrimSpace(t); s != "" {
				return s
			}
		case fmt.Stringer:
			if s := strings.TrimSpace(t.String()); s != "" {
				return s
			}
		case float64:
			if t == float64(int64(t)) {
				return strconv.FormatInt(int64(t), 10)
			}
			return strconv.FormatFloat(t, 'f', -1, 64)
		case int:
			return strconv.Itoa(t)
		case int64:
			return strconv.FormatInt(t, 10)
		}
	}
	return ""
}

func mapGet(m map[string]any, keys ...string) any {
	if m == nil {
		return nil
	}
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			return v
		}
	}
	return nil
}

func asMap(v any) map[string]any {
	if v == nil {
		return nil
	}
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return nil
}

func upstreamFail(status int, raw map[string]any, fallback string) error {
	msg := pickString(mapGet(raw, "message"), mapGet(raw, "error"), fallback)
	code := pickString(mapGet(raw, "code"))
	if code == "" {
		code = "upstream_error"
	}
	if status < 400 {
		status = http.StatusBadGateway
	}
	return newSeedanceErr(status, code, msg)
}

func formatGroup(g *model.SeedanceAssetGroup) map[string]any {
	if g == nil {
		return nil
	}
	return map[string]any{
		"id":          g.Id,
		"group_id":    g.GroupId,
		"group_type":  g.GroupType,
		"group_name":  g.GroupName,
		"description": g.Description,
		"status":      g.Status,
		"created_at":  g.CreatedAt,
		"updated_at":  g.UpdatedAt,
	}
}

func formatAsset(a *model.SeedanceAsset) map[string]any {
	if a == nil {
		return nil
	}
	uri := a.AssetURI
	if uri == "" && a.AiccAssetId != "" {
		uri = "asset://" + a.AiccAssetId
	}
	return map[string]any{
		"id":             a.Id,
		"asset_id":       a.Id,
		"aicc_asset_id":  a.AiccAssetId,
		"aicc_group_id":  a.GroupId,
		"group_id":       a.GroupId,
		"filename":       a.Filename,
		"type":           a.Type,
		"status":         a.Status,
		"url":            a.URL,
		"asset_uri":      uri,
		"error_message":  a.ErrorMessage,
		"created_at":     a.CreatedAt,
		"updated_at":     a.UpdatedAt,
	}
}

// AssertGroupUsable 校验用户是否可使用该素材组（本人归属；空则表示默认组）
func AssertGroupUsable(userId int, groupId string) error {
	gid := strings.TrimSpace(groupId)
	if gid == "" {
		return nil
	}
	g, err := model.GetSeedanceAssetGroupByUserAndGroupID(userId, gid)
	if err != nil {
		return err
	}
	if g == nil {
		return newSeedanceErr(http.StatusForbidden, "group_forbidden", "素材组不存在或无权使用")
	}
	return nil
}

func CreateSeedanceAssetGroup(userId int, groupName, description, groupType string) (map[string]any, error) {
	if err := MaybeChargeSeedanceAssetOp(userId, "create_asset_group"); err != nil {
		return nil, err
	}
	gw, err := resolveSeedanceGateway()
	if err != nil {
		return nil, err
	}
	gt := strings.TrimSpace(groupType)
	if gt == "" {
		gt = model.SeedanceGroupTypeAIGC
	}
	if !strings.EqualFold(gt, model.SeedanceGroupTypeAIGC) {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_group_type", "仅支持创建 AIGC 素材组")
	}
	status, raw, err := seedanceGatewayDo(gw, http.MethodPost, "/api/seedance/asset-groups", map[string]any{
		"group_name": groupName,
		"description": description,
		"group_type":  model.SeedanceGroupTypeAIGC,
	})
	if err != nil {
		return nil, err
	}
	if status >= 400 || raw["success"] == false {
		return nil, upstreamFail(status, raw, "创建素材组失败")
	}
	data := asMap(raw["data"])
	groupId := pickString(mapGet(data, "group_id", "groupId"))
	if groupId == "" {
		return nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", "上游未返回 group_id")
	}
	g := &model.SeedanceAssetGroup{
		UserId:      userId,
		GroupId:     groupId,
		GroupType:   model.SeedanceGroupTypeAIGC,
		GroupName:   pickString(mapGet(data, "group_name", "groupName"), groupName),
		Description: pickString(mapGet(data, "description"), description),
		Status:      model.SeedanceGroupStatusActive,
		ChannelId:   gw.ChannelId,
	}
	if err := model.UpsertSeedanceAssetGroup(g); err != nil {
		return nil, err
	}
	local, _ := model.GetSeedanceAssetGroupByUserAndGroupID(userId, groupId)
	return formatGroup(local), nil
}

func QuerySeedanceAssetGroups(userId int, pageNo, pageSize int, groupType string, groupIds []string) (map[string]any, error) {
	items, total, err := model.ListSeedanceAssetGroupsByUser(userId, model.SeedanceAssetGroupQuery{
		GroupType: groupType,
		GroupIds:  groupIds,
		PageNo:    pageNo,
		PageSize:  pageSize,
	})
	if err != nil {
		return nil, err
	}
	list := make([]map[string]any, 0, len(items))
	for _, g := range items {
		list = append(list, formatGroup(g))
	}
	return map[string]any{
		"list":      list,
		"total":     total,
		"page_no":   pageNo,
		"page_size": pageSize,
	}, nil
}

func GetSeedanceAssetGroup(userId int, groupId string) (map[string]any, error) {
	g, err := model.GetSeedanceAssetGroupByUserAndGroupID(userId, groupId)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "素材组不存在")
	}
	return formatGroup(g), nil
}

func PatchSeedanceAssetGroup(userId int, groupId, groupName, description string) (map[string]any, error) {
	g, err := model.GetSeedanceAssetGroupByUserAndGroupID(userId, groupId)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "素材组不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "patch_asset_group"); err != nil {
		return nil, err
	}
	if gw, gErr := resolveSeedanceGateway(); gErr == nil {
		body := map[string]any{}
		if groupName != "" {
			body["group_name"] = groupName
		}
		if description != "" {
			body["description"] = description
		}
		if len(body) > 0 {
			path := "/api/seedance/asset-groups/" + url.PathEscape(groupId)
			_, _, _ = seedanceGatewayDo(gw, http.MethodPatch, path, body)
		}
	}
	if groupName != "" {
		g.GroupName = groupName
	}
	if description != "" {
		g.Description = description
	}
	if err := g.Update(); err != nil {
		return nil, err
	}
	return formatGroup(g), nil
}

func DeleteSeedanceAssetGroup(userId int, groupId string) (map[string]any, error) {
	g, err := model.GetSeedanceAssetGroupByUserAndGroupID(userId, groupId)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "素材组不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "delete_asset_group"); err != nil {
		return nil, err
	}
	gw, err := resolveSeedanceGateway()
	if err != nil {
		return nil, err
	}
	path := "/api/seedance/asset-groups/" + url.PathEscape(groupId)
	status, raw, err := seedanceGatewayDo(gw, http.MethodDelete, path, nil)
	if err != nil {
		return nil, err
	}
	if status >= 400 && status != http.StatusNotFound {
		return nil, upstreamFail(status, raw, "删除素材组失败")
	}
	if err := model.SoftDeleteSeedanceAssetGroup(userId, groupId); err != nil {
		return nil, err
	}
	return map[string]any{"group_id": groupId, "deleted": true}, nil
}

func CreateSeedanceRemoteAsset(userId int, assetURL, assetType, name, groupId string) (map[string]any, error) {
	assetURL = strings.TrimSpace(assetURL)
	if assetURL == "" {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_url", "url 必填")
	}
	if err := AssertGroupUsable(userId, groupId); err != nil {
		return nil, err
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "create_asset"); err != nil {
		return nil, err
	}
	gw, err := resolveSeedanceGateway()
	if err != nil {
		return nil, err
	}
	body := map[string]any{
		"url":  assetURL,
		"type": pickString(assetType, "image"),
	}
	if name != "" {
		body["name"] = name
	}
	if strings.TrimSpace(groupId) != "" {
		body["group_id"] = strings.TrimSpace(groupId)
	}
	status, raw, err := seedanceGatewayDo(gw, http.MethodPost, "/api/seedance/assets", body)
	if err != nil {
		return nil, err
	}
	if status >= 400 || raw["success"] == false {
		return nil, upstreamFail(status, raw, "远程资产认证失败")
	}
	data := asMap(raw["data"])
	aiccId := pickString(mapGet(data, "aicc_asset_id", "aiccAssetId", "asset_id", "assetId"))
	if aiccId == "" {
		return nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", "上游未返回 asset id")
	}
	// 若上游返回的是本地数字 id，仍尽量用字符串保存；优先 aicc
	if v := pickString(mapGet(data, "aicc_asset_id", "aiccAssetId")); v != "" {
		aiccId = v
	}
	a := &model.SeedanceAsset{
		UserId:      userId,
		GroupId:     pickString(mapGet(data, "aicc_group_id", "group_id", "groupId"), groupId),
		AiccAssetId: aiccId,
		Filename:    pickString(mapGet(data, "filename", "name"), name),
		Type:        pickString(mapGet(data, "type"), assetType, "image"),
		Status:      pickString(mapGet(data, "status"), model.SeedanceAssetStatusProcessing),
		URL:         pickString(mapGet(data, "url"), assetURL),
		AssetURI:    pickString(mapGet(data, "asset_uri", "assetUri")),
		ChannelId:   gw.ChannelId,
	}
	if a.AssetURI == "" {
		a.AssetURI = "asset://" + a.AiccAssetId
	}
	if err := a.Insert(); err != nil {
		return nil, err
	}
	return formatAsset(a), nil
}

func QuerySeedanceAssets(userId int, q model.SeedanceAssetQuery) (map[string]any, error) {
	items, total, err := model.ListSeedanceAssetsByUser(userId, q)
	if err != nil {
		return nil, err
	}
	list := make([]map[string]any, 0, len(items))
	for _, a := range items {
		list = append(list, formatAsset(a))
	}
	pageNo, pageSize := q.PageNo, q.PageSize
	if pageNo < 1 {
		pageNo = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	return map[string]any{
		"list":      list,
		"total":     total,
		"page_no":   pageNo,
		"page_size": pageSize,
	}, nil
}

func GetSeedanceAsset(userId int, idOrAicc string) (map[string]any, error) {
	a, err := model.GetSeedanceAssetByUserAndIDOrAicc(userId, idOrAicc)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "asset_not_found", "素材不存在")
	}
	cfg := operation_setting.GetSeedanceAssetSetting()
	if cfg != nil && cfg.RefreshOnGet {
		if gw, gErr := resolveSeedanceGateway(); gErr == nil {
			pathID := a.AiccAssetId
			if pathID == "" {
				pathID = strconv.Itoa(a.Id)
			}
			path := "/api/seedance/assets/" + url.PathEscape(pathID)
			status, raw, rErr := seedanceGatewayDo(gw, http.MethodGet, path, nil)
			if rErr == nil && status < 400 && raw["success"] != false {
				data := asMap(raw["data"])
				if st := pickString(mapGet(data, "status")); st != "" {
					a.Status = st
				}
				if em := pickString(mapGet(data, "error_message", "errorMessage", "fail_reason")); em != "" {
					a.ErrorMessage = em
				}
				if uri := pickString(mapGet(data, "asset_uri", "assetUri")); uri != "" {
					a.AssetURI = uri
				}
				a.UpdatedAt = time.Now().Unix()
				_ = a.Update()
			}
		}
	}
	return formatAsset(a), nil
}

func PatchSeedanceAsset(userId int, idOrAicc, filename string) (map[string]any, error) {
	a, err := model.GetSeedanceAssetByUserAndIDOrAicc(userId, idOrAicc)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "asset_not_found", "素材不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "patch_asset"); err != nil {
		return nil, err
	}
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_filename", "filename 必填")
	}
	if gw, gErr := resolveSeedanceGateway(); gErr == nil {
		pathID := a.AiccAssetId
		if pathID == "" {
			pathID = strconv.Itoa(a.Id)
		}
		path := "/api/seedance/assets/" + url.PathEscape(pathID)
		_, _, _ = seedanceGatewayDo(gw, http.MethodPatch, path, map[string]any{"filename": filename})
	}
	a.Filename = filename
	if err := a.Update(); err != nil {
		return nil, err
	}
	return formatAsset(a), nil
}

func DeleteSeedanceAsset(userId int, idOrAicc string) (map[string]any, error) {
	a, err := model.GetSeedanceAssetByUserAndIDOrAicc(userId, idOrAicc)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "asset_not_found", "素材不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "delete_asset"); err != nil {
		return nil, err
	}
	gw, err := resolveSeedanceGateway()
	if err != nil {
		return nil, err
	}
	pathID := a.AiccAssetId
	if pathID == "" {
		pathID = strconv.Itoa(a.Id)
	}
	path := "/api/seedance/assets/" + url.PathEscape(pathID)
	status, raw, err := seedanceGatewayDo(gw, http.MethodDelete, path, nil)
	if err != nil {
		return nil, err
	}
	if status >= 400 && status != http.StatusNotFound {
		return nil, upstreamFail(status, raw, "删除素材失败")
	}
	if err := model.SoftDeleteSeedanceAsset(userId, a.Id); err != nil {
		return nil, err
	}
	return map[string]any{"id": a.Id, "aicc_asset_id": a.AiccAssetId, "deleted": true}, nil
}

func CreateSeedanceRealPersonSession(userId int) (map[string]any, error) {
	if err := MaybeChargeSeedanceAssetOp(userId, "real_person_session"); err != nil {
		return nil, err
	}
	gw, err := resolveSeedanceGateway()
	if err != nil {
		return nil, err
	}
	status, raw, err := seedanceGatewayDo(gw, http.MethodPost, "/api/seedance/real-person-auth/sessions", map[string]any{})
	if err != nil {
		return nil, err
	}
	if status >= 400 || raw["success"] == false {
		return nil, upstreamFail(status, raw, "创建真人认证会话失败")
	}
	data := asMap(raw["data"])
	if data == nil {
		data = map[string]any{}
	}
	return data, nil
}

func ExchangeSeedanceRealPersonAssetGroup(userId int, bytedToken string) (map[string]any, error) {
	bytedToken = strings.TrimSpace(bytedToken)
	if bytedToken == "" {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_token", "byted_token 必填")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "real_person_asset_group"); err != nil {
		return nil, err
	}
	gw, err := resolveSeedanceGateway()
	if err != nil {
		return nil, err
	}
	status, raw, err := seedanceGatewayDo(gw, http.MethodPost, "/api/seedance/real-person-auth/asset-group", map[string]any{
		"byted_token": bytedToken,
	})
	if err != nil {
		return nil, err
	}
	if status >= 400 || raw["success"] == false {
		return nil, upstreamFail(status, raw, "换取真人素材组失败")
	}
	data := asMap(raw["data"])
	groupId := pickString(mapGet(data, "group_id", "groupId"))
	if groupId == "" {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "尚未完成活体或 token 无效")
	}
	g := &model.SeedanceAssetGroup{
		UserId:    userId,
		GroupId:   groupId,
		GroupType: model.SeedanceGroupTypeLivenessFace,
		GroupName: pickString(mapGet(data, "group_name", "groupName"), "LivenessFace"),
		Status:    model.SeedanceGroupStatusActive,
		ChannelId: gw.ChannelId,
	}
	if err := model.UpsertSeedanceAssetGroup(g); err != nil {
		if err.Error() == "group_owned_by_other" {
			return nil, newSeedanceErr(http.StatusConflict, "group_owned_by_other", "该素材组已归属其他用户")
		}
		return nil, err
	}
	return map[string]any{
		"group_id":   groupId,
		"group_type": model.SeedanceGroupTypeLivenessFace,
	}, nil
}
