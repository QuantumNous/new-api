package service

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// AssertGroupUsableFor 校验用户是否可使用该素材组（本人归属；空则表示默认组）
func AssertGroupUsableFor(userId int, provider, groupId string) error {
	gid := strings.TrimSpace(groupId)
	if gid == "" {
		return nil
	}
	g, err := model.GetSeedanceAssetGroupByUserAndGroupIDProvider(userId, gid, provider)
	if err != nil {
		return err
	}
	if g == nil {
		return newSeedanceErr(http.StatusForbidden, "group_forbidden", "素材组不存在或无权使用")
	}
	return nil
}

func CreateSeedanceAssetGroupFor(userId int, provider, groupName, description, groupType string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	if err := MaybeChargeSeedanceAssetOp(userId, "create_asset_group"); err != nil {
		return nil, err
	}
	gt := strings.TrimSpace(groupType)
	if gt == "" {
		gt = model.SeedanceGroupTypeAIGC
	}
	if !strings.EqualFold(gt, model.SeedanceGroupTypeAIGC) {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_group_type", "仅支持创建 AIGC 素材组")
	}

	var (
		groupId   string
		channelId int
		outName   = groupName
		outDesc   = description
	)

	if provider == model.SeedanceProviderOfficial {
		gw, err := resolveSeedanceOfficialGateway()
		if err != nil {
			return nil, err
		}
		channelId = gw.ChannelId
		name := strings.TrimSpace(groupName)
		if name == "" {
			name = "AIGC"
		}
		_, result, _, err := seedanceOfficialDo(gw, "CreateAssetGroup", map[string]any{
			"Name":        name,
			"Description": description,
			"GroupType":   model.SeedanceGroupTypeAIGC,
			"ProjectName": operation_setting.GetSeedanceOfficialProjectName(),
		})
		if err != nil {
			return nil, err
		}
		groupId = pickString(mapGet(result, "Id", "id"))
		if groupId == "" {
			return nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", "上游未返回 group_id")
		}
		outName = pickString(mapGet(result, "Name", "name"), name)
		outDesc = pickString(mapGet(result, "Description", "description"), description)
	} else {
		gw, err := resolveSeedanceGateway()
		if err != nil {
			return nil, err
		}
		channelId = gw.ChannelId
		status, raw, err := seedanceGatewayDo(gw, http.MethodPost, "/api/seedance/asset-groups", map[string]any{
			"group_name":  groupName,
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
		groupId = pickString(mapGet(data, "group_id", "groupId"))
		if groupId == "" {
			return nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", "上游未返回 group_id")
		}
		outName = pickString(mapGet(data, "group_name", "groupName"), groupName)
		outDesc = pickString(mapGet(data, "description"), description)
	}

	g := &model.SeedanceAssetGroup{
		UserId:      userId,
		GroupId:     groupId,
		GroupType:   model.SeedanceGroupTypeAIGC,
		GroupName:   outName,
		Description: outDesc,
		Status:      model.SeedanceGroupStatusActive,
		Provider:    provider,
		ChannelId:   channelId,
	}
	if err := model.UpsertSeedanceAssetGroup(g); err != nil {
		return nil, err
	}
	local, _ := model.GetSeedanceAssetGroupByUserAndGroupIDProvider(userId, groupId, provider)
	return formatGroup(local), nil
}

func QuerySeedanceAssetGroupsFor(userId int, provider string, pageNo, pageSize int, groupType string, groupIds []string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	items, total, err := model.ListSeedanceAssetGroupsByUser(userId, model.SeedanceAssetGroupQuery{
		GroupType: groupType,
		GroupIds:  groupIds,
		Provider:  provider,
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

func GetSeedanceAssetGroupFor(userId int, provider, groupId string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	g, err := model.GetSeedanceAssetGroupByUserAndGroupIDProvider(userId, groupId, provider)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "素材组不存在")
	}
	return formatGroup(g), nil
}

func PatchSeedanceAssetGroupFor(userId int, provider, groupId, groupName, description string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	g, err := model.GetSeedanceAssetGroupByUserAndGroupIDProvider(userId, groupId, provider)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "素材组不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "patch_asset_group"); err != nil {
		return nil, err
	}

	if provider == model.SeedanceProviderOfficial {
		if gw, gErr := resolveSeedanceOfficialGateway(); gErr == nil {
			body := map[string]any{"Id": groupId}
			if groupName != "" {
				body["Name"] = groupName
			}
			if description != "" {
				body["Description"] = description
			}
			if groupName != "" || description != "" {
				_, _, _, _ = seedanceOfficialDo(gw, "UpdateAssetGroup", body)
			}
		}
	} else if gw, gErr := resolveSeedanceGateway(); gErr == nil {
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

func DeleteSeedanceAssetGroupFor(userId int, provider, groupId string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	g, err := model.GetSeedanceAssetGroupByUserAndGroupIDProvider(userId, groupId, provider)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "素材组不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "delete_asset_group"); err != nil {
		return nil, err
	}

	if provider == model.SeedanceProviderOfficial {
		gw, err := resolveSeedanceOfficialGateway()
		if err != nil {
			return nil, err
		}
		status, _, raw, err := seedanceOfficialDo(gw, "DeleteAssetGroup", map[string]any{"Id": groupId})
		if err != nil && status != http.StatusNotFound {
			return nil, err
		}
		_ = raw
	} else {
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
	}

	if err := model.SoftDeleteSeedanceAssetGroupByProvider(userId, groupId, provider); err != nil {
		return nil, err
	}
	return map[string]any{"group_id": groupId, "deleted": true}, nil
}

func ensureOfficialAIGCGroup(userId int, preferredGroupId string) (string, error) {
	preferredGroupId = strings.TrimSpace(preferredGroupId)
	if preferredGroupId != "" {
		if err := AssertGroupUsableFor(userId, model.SeedanceProviderOfficial, preferredGroupId); err != nil {
			return "", err
		}
		return preferredGroupId, nil
	}
	items, _, err := model.ListSeedanceAssetGroupsByUser(userId, model.SeedanceAssetGroupQuery{
		GroupType: model.SeedanceGroupTypeAIGC,
		Provider:  model.SeedanceProviderOfficial,
		PageNo:    1,
		PageSize:  1,
	})
	if err != nil {
		return "", err
	}
	if len(items) > 0 {
		return items[0].GroupId, nil
	}
	created, err := CreateSeedanceAssetGroupFor(userId, model.SeedanceProviderOfficial, "default", "", model.SeedanceGroupTypeAIGC)
	if err != nil {
		return "", err
	}
	return pickString(mapGet(created, "group_id")), nil
}

func CreateSeedanceRemoteAssetFor(userId int, provider, assetURL, assetType, name, groupId string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	assetURL = strings.TrimSpace(assetURL)
	if assetURL == "" {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_url", "url 必填")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "create_asset"); err != nil {
		return nil, err
	}

	if provider == model.SeedanceProviderOfficial {
		gid, err := ensureOfficialAIGCGroup(userId, groupId)
		if err != nil {
			return nil, err
		}
		gw, err := resolveSeedanceOfficialGateway()
		if err != nil {
			return nil, err
		}
		body := map[string]any{
			"GroupId":     gid,
			"URL":         assetURL,
			"AssetType":   toOfficialAssetType(assetType),
			"ProjectName": operation_setting.GetSeedanceOfficialProjectName(),
		}
		if strings.TrimSpace(name) != "" {
			body["Name"] = strings.TrimSpace(name)
		}
		// 海外 BytePlus：跳过素材库内容预审（需控制台同时关闭 secure mode）
		if gw.Platform == operation_setting.SeedanceOfficialPlatformOverseas {
			body["Moderation"] = map[string]any{
				"Strategy": "Skip",
			}
		}
		_, result, _, err := seedanceOfficialDo(gw, "CreateAsset", body)
		if err != nil {
			return nil, err
		}
		aiccId := pickString(mapGet(result, "Id", "id"))
		if aiccId == "" {
			return nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", "上游未返回 asset id")
		}
		a := &model.SeedanceAsset{
			UserId:      userId,
			GroupId:     gid,
			AiccAssetId: aiccId,
			Filename:    pickString(name),
			Type:        fromOfficialAssetType(toOfficialAssetType(assetType)),
			Status:      model.SeedanceAssetStatusProcessing,
			URL:         assetURL,
			AssetURI:    "asset://" + aiccId,
			Provider:    provider,
			ChannelId:   gw.ChannelId,
		}
		if err := a.Insert(); err != nil {
			return nil, err
		}
		return formatAsset(a), nil
	}

	if err := AssertGroupUsableFor(userId, provider, groupId); err != nil {
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
		Provider:    provider,
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

func QuerySeedanceAssetsFor(userId int, provider string, q model.SeedanceAssetQuery) (map[string]any, error) {
	q.Provider = model.NormalizeSeedanceProvider(provider)
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

func GetSeedanceAssetFor(userId int, provider, idOrAicc string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	a, err := model.GetSeedanceAssetByUserAndIDOrAiccProvider(userId, idOrAicc, provider)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "asset_not_found", "素材不存在")
	}

	refresh := false
	if provider == model.SeedanceProviderOfficial {
		cfg := operation_setting.GetSeedanceAssetOfficialSetting()
		refresh = cfg != nil && cfg.RefreshOnGet
	} else {
		cfg := operation_setting.GetSeedanceAssetSetting()
		refresh = cfg != nil && cfg.RefreshOnGet
	}

	if refresh {
		if provider == model.SeedanceProviderOfficial {
			if gw, gErr := resolveSeedanceOfficialGateway(); gErr == nil {
				pathID := a.AiccAssetId
				if pathID == "" {
					pathID = strconv.Itoa(a.Id)
				}
				_, result, _, rErr := seedanceOfficialDo(gw, "GetAsset", map[string]any{"Id": pathID})
				if rErr == nil && result != nil {
					if st := pickString(mapGet(result, "Status", "status")); st != "" {
						a.Status = fromOfficialStatus(st)
					}
					if em := pickString(mapGet(result, "ErrorMessage", "error_message", "Message")); em != "" {
						a.ErrorMessage = em
					}
					if u := pickString(mapGet(result, "URL", "url")); u != "" {
						a.URL = u
					}
					if gid := pickString(mapGet(result, "GroupId", "group_id")); gid != "" {
						a.GroupId = gid
					}
					if n := pickString(mapGet(result, "Name", "name")); n != "" {
						a.Filename = n
					}
					a.AssetURI = "asset://" + a.AiccAssetId
					a.UpdatedAt = time.Now().Unix()
					_ = a.Update()
				}
			}
		} else if gw, gErr := resolveSeedanceGateway(); gErr == nil {
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

func PatchSeedanceAssetFor(userId int, provider, idOrAicc, filename string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	a, err := model.GetSeedanceAssetByUserAndIDOrAiccProvider(userId, idOrAicc, provider)
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

	pathID := a.AiccAssetId
	if pathID == "" {
		pathID = strconv.Itoa(a.Id)
	}
	if provider == model.SeedanceProviderOfficial {
		if gw, gErr := resolveSeedanceOfficialGateway(); gErr == nil {
			_, _, _, _ = seedanceOfficialDo(gw, "UpdateAsset", map[string]any{
				"Id":   pathID,
				"Name": filename,
			})
		}
	} else if gw, gErr := resolveSeedanceGateway(); gErr == nil {
		path := "/api/seedance/assets/" + url.PathEscape(pathID)
		_, _, _ = seedanceGatewayDo(gw, http.MethodPatch, path, map[string]any{"filename": filename})
	}
	a.Filename = filename
	if err := a.Update(); err != nil {
		return nil, err
	}
	return formatAsset(a), nil
}

func DeleteSeedanceAssetFor(userId int, provider, idOrAicc string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	a, err := model.GetSeedanceAssetByUserAndIDOrAiccProvider(userId, idOrAicc, provider)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, newSeedanceErr(http.StatusNotFound, "asset_not_found", "素材不存在")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "delete_asset"); err != nil {
		return nil, err
	}

	pathID := a.AiccAssetId
	if pathID == "" {
		pathID = strconv.Itoa(a.Id)
	}
	if provider == model.SeedanceProviderOfficial {
		gw, err := resolveSeedanceOfficialGateway()
		if err != nil {
			return nil, err
		}
		status, _, _, err := seedanceOfficialDo(gw, "DeleteAsset", map[string]any{"Id": pathID})
		if err != nil && status != http.StatusNotFound {
			return nil, err
		}
	} else {
		gw, err := resolveSeedanceGateway()
		if err != nil {
			return nil, err
		}
		path := "/api/seedance/assets/" + url.PathEscape(pathID)
		status, raw, err := seedanceGatewayDo(gw, http.MethodDelete, path, nil)
		if err != nil {
			return nil, err
		}
		if status >= 400 && status != http.StatusNotFound {
			return nil, upstreamFail(status, raw, "删除素材失败")
		}
	}

	if err := model.SoftDeleteSeedanceAssetByProvider(userId, a.Id, provider); err != nil {
		return nil, err
	}
	return map[string]any{"id": a.Id, "aicc_asset_id": a.AiccAssetId, "deleted": true}, nil
}

func CreateSeedanceRealPersonSessionFor(userId int, provider, callbackURL string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	if err := MaybeChargeSeedanceAssetOp(userId, "real_person_session"); err != nil {
		return nil, err
	}

	if provider == model.SeedanceProviderOfficial {
		cfg := operation_setting.GetSeedanceAssetOfficialSetting()
		cb := strings.TrimSpace(callbackURL)
		if cb == "" && cfg != nil {
			cb = strings.TrimSpace(cfg.DefaultCallbackURL)
		}
		if cb == "" {
			return nil, newSeedanceErr(http.StatusBadRequest, "callback_url_required", "callback_url 必填（或在运营设置配置默认 CallbackURL）")
		}
		gw, err := resolveSeedanceOfficialGateway()
		if err != nil {
			return nil, err
		}
		_, result, _, err := seedanceOfficialDo(gw, "CreateVisualValidateSession", map[string]any{
			"CallbackURL": cb,
			"ProjectName": operation_setting.GetSeedanceOfficialProjectName(),
		})
		if err != nil {
			return nil, err
		}
		return map[string]any{
			"byted_token":  pickString(mapGet(result, "BytedToken", "byted_token")),
			"h5_link":      pickString(mapGet(result, "H5Link", "h5_link")),
			"callback_url": pickString(mapGet(result, "CallbackURL", "callback_url"), cb),
		}, nil
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

func ExchangeSeedanceRealPersonAssetGroupFor(userId int, provider, bytedToken string) (map[string]any, error) {
	provider = model.NormalizeSeedanceProvider(provider)
	bytedToken = strings.TrimSpace(bytedToken)
	if bytedToken == "" {
		return nil, newSeedanceErr(http.StatusBadRequest, "invalid_token", "byted_token 必填")
	}
	if err := MaybeChargeSeedanceAssetOp(userId, "real_person_asset_group"); err != nil {
		return nil, err
	}

	var (
		groupId   string
		channelId int
	)
	if provider == model.SeedanceProviderOfficial {
		gw, err := resolveSeedanceOfficialGateway()
		if err != nil {
			return nil, err
		}
		channelId = gw.ChannelId
		_, result, _, err := seedanceOfficialDo(gw, "GetVisualValidateResult", map[string]any{
			"BytedToken": bytedToken,
		})
		if err != nil {
			return nil, err
		}
		groupId = pickString(mapGet(result, "GroupId", "group_id"))
		if groupId == "" {
			return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "尚未完成活体或 token 无效")
		}
	} else {
		gw, err := resolveSeedanceGateway()
		if err != nil {
			return nil, err
		}
		channelId = gw.ChannelId
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
		groupId = pickString(mapGet(data, "group_id", "groupId"))
		if groupId == "" {
			return nil, newSeedanceErr(http.StatusNotFound, "group_not_found", "尚未完成活体或 token 无效")
		}
	}

	g := &model.SeedanceAssetGroup{
		UserId:    userId,
		GroupId:   groupId,
		GroupType: model.SeedanceGroupTypeLivenessFace,
		GroupName: "LivenessFace",
		Status:    model.SeedanceGroupStatusActive,
		Provider:  provider,
		ChannelId: channelId,
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
