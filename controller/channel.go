package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/ollama"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

func parseStatusFilter(statusParam string) int {
	switch strings.ToLower(statusParam) {
	case "enabled", "1":
		return common.ChannelStatusEnabled
	case "disabled", "0":
		return 0
	default:
		return -1
	}
}

func clearChannelInfo(channel *model.Channel) {
	if channel.ChannelInfo.IsMultiKey {
		channel.ChannelInfo.MultiKeyDisabledReason = nil
		channel.ChannelInfo.MultiKeyDisabledTime = nil
	}
}

type GetAllChannelsData struct {
	Items      []*model.Channel `json:"items"`
	Total      int64            `json:"total"`
	Page       int              `json:"page"`
	PageSize   int              `json:"page_size"`
	TypeCounts map[int64]int64  `json:"type_counts"`
}

func GetAllChannels(c fuego.ContextWithParams[dto.GetAllChannelsParams]) (*dto.Response[GetAllChannelsData], error) {
	p, _ := dto.ParseParams[dto.GetAllChannelsParams](c)
	pageInfo := dto.PageInfo(c)
	channelData := make([]*model.Channel, 0)
	idSort := p.IdSort
	enableTagMode := p.TagMode
	// statusFilter: -1 all, 1 enabled, 0 disabled (include auto & manual)
	statusFilter := parseStatusFilter(p.Status)
	// type filter
	typeFilter := -1
	if c.QueryParam("type") != "" {
		typeFilter = p.Type
	}

	var total int64

	if enableTagMode {
		tags, err := model.GetPaginatedTags(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.SysError("failed to get paginated tags: " + err.Error())
			return dto.Fail[GetAllChannelsData]("获取标签失败，请稍后重试")
		}
		for _, tag := range tags {
			if tag == nil || *tag == "" {
				continue
			}
			tagChannels, err := model.GetChannelsByTag(*tag, idSort, false)
			if err != nil {
				continue
			}
			filtered := make([]*model.Channel, 0)
			for _, ch := range tagChannels {
				if statusFilter == common.ChannelStatusEnabled && ch.Status != common.ChannelStatusEnabled {
					continue
				}
				if statusFilter == 0 && ch.Status == common.ChannelStatusEnabled {
					continue
				}
				if typeFilter >= 0 && ch.Type != typeFilter {
					continue
				}
				filtered = append(filtered, ch)
			}
			channelData = append(channelData, filtered...)
		}
		total, _ = model.CountAllTags()
	} else {
		baseQuery := model.DB.Model(&model.Channel{})
		if typeFilter >= 0 {
			baseQuery = baseQuery.Where("type = ?", typeFilter)
		}
		if statusFilter == common.ChannelStatusEnabled {
			baseQuery = baseQuery.Where("status = ?", common.ChannelStatusEnabled)
		} else if statusFilter == 0 {
			baseQuery = baseQuery.Where("status != ?", common.ChannelStatusEnabled)
		}

		baseQuery.Count(&total)

		order := "priority desc"
		if idSort {
			order = "id desc"
		}

		err := baseQuery.Order(order).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Omit("key").Find(&channelData).Error
		if err != nil {
			common.SysError("failed to get channels: " + err.Error())
			return dto.Fail[GetAllChannelsData]("获取渠道列表失败，请稍后重试")
		}
	}

	for _, datum := range channelData {
		clearChannelInfo(datum)
	}

	countQuery := model.DB.Model(&model.Channel{})
	if statusFilter == common.ChannelStatusEnabled {
		countQuery = countQuery.Where("status = ?", common.ChannelStatusEnabled)
	} else if statusFilter == 0 {
		countQuery = countQuery.Where("status != ?", common.ChannelStatusEnabled)
	}
	var results []struct {
		Type  int64
		Count int64
	}
	_ = countQuery.Select("type, count(*) as count").Group("type").Find(&results).Error
	typeCounts := make(map[int64]int64)
	for _, r := range results {
		typeCounts[r.Type] = r.Count
	}
	return dto.Ok(GetAllChannelsData{
		Items:      channelData,
		Total:      total,
		Page:       pageInfo.GetPage(),
		PageSize:   pageInfo.GetPageSize(),
		TypeCounts: typeCounts,
	})
}

func buildFetchModelsHeaders(channel *model.Channel, key string) (http.Header, error) {
	var headers http.Header
	switch channel.Type {
	case constant.ChannelTypeAnthropic:
		headers = GetClaudeAuthHeader(key)
	default:
		headers = GetAuthHeader(key)
	}

	headerOverride := channel.GetHeaderOverride()
	for k, v := range headerOverride {
		if relaychannel.IsHeaderPassthroughRuleKey(k) {
			continue
		}
		str, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("invalid header override for key %s", k)
		}
		if strings.Contains(str, "{api_key}") {
			str = strings.ReplaceAll(str, "{api_key}", key)
		}
		headers.Set(k, str)
	}

	return headers, nil
}

func FetchUpstreamModels(c fuego.ContextNoBody) (dto.ApiResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailAny(err.Error())
	}

	channel, err := model.GetChannelById(id, true)
	if err != nil {
		return dto.FailAny(err.Error())
	}

	ids, err := fetchChannelUpstreamModelIDs(channel)
	if err != nil {
		return dto.FailAny(fmt.Sprintf("获取模型列表失败: %s", err.Error()))
	}

	return dto.OkAny(ids)
}

func FixChannelsAbilities(c fuego.ContextNoBody) (*dto.Response[dto.FixAbilityData], error) {
	success, fails, err := model.FixAbility()
	if err != nil {
		return dto.Fail[dto.FixAbilityData](err.Error())
	}
	return dto.Ok(dto.FixAbilityData{
		Success: success,
		Fails:   fails,
	})
}

type SearchChannelsData struct {
	Items      []*model.Channel `json:"items"`
	Total      int              `json:"total"`
	TypeCounts map[int64]int64  `json:"type_counts"`
}

func SearchChannels(c fuego.ContextWithParams[dto.SearchChannelsParams]) (*dto.Response[SearchChannelsData], error) {
	p, _ := dto.ParseParams[dto.SearchChannelsParams](c)
	keyword := p.Keyword
	group := p.Group
	modelKeyword := p.Model
	statusFilter := parseStatusFilter(p.Status)
	idSort := p.IdSort
	enableTagMode := p.TagMode
	channelData := make([]*model.Channel, 0)
	if enableTagMode {
		tags, err := model.SearchTags(keyword, group, modelKeyword, idSort)
		if err != nil {
			return dto.Fail[SearchChannelsData](err.Error())
		}
		for _, tag := range tags {
			if tag != nil && *tag != "" {
				tagChannel, err := model.GetChannelsByTag(*tag, idSort, false)
				if err == nil {
					channelData = append(channelData, tagChannel...)
				}
			}
		}
	} else {
		channels, err := model.SearchChannels(keyword, group, modelKeyword, idSort)
		if err != nil {
			return dto.Fail[SearchChannelsData](err.Error())
		}
		channelData = channels
	}

	if statusFilter == common.ChannelStatusEnabled || statusFilter == 0 {
		filtered := make([]*model.Channel, 0, len(channelData))
		for _, ch := range channelData {
			if statusFilter == common.ChannelStatusEnabled && ch.Status != common.ChannelStatusEnabled {
				continue
			}
			if statusFilter == 0 && ch.Status == common.ChannelStatusEnabled {
				continue
			}
			filtered = append(filtered, ch)
		}
		channelData = filtered
	}

	// calculate type counts for search results
	typeCounts := make(map[int64]int64)
	for _, channel := range channelData {
		typeCounts[int64(channel.Type)]++
	}

	typeFilter := -1
	if c.QueryParam("type") != "" {
		typeFilter = p.Type
	}

	if typeFilter >= 0 {
		filtered := make([]*model.Channel, 0, len(channelData))
		for _, ch := range channelData {
			if ch.Type == typeFilter {
				filtered = append(filtered, ch)
			}
		}
		channelData = filtered
	}

	page, _ := strconv.Atoi(dto.QueryDefault(c, "p", "1"))
	pageSize, _ := strconv.Atoi(dto.QueryDefault(c, "page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	total := len(channelData)
	startIdx := (page - 1) * pageSize
	if startIdx > total {
		startIdx = total
	}
	endIdx := startIdx + pageSize
	if endIdx > total {
		endIdx = total
	}

	pagedData := channelData[startIdx:endIdx]

	for _, datum := range pagedData {
		clearChannelInfo(datum)
	}

	return dto.Ok(SearchChannelsData{
		Items:      pagedData,
		Total:      total,
		TypeCounts: typeCounts,
	})
}

func GetChannel(c fuego.ContextNoBody) (*dto.Response[*model.Channel], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[*model.Channel](err.Error())
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		return dto.Fail[*model.Channel](err.Error())
	}
	if channel != nil {
		clearChannelInfo(channel)
	}
	return dto.Ok(channel)
}

// GetChannelKey 获取渠道密钥（需要通过安全验证中间件）
// 此函数依赖 SecureVerificationRequired 中间件，确保用户已通过安全验证
func GetChannelKey(c fuego.ContextNoBody) (*dto.Response[dto.ChannelKeyData], error) {
	userId := dto.UserID(c)
	channelId, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.ChannelKeyData](fmt.Sprintf("渠道ID格式错误: %v", err))
	}

	// 获取渠道信息（包含密钥）
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		return dto.Fail[dto.ChannelKeyData](fmt.Sprintf("获取渠道信息失败: %v", err))
	}

	if channel == nil {
		return dto.Fail[dto.ChannelKeyData]("渠道不存在")
	}

	// 记录操作日志
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("查看渠道密钥信息 (渠道ID: %d)", channelId))

	// 返回渠道密钥
	return dto.OkMsg("获取成功", dto.ChannelKeyData{
		Key: channel.Key,
	})
}

// validateTwoFactorAuth 统一的2FA验证函数
func validateTwoFactorAuth(twoFA *model.TwoFA, code string) bool {
	// 尝试验证TOTP
	if cleanCode, err := common.ValidateNumericCode(code); err == nil {
		if isValid, _ := twoFA.ValidateTOTPAndUpdateUsage(cleanCode); isValid {
			return true
		}
	}

	// 尝试验证备用码
	if isValid, err := twoFA.ValidateBackupCodeAndUpdateUsage(code); err == nil && isValid {
		return true
	}

	return false
}

// validateChannel 通用的渠道校验函数
func validateChannel(channel *model.Channel, isAdd bool) error {
	// 校验 channel settings
	if err := channel.ValidateSettings(); err != nil {
		return fmt.Errorf("渠道额外设置[channel setting] 格式错误：%s", err.Error())
	}

	// 如果是添加操作，检查 channel 和 key 是否为空
	if isAdd {
		if channel == nil || channel.Key == "" {
			return fmt.Errorf("channel cannot be empty")
		}

		// 检查模型名称长度是否超过 255
		for _, m := range channel.GetModels() {
			if len(m) > 255 {
				return fmt.Errorf("模型名称过长: %s", m)
			}
		}
	}

	// VertexAI 特殊校验
	if channel.Type == constant.ChannelTypeVertexAi {
		if channel.Other == "" {
			return fmt.Errorf("部署地区不能为空")
		}

		regionMap, err := common.StrToMap(channel.Other)
		if err != nil {
			return fmt.Errorf("部署地区必须是标准的Json格式，例如{\"default\": \"us-central1\", \"region2\": \"us-east1\"}")
		}

		if regionMap["default"] == nil {
			return fmt.Errorf("部署地区必须包含default字段")
		}
	}

	// Codex OAuth key validation (optional, only when JSON object is provided)
	if channel.Type == constant.ChannelTypeCodex {
		trimmedKey := strings.TrimSpace(channel.Key)
		if isAdd || trimmedKey != "" {
			if !strings.HasPrefix(trimmedKey, "{") {
				return fmt.Errorf("Codex key must be a valid JSON object")
			}
			var keyMap map[string]any
			if err := common.Unmarshal([]byte(trimmedKey), &keyMap); err != nil {
				return fmt.Errorf("Codex key must be a valid JSON object")
			}
			if v, ok := keyMap["access_token"]; !ok || v == nil || strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
				return fmt.Errorf("Codex key JSON must include access_token")
			}
			if v, ok := keyMap["account_id"]; !ok || v == nil || strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
				return fmt.Errorf("Codex key JSON must include account_id")
			}
		}
	}

	return nil
}

func RefreshCodexChannelCredential(c fuego.ContextNoBody) (*dto.Response[dto.RefreshCodexData], error) {
	channelId, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.RefreshCodexData](fmt.Sprintf("invalid channel id: %v", err))
	}

	ctx, cancel := context.WithTimeout(dto.GinCtx(c).Request.Context(), 10*time.Second)
	defer cancel()

	oauthKey, ch, err := service.RefreshCodexChannelCredential(ctx, channelId, service.CodexCredentialRefreshOptions{ResetCaches: true})
	if err != nil {
		common.SysError("failed to refresh codex channel credential: " + err.Error())
		return dto.Fail[dto.RefreshCodexData]("刷新凭证失败，请稍后重试")
	}

	return dto.OkMsg("refreshed", dto.RefreshCodexData{
		ExpiresAt:   oauthKey.Expired,
		LastRefresh: oauthKey.LastRefresh,
		AccountID:   oauthKey.AccountID,
		Email:       oauthKey.Email,
		ChannelID:   ch.Id,
		ChannelType: ch.Type,
		ChannelName: ch.Name,
	})
}

type AddChannelRequest struct {
	Mode                      string                `json:"mode"`
	MultiKeyMode              constant.MultiKeyMode `json:"multi_key_mode"`
	BatchAddSetKeyPrefix2Name bool                  `json:"batch_add_set_key_prefix_2_name"`
	Channel                   *model.Channel        `json:"channel"`
}

func getVertexArrayKeys(keys string) ([]string, error) {
	if keys == "" {
		return nil, nil
	}
	var keyArray []interface{}
	err := common.Unmarshal([]byte(keys), &keyArray)
	if err != nil {
		return nil, fmt.Errorf("批量添加 Vertex AI 必须使用标准的JsonArray格式，例如[{key1}, {key2}...]，请检查输入: %w", err)
	}
	cleanKeys := make([]string, 0, len(keyArray))
	for _, key := range keyArray {
		var keyStr string
		switch v := key.(type) {
		case string:
			keyStr = strings.TrimSpace(v)
		default:
			bytes, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("Vertex AI key JSON 编码失败: %w", err)
			}
			keyStr = string(bytes)
		}
		if keyStr != "" {
			cleanKeys = append(cleanKeys, keyStr)
		}
	}
	if len(cleanKeys) == 0 {
		return nil, fmt.Errorf("批量添加 Vertex AI 的 keys 不能为空")
	}
	return cleanKeys, nil
}

func AddChannel(c fuego.ContextWithBody[AddChannelRequest]) (dto.MessageResponse, error) {
	addChannelRequest, err := c.Body()
	if err != nil {
		return dto.FailMsg(err.Error())
	}

	// 使用统一的校验函数
	if err := validateChannel(addChannelRequest.Channel, true); err != nil {
		return dto.FailMsg(err.Error())
	}

	addChannelRequest.Channel.CreatedTime = common.GetTimestamp()
	keys := make([]string, 0)
	switch addChannelRequest.Mode {
	case "multi_to_single":
		addChannelRequest.Channel.ChannelInfo.IsMultiKey = true
		addChannelRequest.Channel.ChannelInfo.MultiKeyMode = addChannelRequest.MultiKeyMode
		if addChannelRequest.Channel.Type == constant.ChannelTypeVertexAi && addChannelRequest.Channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
			array, err := getVertexArrayKeys(addChannelRequest.Channel.Key)
			if err != nil {
				return dto.FailMsg(err.Error())
			}
			addChannelRequest.Channel.ChannelInfo.MultiKeySize = len(array)
			addChannelRequest.Channel.Key = strings.Join(array, "\n")
		} else {
			cleanKeys := make([]string, 0)
			for _, key := range strings.Split(addChannelRequest.Channel.Key, "\n") {
				if key == "" {
					continue
				}
				key = strings.TrimSpace(key)
				cleanKeys = append(cleanKeys, key)
			}
			addChannelRequest.Channel.ChannelInfo.MultiKeySize = len(cleanKeys)
			addChannelRequest.Channel.Key = strings.Join(cleanKeys, "\n")
		}
		keys = []string{addChannelRequest.Channel.Key}
	case "batch":
		if addChannelRequest.Channel.Type == constant.ChannelTypeVertexAi && addChannelRequest.Channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
			// multi json
			keys, err = getVertexArrayKeys(addChannelRequest.Channel.Key)
			if err != nil {
				return dto.FailMsg(err.Error())
			}
		} else {
			keys = strings.Split(addChannelRequest.Channel.Key, "\n")
		}
	case "single":
		keys = []string{addChannelRequest.Channel.Key}
	default:
		return dto.FailMsg("不支持的添加模式")
	}

	channels := make([]model.Channel, 0, len(keys))
	for _, key := range keys {
		if key == "" {
			continue
		}
		localChannel := addChannelRequest.Channel
		localChannel.Key = key
		if addChannelRequest.BatchAddSetKeyPrefix2Name && len(keys) > 1 {
			keyPrefix := localChannel.Key
			if len(localChannel.Key) > 8 {
				keyPrefix = localChannel.Key[:8]
			}
			localChannel.Name = fmt.Sprintf("%s %s", localChannel.Name, keyPrefix)
		}
		channels = append(channels, *localChannel)
	}
	err = model.BatchInsertChannels(channels)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	service.ResetProxyClientCache()
	return dto.Msg("")
}

func DeleteChannel(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil || id <= 0 {
		return dto.FailMsg("无效的渠道 ID")
	}
	channel := model.Channel{Id: id}
	err = channel.Delete()
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	model.InitChannelCache()
	return dto.Msg("")
}

func DeleteDisabledChannel(c fuego.ContextNoBody) (*dto.Response[int64], error) {
	rows, err := model.DeleteDisabledChannel()
	if err != nil {
		return dto.Fail[int64](err.Error())
	}
	model.InitChannelCache()
	return dto.Ok(rows)
}

type ChannelTag struct {
	Tag            string  `json:"tag"`
	NewTag         *string `json:"new_tag"`
	Priority       *int64  `json:"priority"`
	Weight         *uint   `json:"weight"`
	ModelMapping   *string `json:"model_mapping"`
	Models         *string `json:"models"`
	Groups         *string `json:"groups"`
	ParamOverride  *string `json:"param_override"`
	HeaderOverride *string `json:"header_override"`
}

func DisableTagChannels(c fuego.ContextWithBody[ChannelTag]) (dto.MessageResponse, error) {
	channelTag, err := c.Body()
	if err != nil || channelTag.Tag == "" {
		return dto.FailMsg("参数错误")
	}
	err = model.DisableChannelByTag(channelTag.Tag)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	model.InitChannelCache()
	return dto.Msg("")
}

func EnableTagChannels(c fuego.ContextWithBody[ChannelTag]) (dto.MessageResponse, error) {
	channelTag, err := c.Body()
	if err != nil || channelTag.Tag == "" {
		return dto.FailMsg("参数错误")
	}
	err = model.EnableChannelByTag(channelTag.Tag)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	model.InitChannelCache()
	return dto.Msg("")
}

func EditTagChannels(c fuego.ContextWithBody[ChannelTag]) (dto.MessageResponse, error) {
	channelTag, err := c.Body()
	if err != nil {
		return dto.FailMsg("参数错误")
	}
	if channelTag.Tag == "" {
		return dto.FailMsg("tag不能为空")
	}
	if channelTag.ParamOverride != nil {
		trimmed := strings.TrimSpace(*channelTag.ParamOverride)
		if trimmed != "" && !json.Valid([]byte(trimmed)) {
			return dto.FailMsg("参数覆盖必须是合法的 JSON 格式")
		}
		channelTag.ParamOverride = common.GetPointer[string](trimmed)
	}
	if channelTag.HeaderOverride != nil {
		trimmed := strings.TrimSpace(*channelTag.HeaderOverride)
		if trimmed != "" && !json.Valid([]byte(trimmed)) {
			return dto.FailMsg("请求头覆盖必须是合法的 JSON 格式")
		}
		channelTag.HeaderOverride = common.GetPointer[string](trimmed)
	}
	err = model.EditChannelByTag(channelTag.Tag, channelTag.NewTag, channelTag.ModelMapping, channelTag.Models, channelTag.Groups, channelTag.Priority, channelTag.Weight, channelTag.ParamOverride, channelTag.HeaderOverride)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	model.InitChannelCache()
	return dto.Msg("")
}

type ChannelBatch struct {
	Ids []int   `json:"ids"`
	Tag *string `json:"tag"`
}

func DeleteChannelBatch(c fuego.ContextWithBody[ChannelBatch]) (*dto.Response[int], error) {
	channelBatch, err := c.Body()
	if err != nil || len(channelBatch.Ids) == 0 {
		return dto.Fail[int]("参数错误")
	}
	err = model.BatchDeleteChannels(channelBatch.Ids)
	if err != nil {
		return dto.Fail[int](err.Error())
	}
	model.InitChannelCache()
	return dto.Ok(len(channelBatch.Ids))
}

type PatchChannel struct {
	model.Channel
	MultiKeyMode *string `json:"multi_key_mode"`
	KeyMode      *string `json:"key_mode"` // 多key模式下密钥覆盖或者追加
}

func UpdateChannel(c fuego.ContextWithBody[PatchChannel]) (*dto.Response[PatchChannel], error) {
	channel, err := c.Body()
	if err != nil {
		return dto.Fail[PatchChannel](err.Error())
	}

	// 使用统一的校验函数
	if err := validateChannel(&channel.Channel, false); err != nil {
		return dto.Fail[PatchChannel](err.Error())
	}
	// Preserve existing ChannelInfo to ensure multi-key channels keep correct state even if the client does not send ChannelInfo in the request.
	originChannel, err := model.GetChannelById(channel.Id, true)
	if err != nil {
		return dto.Fail[PatchChannel](err.Error())
	}

	// Always copy the original ChannelInfo so that fields like IsMultiKey and MultiKeySize are retained.
	channel.ChannelInfo = originChannel.ChannelInfo

	// If the request explicitly specifies a new MultiKeyMode, apply it on top of the original info.
	if channel.MultiKeyMode != nil && *channel.MultiKeyMode != "" {
		channel.ChannelInfo.MultiKeyMode = constant.MultiKeyMode(*channel.MultiKeyMode)
	}

	// 处理多key模式下的密钥追加/覆盖逻辑
	if channel.KeyMode != nil && channel.ChannelInfo.IsMultiKey {
		switch *channel.KeyMode {
		case "append":
			// 追加模式：将新密钥添加到现有密钥列表
			if originChannel.Key != "" {
				var newKeys []string
				var existingKeys []string

				// 解析现有密钥
				if strings.HasPrefix(strings.TrimSpace(originChannel.Key), "[") {
					// JSON数组格式
					var arr []json.RawMessage
					if err := json.Unmarshal([]byte(strings.TrimSpace(originChannel.Key)), &arr); err == nil {
						existingKeys = make([]string, len(arr))
						for i, v := range arr {
							existingKeys[i] = string(v)
						}
					}
				} else {
					// 换行分隔格式
					existingKeys = strings.Split(strings.Trim(originChannel.Key, "\n"), "\n")
				}

				// 处理 Vertex AI 的特殊情况
				if channel.Type == constant.ChannelTypeVertexAi && channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
					// 尝试解析新密钥为JSON数组
					if strings.HasPrefix(strings.TrimSpace(channel.Key), "[") {
						array, err := getVertexArrayKeys(channel.Key)
						if err != nil {
							return dto.Fail[PatchChannel]("追加密钥解析失败: " + err.Error())
						}
						newKeys = array
					} else {
						// 单个JSON密钥
						newKeys = []string{channel.Key}
					}
				} else {
					// 普通渠道的处理
					inputKeys := strings.Split(channel.Key, "\n")
					for _, key := range inputKeys {
						key = strings.TrimSpace(key)
						if key != "" {
							newKeys = append(newKeys, key)
						}
					}
				}

				seen := make(map[string]struct{}, len(existingKeys)+len(newKeys))
				for _, key := range existingKeys {
					normalized := strings.TrimSpace(key)
					if normalized == "" {
						continue
					}
					seen[normalized] = struct{}{}
				}
				dedupedNewKeys := make([]string, 0, len(newKeys))
				for _, key := range newKeys {
					normalized := strings.TrimSpace(key)
					if normalized == "" {
						continue
					}
					if _, ok := seen[normalized]; ok {
						continue
					}
					seen[normalized] = struct{}{}
					dedupedNewKeys = append(dedupedNewKeys, normalized)
				}

				allKeys := append(existingKeys, dedupedNewKeys...)
				channel.Key = strings.Join(allKeys, "\n")
			}
		case "replace":
			// 覆盖模式：直接使用新密钥（默认行为，不需要特殊处理）
		}
	}
	err = channel.Update()
	if err != nil {
		return dto.Fail[PatchChannel](err.Error())
	}
	model.InitChannelCache()
	service.ResetProxyClientCache()
	channel.Key = ""
	clearChannelInfo(&channel.Channel)
	return dto.Ok(channel)
}

type FetchModelsRequest struct {
	BaseURL string `json:"base_url"`
	Type    int    `json:"type"`
	Key     string `json:"key"`
}

func FetchModels(c fuego.ContextWithBody[FetchModelsRequest]) (*dto.Response[[]string], error) {
	req, err := c.Body()
	if err != nil {
		return dto.Fail[[]string]("Invalid request")
	}

	baseURL := req.BaseURL
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[req.Type]
	}

	// remove line breaks and extra spaces.
	key := strings.TrimSpace(req.Key)
	key = strings.Split(key, "\n")[0]

	if req.Type == constant.ChannelTypeOllama {
		models, err := ollama.FetchOllamaModels(baseURL, key)
		if err != nil {
			return dto.Fail[[]string](fmt.Sprintf("获取Ollama模型失败: %s", err.Error()))
		}

		names := make([]string, 0, len(models))
		for _, modelInfo := range models {
			names = append(names, modelInfo.Name)
		}

		return dto.Ok(names)
	}

	if req.Type == constant.ChannelTypeGemini {
		models, err := gemini.FetchGeminiModels(baseURL, key, "")
		if err != nil {
			return dto.Fail[[]string](fmt.Sprintf("获取Gemini模型失败: %s", err.Error()))
		}

		return dto.Ok(models)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := fmt.Sprintf("%s/v1/models", baseURL)

	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return dto.Fail[[]string](err.Error())
	}

	request.Header.Set("Authorization", "Bearer "+key)

	response, err := client.Do(request)
	if err != nil {
		return dto.Fail[[]string](err.Error())
	}
	// check status code
	if response.StatusCode != http.StatusOK {
		return dto.Fail[[]string]("Failed to fetch models")
	}
	defer response.Body.Close()

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := common.DecodeJson(response.Body, &result); err != nil {
		return dto.Fail[[]string](err.Error())
	}

	var models []string
	for _, model := range result.Data {
		models = append(models, model.ID)
	}

	return dto.Ok(models)
}

func BatchSetChannelTag(c fuego.ContextWithBody[ChannelBatch]) (*dto.Response[int], error) {
	channelBatch, err := c.Body()
	if err != nil || len(channelBatch.Ids) == 0 {
		return dto.Fail[int]("参数错误")
	}
	err = model.BatchSetChannelTag(channelBatch.Ids, channelBatch.Tag)
	if err != nil {
		return dto.Fail[int](err.Error())
	}
	model.InitChannelCache()
	return dto.Ok(len(channelBatch.Ids))
}

func GetTagModels(c fuego.ContextWithParams[dto.GetTagModelsParams]) (*dto.Response[string], error) {
	p, _ := dto.ParseParams[dto.GetTagModelsParams](c)
	tag := p.Tag
	if tag == "" {
		return dto.Fail[string]("tag不能为空")
	}

	channels, err := model.GetChannelsByTag(tag, false, false) // idSort=false, selectAll=false
	if err != nil {
		return dto.Fail[string](err.Error())
	}

	var longestModels string
	maxLength := 0

	// Find the longest models string among all channels with the given tag
	for _, channel := range channels {
		if channel.Models != "" {
			currentModels := strings.Split(channel.Models, ",")
			if len(currentModels) > maxLength {
				maxLength = len(currentModels)
				longestModels = channel.Models
			}
		}
	}

	return dto.Ok(longestModels)
}

// CopyChannel handles cloning an existing channel with its key.
// POST /api/channel/copy/:id
// Optional query params:
//
//	suffix         - string appended to the original name (default "_复制")
//	reset_balance  - bool, when true will reset balance & used_quota to 0 (default true)
func CopyChannel(c fuego.ContextWithParams[dto.CopyChannelParams]) (*dto.Response[dto.CopyChannelData], error) {
	p, _ := dto.ParseParams[dto.CopyChannelParams](c)
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.CopyChannelData]("invalid id")
	}

	suffix := p.Suffix
	if suffix == "" {
		suffix = "_复制"
	}
	resetBalance := true
	if c.QueryParam("reset_balance") != "" {
		resetBalance = p.ResetBalance
	}

	// fetch original channel with key
	origin, err := model.GetChannelById(id, true)
	if err != nil {
		common.SysError("failed to get channel by id: " + err.Error())
		return dto.Fail[dto.CopyChannelData]("获取渠道信息失败，请稍后重试")
	}

	// clone channel
	clone := *origin // shallow copy is sufficient as we will overwrite primitives
	clone.Id = 0     // let DB auto-generate
	clone.CreatedTime = common.GetTimestamp()
	clone.Name = origin.Name + suffix
	clone.TestTime = 0
	clone.ResponseTime = 0
	if resetBalance {
		clone.Balance = 0
		clone.UsedQuota = 0
	}

	// insert
	channels := []model.Channel{clone}
	if err := model.BatchInsertChannels(channels); err != nil {
		common.SysError("failed to clone channel: " + err.Error())
		return dto.Fail[dto.CopyChannelData]("复制渠道失败，请稍后重试")
	}
	model.InitChannelCache()
	// success
	return dto.Ok(dto.CopyChannelData{ID: channels[0].Id})
}

// MultiKeyManageRequest represents the request for multi-key management operations
type MultiKeyManageRequest struct {
	ChannelId int    `json:"channel_id"`
	Action    string `json:"action"`              // "disable_key", "enable_key", "delete_key", "delete_disabled_keys", "get_key_status"
	KeyIndex  *int   `json:"key_index,omitempty"` // for disable_key, enable_key, and delete_key actions
	Page      int    `json:"page,omitempty"`      // for get_key_status pagination
	PageSize  int    `json:"page_size,omitempty"` // for get_key_status pagination
	Status    *int   `json:"status,omitempty"`    // for get_key_status filtering: 1=enabled, 2=manual_disabled, 3=auto_disabled, nil=all
}

// ManageMultiKeys handles multi-key management operations
func ManageMultiKeys(c fuego.ContextWithBody[MultiKeyManageRequest]) (dto.ApiResponse, error) {
	request, err := c.Body()
	if err != nil {
		return dto.FailAny(err.Error())
	}

	channel, err := model.GetChannelById(request.ChannelId, true)
	if err != nil {
		return dto.FailAny("渠道不存在")
	}

	if !channel.ChannelInfo.IsMultiKey {
		return dto.FailAny("该渠道不是多密钥模式")
	}

	lock := model.GetChannelPollingLock(channel.Id)
	lock.Lock()
	defer lock.Unlock()

	switch request.Action {
	case "get_key_status":
		keys := channel.GetKeys()

		// Default pagination parameters
		page := request.Page
		pageSize := request.PageSize
		if page <= 0 {
			page = 1
		}
		if pageSize <= 0 {
			pageSize = 50 // Default page size
		}

		// Statistics for all keys (unchanged by filtering)
		var enabledCount, manualDisabledCount, autoDisabledCount int

		// Build all key status data first
		var allKeyStatusList []dto.KeyStatus
		for i, key := range keys {
			status := 1 // default enabled
			var disabledTime int64
			var reason string

			if channel.ChannelInfo.MultiKeyStatusList != nil {
				if s, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists {
					status = s
				}
			}

			// Count for statistics (all keys)
			switch status {
			case 1:
				enabledCount++
			case 2:
				manualDisabledCount++
			case 3:
				autoDisabledCount++
			}

			if status != 1 {
				if channel.ChannelInfo.MultiKeyDisabledTime != nil {
					disabledTime = channel.ChannelInfo.MultiKeyDisabledTime[i]
				}
				if channel.ChannelInfo.MultiKeyDisabledReason != nil {
					reason = channel.ChannelInfo.MultiKeyDisabledReason[i]
				}
			}

			// Create key preview (first 10 chars)
			keyPreview := key
			if len(key) > 10 {
				keyPreview = key[:10] + "..."
			}

			allKeyStatusList = append(allKeyStatusList, dto.KeyStatus{
				Index:        i,
				Status:       status,
				DisabledTime: disabledTime,
				Reason:       reason,
				KeyPreview:   keyPreview,
			})
		}

		// Apply status filter if specified
		var filteredKeyStatusList []dto.KeyStatus
		if request.Status != nil {
			for _, keyStatus := range allKeyStatusList {
				if keyStatus.Status == *request.Status {
					filteredKeyStatusList = append(filteredKeyStatusList, keyStatus)
				}
			}
		} else {
			filteredKeyStatusList = allKeyStatusList
		}

		// Calculate pagination based on filtered results
		filteredTotal := len(filteredKeyStatusList)
		totalPages := (filteredTotal + pageSize - 1) / pageSize
		if totalPages == 0 {
			totalPages = 1
		}
		if page > totalPages {
			page = totalPages
		}

		// Calculate range for current page
		start := (page - 1) * pageSize
		end := start + pageSize
		if end > filteredTotal {
			end = filteredTotal
		}

		// Get the page data
		var pageKeyStatusList []dto.KeyStatus
		if start < filteredTotal {
			pageKeyStatusList = filteredKeyStatusList[start:end]
		}

		return dto.OkAny(dto.MultiKeyStatusResponse{
			Keys:                pageKeyStatusList,
			Total:               filteredTotal, // Total of filtered results
			Page:                page,
			PageSize:            pageSize,
			TotalPages:          totalPages,
			EnabledCount:        enabledCount,        // Overall statistics
			ManualDisabledCount: manualDisabledCount, // Overall statistics
			AutoDisabledCount:   autoDisabledCount,   // Overall statistics
		})

	case "disable_key":
		if request.KeyIndex == nil {
			return dto.FailAny("未指定要禁用的密钥索引")
		}

		keyIndex := *request.KeyIndex
		if keyIndex < 0 || keyIndex >= channel.ChannelInfo.MultiKeySize {
			return dto.FailAny("密钥索引超出范围")
		}

		if channel.ChannelInfo.MultiKeyStatusList == nil {
			channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime == nil {
			channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		}
		if channel.ChannelInfo.MultiKeyDisabledReason == nil {
			channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
		}

		channel.ChannelInfo.MultiKeyStatusList[keyIndex] = 2 // disabled

		err = channel.Update()
		if err != nil {
			return dto.FailAny(err.Error())
		}

		model.InitChannelCache()
		return dto.OkMsgAny("密钥已禁用", nil)

	case "enable_key":
		if request.KeyIndex == nil {
			return dto.FailAny("未指定要启用的密钥索引")
		}

		keyIndex := *request.KeyIndex
		if keyIndex < 0 || keyIndex >= channel.ChannelInfo.MultiKeySize {
			return dto.FailAny("密钥索引超出范围")
		}

		// 从状态列表中删除该密钥的记录，使其回到默认启用状态
		if channel.ChannelInfo.MultiKeyStatusList != nil {
			delete(channel.ChannelInfo.MultiKeyStatusList, keyIndex)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime != nil {
			delete(channel.ChannelInfo.MultiKeyDisabledTime, keyIndex)
		}
		if channel.ChannelInfo.MultiKeyDisabledReason != nil {
			delete(channel.ChannelInfo.MultiKeyDisabledReason, keyIndex)
		}

		err = channel.Update()
		if err != nil {
			return dto.FailAny(err.Error())
		}

		model.InitChannelCache()
		return dto.OkMsgAny("密钥已启用", nil)

	case "enable_all_keys":
		// 清空所有禁用状态，使所有密钥回到默认启用状态
		var enabledCount int
		if channel.ChannelInfo.MultiKeyStatusList != nil {
			enabledCount = len(channel.ChannelInfo.MultiKeyStatusList)
		}

		channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)

		err = channel.Update()
		if err != nil {
			return dto.FailAny(err.Error())
		}

		model.InitChannelCache()
		return dto.OkMsgAny(fmt.Sprintf("已启用 %d 个密钥", enabledCount), nil)

	case "disable_all_keys":
		// 禁用所有启用的密钥
		if channel.ChannelInfo.MultiKeyStatusList == nil {
			channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime == nil {
			channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		}
		if channel.ChannelInfo.MultiKeyDisabledReason == nil {
			channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
		}

		var disabledCount int
		for i := 0; i < channel.ChannelInfo.MultiKeySize; i++ {
			status := 1 // default enabled
			if s, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists {
				status = s
			}

			// 只禁用当前启用的密钥
			if status == 1 {
				channel.ChannelInfo.MultiKeyStatusList[i] = 2 // disabled
				disabledCount++
			}
		}

		if disabledCount == 0 {
			return dto.FailAny("没有可禁用的密钥")
		}

		err = channel.Update()
		if err != nil {
			return dto.FailAny(err.Error())
		}

		model.InitChannelCache()
		return dto.OkMsgAny(fmt.Sprintf("已禁用 %d 个密钥", disabledCount), nil)

	case "delete_key":
		if request.KeyIndex == nil {
			return dto.FailAny("未指定要删除的密钥索引")
		}

		keyIndex := *request.KeyIndex
		if keyIndex < 0 || keyIndex >= channel.ChannelInfo.MultiKeySize {
			return dto.FailAny("密钥索引超出范围")
		}

		keys := channel.GetKeys()
		var remainingKeys []string
		var newStatusList = make(map[int]int)
		var newDisabledTime = make(map[int]int64)
		var newDisabledReason = make(map[int]string)

		newIndex := 0
		for i, key := range keys {
			// 跳过要删除的密钥
			if i == keyIndex {
				continue
			}

			remainingKeys = append(remainingKeys, key)

			// 保留其他密钥的状态信息，重新索引
			if channel.ChannelInfo.MultiKeyStatusList != nil {
				if status, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists && status != 1 {
					newStatusList[newIndex] = status
				}
			}
			if channel.ChannelInfo.MultiKeyDisabledTime != nil {
				if t, exists := channel.ChannelInfo.MultiKeyDisabledTime[i]; exists {
					newDisabledTime[newIndex] = t
				}
			}
			if channel.ChannelInfo.MultiKeyDisabledReason != nil {
				if r, exists := channel.ChannelInfo.MultiKeyDisabledReason[i]; exists {
					newDisabledReason[newIndex] = r
				}
			}
			newIndex++
		}

		if len(remainingKeys) == 0 {
			return dto.FailAny("不能删除最后一个密钥")
		}

		// Update channel with remaining keys
		channel.Key = strings.Join(remainingKeys, "\n")
		channel.ChannelInfo.MultiKeySize = len(remainingKeys)
		channel.ChannelInfo.MultiKeyStatusList = newStatusList
		channel.ChannelInfo.MultiKeyDisabledTime = newDisabledTime
		channel.ChannelInfo.MultiKeyDisabledReason = newDisabledReason

		err = channel.Update()
		if err != nil {
			return dto.FailAny(err.Error())
		}

		model.InitChannelCache()
		return dto.OkMsgAny("密钥已删除", nil)

	case "delete_disabled_keys":
		keys := channel.GetKeys()
		var remainingKeys []string
		var deletedCount int
		var newStatusList = make(map[int]int)
		var newDisabledTime = make(map[int]int64)
		var newDisabledReason = make(map[int]string)

		newIndex := 0
		for i, key := range keys {
			status := 1 // default enabled
			if channel.ChannelInfo.MultiKeyStatusList != nil {
				if s, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists {
					status = s
				}
			}

			// 只删除自动禁用（status == 3）的密钥，保留启用（status == 1）和手动禁用（status == 2）的密钥
			if status == 3 {
				deletedCount++
			} else {
				remainingKeys = append(remainingKeys, key)
				// 保留非自动禁用密钥的状态信息，重新索引
				if status != 1 {
					newStatusList[newIndex] = status
					if channel.ChannelInfo.MultiKeyDisabledTime != nil {
						if t, exists := channel.ChannelInfo.MultiKeyDisabledTime[i]; exists {
							newDisabledTime[newIndex] = t
						}
					}
					if channel.ChannelInfo.MultiKeyDisabledReason != nil {
						if r, exists := channel.ChannelInfo.MultiKeyDisabledReason[i]; exists {
							newDisabledReason[newIndex] = r
						}
					}
				}
				newIndex++
			}
		}

		if deletedCount == 0 {
			return dto.FailAny("没有需要删除的自动禁用密钥")
		}

		// Update channel with remaining keys
		channel.Key = strings.Join(remainingKeys, "\n")
		channel.ChannelInfo.MultiKeySize = len(remainingKeys)
		channel.ChannelInfo.MultiKeyStatusList = newStatusList
		channel.ChannelInfo.MultiKeyDisabledTime = newDisabledTime
		channel.ChannelInfo.MultiKeyDisabledReason = newDisabledReason

		err = channel.Update()
		if err != nil {
			return dto.FailAny(err.Error())
		}

		model.InitChannelCache()
		return dto.OkMsgAny(fmt.Sprintf("已删除 %d 个自动禁用的密钥", deletedCount), deletedCount)

	default:
		return dto.FailAny("不支持的操作")
	}
}

// OllamaModelRequest is the request body for Ollama model operations (pull, pull-stream, delete).
type OllamaModelRequest struct {
	ChannelID int    `json:"channel_id"`
	ModelName string `json:"model_name"`
}

// OllamaPullModel 拉取 Ollama 模型
func OllamaPullModel(c fuego.ContextWithBody[OllamaModelRequest]) (dto.MessageResponse, error) {
	req, err := c.Body()
	if err != nil {
		return dto.FailMsg("Invalid request parameters")
	}

	if req.ChannelID == 0 || req.ModelName == "" {
		return dto.FailMsg("Channel ID and model name are required")
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		return dto.FailMsg("Channel not found")
	}

	// 检查是否是 Ollama 渠道
	if channel.Type != constant.ChannelTypeOllama {
		return dto.FailMsg("This operation is only supported for Ollama channels")
	}

	baseURL := constant.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	key := strings.Split(channel.Key, "\n")[0]
	err = ollama.PullOllamaModel(baseURL, key, req.ModelName)
	if err != nil {
		return dto.FailMsg(fmt.Sprintf("Failed to pull model: %s", err.Error()))
	}

	return dto.Msg(fmt.Sprintf("Model %s pulled successfully", req.ModelName))
}

// OllamaPullModelStream 流式拉取 Ollama 模型
// This handler uses SSE streaming via c.Stream() and MUST stay as *gin.Context.
func OllamaPullModelStream(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		ModelName string `json:"model_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ApiResponse{Message: "Invalid request parameters"})
		return
	}

	if req.ChannelID == 0 || req.ModelName == "" {
		c.JSON(http.StatusBadRequest, dto.ApiResponse{Message: "Channel ID and model name are required"})
		return
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.ApiResponse{Message: "Channel not found"})
		return
	}

	// 检查是否是 Ollama 渠道
	if channel.Type != constant.ChannelTypeOllama {
		c.JSON(http.StatusBadRequest, dto.ApiResponse{Message: "This operation is only supported for Ollama channels"})
		return
	}

	baseURL := constant.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	// 设置 SSE 头部
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	key := strings.Split(channel.Key, "\n")[0]

	// 创建进度回调函数
	progressCallback := func(progress ollama.OllamaPullResponse) {
		data, _ := json.Marshal(progress)
		fmt.Fprintf(c.Writer, "data: %s\n\n", string(data))
		c.Writer.Flush()
	}

	// 执行拉取
	err = ollama.PullOllamaModelStream(baseURL, key, req.ModelName, progressCallback)

	if err != nil {
		errorData, _ := json.Marshal(gin.H{
			"error": err.Error(),
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", string(errorData))
	} else {
		successData, _ := json.Marshal(gin.H{
			"message": fmt.Sprintf("Model %s pulled successfully", req.ModelName),
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", string(successData))
	}

	// 发送结束标志
	fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
	c.Writer.Flush()
}

// OllamaDeleteModel 删除 Ollama 模型
func OllamaDeleteModel(c fuego.ContextWithBody[OllamaModelRequest]) (dto.MessageResponse, error) {
	req, err := c.Body()
	if err != nil {
		return dto.FailMsg("Invalid request parameters")
	}

	if req.ChannelID == 0 || req.ModelName == "" {
		return dto.FailMsg("Channel ID and model name are required")
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		return dto.FailMsg("Channel not found")
	}

	// 检查是否是 Ollama 渠道
	if channel.Type != constant.ChannelTypeOllama {
		return dto.FailMsg("This operation is only supported for Ollama channels")
	}

	baseURL := constant.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	key := strings.Split(channel.Key, "\n")[0]
	err = ollama.DeleteOllamaModel(baseURL, key, req.ModelName)
	if err != nil {
		return dto.FailMsg(fmt.Sprintf("Failed to delete model: %s", err.Error()))
	}

	return dto.Msg(fmt.Sprintf("Model %s deleted successfully", req.ModelName))
}

// OllamaVersion 获取 Ollama 服务版本信息
func OllamaVersion(c fuego.ContextNoBody) (*dto.Response[dto.OllamaVersionData], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.OllamaVersionData]("Invalid channel id")
	}

	channel, err := model.GetChannelById(id, true)
	if err != nil {
		return dto.Fail[dto.OllamaVersionData]("Channel not found")
	}

	if channel.Type != constant.ChannelTypeOllama {
		return dto.Fail[dto.OllamaVersionData]("This operation is only supported for Ollama channels")
	}

	baseURL := constant.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	key := strings.Split(channel.Key, "\n")[0]
	version, err := ollama.FetchOllamaVersion(baseURL, key)
	if err != nil {
		return dto.Fail[dto.OllamaVersionData](fmt.Sprintf("获取Ollama版本失败: %s", err.Error()))
	}

	return dto.Ok(dto.OllamaVersionData{
		Version: version,
	})
}
