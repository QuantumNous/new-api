package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

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
	return AssertGroupUsableFor(userId, model.SeedanceProvider83zi, groupId)
}

func CreateSeedanceAssetGroup(userId int, groupName, description, groupType string) (map[string]any, error) {
	return CreateSeedanceAssetGroupFor(userId, model.SeedanceProvider83zi, groupName, description, groupType)
}

func QuerySeedanceAssetGroups(userId int, pageNo, pageSize int, groupType string, groupIds []string) (map[string]any, error) {
	return QuerySeedanceAssetGroupsFor(userId, model.SeedanceProvider83zi, pageNo, pageSize, groupType, groupIds)
}

func GetSeedanceAssetGroup(userId int, groupId string) (map[string]any, error) {
	return GetSeedanceAssetGroupFor(userId, model.SeedanceProvider83zi, groupId)
}

func PatchSeedanceAssetGroup(userId int, groupId, groupName, description string) (map[string]any, error) {
	return PatchSeedanceAssetGroupFor(userId, model.SeedanceProvider83zi, groupId, groupName, description)
}

func DeleteSeedanceAssetGroup(userId int, groupId string) (map[string]any, error) {
	return DeleteSeedanceAssetGroupFor(userId, model.SeedanceProvider83zi, groupId)
}

func CreateSeedanceRemoteAsset(userId int, assetURL, assetType, name, groupId string) (map[string]any, error) {
	return CreateSeedanceRemoteAssetFor(userId, model.SeedanceProvider83zi, assetURL, assetType, name, groupId)
}

func QuerySeedanceAssets(userId int, q model.SeedanceAssetQuery) (map[string]any, error) {
	return QuerySeedanceAssetsFor(userId, model.SeedanceProvider83zi, q)
}

func GetSeedanceAsset(userId int, idOrAicc string) (map[string]any, error) {
	return GetSeedanceAssetFor(userId, model.SeedanceProvider83zi, idOrAicc)
}

func PatchSeedanceAsset(userId int, idOrAicc, filename string) (map[string]any, error) {
	return PatchSeedanceAssetFor(userId, model.SeedanceProvider83zi, idOrAicc, filename)
}

func DeleteSeedanceAsset(userId int, idOrAicc string) (map[string]any, error) {
	return DeleteSeedanceAssetFor(userId, model.SeedanceProvider83zi, idOrAicc)
}

func CreateSeedanceRealPersonSession(userId int) (map[string]any, error) {
	return CreateSeedanceRealPersonSessionFor(userId, model.SeedanceProvider83zi, "")
}

func ExchangeSeedanceRealPersonAssetGroup(userId int, bytedToken string) (map[string]any, error) {
	return ExchangeSeedanceRealPersonAssetGroupFor(userId, model.SeedanceProvider83zi, bytedToken)
}
