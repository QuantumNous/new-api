package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type OpenAIModel struct {
	ID         string `json:"id"`
	Object     string `json:"object"`
	Created    int64  `json:"created"`
	OwnedBy    string `json:"owned_by"`
	Permission []struct {
		ID                 string `json:"id"`
		Object             string `json:"object"`
		Created            int64  `json:"created"`
		AllowCreateEngine  bool   `json:"allow_create_engine"`
		AllowSampling      bool   `json:"allow_sampling"`
		AllowLogprobs      bool   `json:"allow_logprobs"`
		AllowSearchIndices bool   `json:"allow_search_indices"`
		AllowView          bool   `json:"allow_view"`
		AllowFineTuning    bool   `json:"allow_fine_tuning"`
		Organization       string `json:"organization"`
		Group              string `json:"group"`
		IsBlocking         bool   `json:"is_blocking"`
	} `json:"permission"`
	Root   string `json:"root"`
	Parent string `json:"parent"`
}

type OpenAIModelsResponse struct {
	Data    []OpenAIModel `json:"data"`
	Success bool          `json:"success"`
}

// AnthropicModel 定义Anthropic API返回的模型结构
type AnthropicModel struct {
	ID          string `json:"id"`
	CreatedAt   string `json:"created_at"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"`
}

// AnthropicModelsResponse 定义Anthropic API响应结构
type AnthropicModelsResponse struct {
	Data    []AnthropicModel `json:"data"`
	FirstID string           `json:"first_id"`
	HasMore bool             `json:"has_more"`
	LastID  string           `json:"last_id"`
}

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

func GetAllChannels(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	channelData := make([]*model.Channel, 0)
	idSort, _ := strconv.ParseBool(c.Query("id_sort"))
	enableTagMode, _ := strconv.ParseBool(c.Query("tag_mode"))
	statusParam := c.Query("status")
	// statusFilter: -1 all, 1 enabled, 0 disabled (include auto & manual)
	statusFilter := parseStatusFilter(statusParam)
	// type filter
	typeStr := c.Query("type")
	typeFilter := -1
	if typeStr != "" {
		if t, err := strconv.Atoi(typeStr); err == nil {
			typeFilter = t
		}
	}

	var total int64

	if enableTagMode {
		tags, err := model.GetPaginatedTags(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		for _, tag := range tags {
			if tag == nil || *tag == "" {
				continue
			}
			tagChannels, err := model.GetChannelsByTag(*tag, idSort)
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
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
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
	common.ApiSuccess(c, gin.H{
		"items":       channelData,
		"total":       total,
		"page":        pageInfo.GetPage(),
		"page_size":   pageInfo.GetPageSize(),
		"type_counts": typeCounts,
	})
	return
}

func getChannelBaseURL(channelType int, customURL string) string {
	if customURL != "" {
		return customURL
	}

	if channelType >= 0 && channelType < len(constant.ChannelBaseURLs) {
		return constant.ChannelBaseURLs[channelType]
	}

	return "" // 返回空字符串，让调用方处理
}

// 构建API端点URL
func buildModelsURL(channelType int, baseURL string) string {
	switch channelType {
	case constant.ChannelTypeGemini:
		return fmt.Sprintf("%s/v1beta/openai/models", baseURL)
	case constant.ChannelTypeAli:
		return fmt.Sprintf("%s/compatible-mode/v1/models", baseURL)
	default:
		return fmt.Sprintf("%s/v1/models", baseURL)
	}
}

// 获取认证头
func getAuthHeaders(channel *model.Channel) http.Header {
	switch channel.Type {
	case constant.ChannelTypeAnthropic:
		headers := make(http.Header)
		headers.Set("x-api-key", strings.TrimSpace(channel.Key))
		headers.Set("anthropic-version", "2023-06-01")
		headers.Set("Content-Type", "application/json")
		return headers
	default:
		return GetAuthHeader(channel.Key)
	}
}

// 解析不同类型的模型响应
func parseModelsResponse(channelType int, body []byte) ([]string, error) {
	var ids []string

	switch channelType {
	case constant.ChannelTypeAnthropic:
		var anthropicResult AnthropicModelsResponse
		if err := json.Unmarshal(body, &anthropicResult); err != nil {
			return nil, fmt.Errorf("解析Anthropic响应失败: %s", err.Error())
		}

		for _, model := range anthropicResult.Data {
			ids = append(ids, model.ID)
		}

	default:
		var result OpenAIModelsResponse
		if err := json.Unmarshal(body, &result); err != nil {
			return nil, fmt.Errorf("解析OpenAI格式响应失败: %s", err.Error())
		}

		for _, model := range result.Data {
			id := model.ID
			if channelType == constant.ChannelTypeGemini {
				id = strings.TrimPrefix(id, "models/")
			}
			ids = append(ids, id)
		}
	}

	return ids, nil
}

func FetchUpstreamModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	channel, err := model.GetChannelById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 安全获取基础URL
	baseURL := getChannelBaseURL(channel.Type, channel.GetBaseURL())
	if baseURL == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("不支持的渠道类型: %d", channel.Type),
		})
		return
	}

	// 构建请求URL
	url := buildModelsURL(channel.Type, baseURL)

	// 获取认证头
	headers := getAuthHeaders(channel)

	// 发起请求
	body, err := GetResponseBody("GET", url, channel, headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("请求失败: %s", err.Error()),
		})
		return
	}

	// 解析响应
	ids, err := parseModelsResponse(channel.Type, body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    ids,
	})
}

func FixChannelsAbilities(c *gin.Context) {
	success, fails, err := model.FixAbility()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"success": success,
			"fails":   fails,
		},
	})
}

func SearchChannels(c *gin.Context) {
	keyword := c.Query("keyword")
	group := c.Query("group")
	modelKeyword := c.Query("model")
	statusParam := c.Query("status")
	statusFilter := parseStatusFilter(statusParam)
	idSort, _ := strconv.ParseBool(c.Query("id_sort"))
	enableTagMode, _ := strconv.ParseBool(c.Query("tag_mode"))
	channelData := make([]*model.Channel, 0)
	if enableTagMode {
		tags, err := model.SearchTags(keyword, group, modelKeyword, idSort)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		for _, tag := range tags {
			if tag != nil && *tag != "" {
				tagChannel, err := model.GetChannelsByTag(*tag, idSort)
				if err == nil {
					channelData = append(channelData, tagChannel...)
				}
			}
		}
	} else {
		channels, err := model.SearchChannels(keyword, group, modelKeyword, idSort)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
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

	typeParam := c.Query("type")
	typeFilter := -1
	if typeParam != "" {
		if tp, err := strconv.Atoi(typeParam); err == nil {
			typeFilter = tp
		}
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

	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":       pagedData,
			"total":       total,
			"type_counts": typeCounts,
		},
	})
	return
}

func GetChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channel,
	})
	return
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

	return nil
}

type AddChannelRequest struct {
	Mode         string                `json:"mode"`
	MultiKeyMode constant.MultiKeyMode `json:"multi_key_mode"`
	Channel      *model.Channel        `json:"channel"`
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

func AddChannel(c *gin.Context) {
	addChannelRequest := AddChannelRequest{}
	err := c.ShouldBindJSON(&addChannelRequest)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 使用统一的校验函数
	if err := validateChannel(addChannelRequest.Channel, true); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	addChannelRequest.Channel.CreatedTime = common.GetTimestamp()
	keys := make([]string, 0)
	switch addChannelRequest.Mode {
	case "multi_to_single":
		addChannelRequest.Channel.ChannelInfo.IsMultiKey = true
		addChannelRequest.Channel.ChannelInfo.MultiKeyMode = addChannelRequest.MultiKeyMode
		if addChannelRequest.Channel.Type == constant.ChannelTypeVertexAi {
			array, err := getVertexArrayKeys(addChannelRequest.Channel.Key)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
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
		if addChannelRequest.Channel.Type == constant.ChannelTypeVertexAi {
			// multi json
			keys, err = getVertexArrayKeys(addChannelRequest.Channel.Key)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}
		} else {
			keys = strings.Split(addChannelRequest.Channel.Key, "\n")
		}
	case "single":
		keys = []string{addChannelRequest.Channel.Key}
	default:
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "不支持的添加模式",
		})
		return
	}

	channels := make([]model.Channel, 0, len(keys))
	for _, key := range keys {
		if key == "" {
			continue
		}
		localChannel := addChannelRequest.Channel
		localChannel.Key = key
		channels = append(channels, *localChannel)
	}
	err = model.BatchInsertChannels(channels)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteChannel(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	channel := model.Channel{Id: id}
	err := channel.Delete()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteDisabledChannel(c *gin.Context) {
	rows, err := model.DeleteDisabledChannel()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

type ChannelTag struct {
	Tag          string  `json:"tag"`
	NewTag       *string `json:"new_tag"`
	Priority     *int64  `json:"priority"`
	Weight       *uint   `json:"weight"`
	ModelMapping *string `json:"model_mapping"`
	Models       *string `json:"models"`
	Groups       *string `json:"groups"`
}

func DisableTagChannels(c *gin.Context) {
	channelTag := ChannelTag{}
	err := c.ShouldBindJSON(&channelTag)
	if err != nil || channelTag.Tag == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	err = model.DisableChannelByTag(channelTag.Tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func EnableTagChannels(c *gin.Context) {
	channelTag := ChannelTag{}
	err := c.ShouldBindJSON(&channelTag)
	if err != nil || channelTag.Tag == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	err = model.EnableChannelByTag(channelTag.Tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func EditTagChannels(c *gin.Context) {
	channelTag := ChannelTag{}
	err := c.ShouldBindJSON(&channelTag)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	if channelTag.Tag == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "tag不能为空",
		})
		return
	}
	err = model.EditChannelByTag(channelTag.Tag, channelTag.NewTag, channelTag.ModelMapping, channelTag.Models, channelTag.Groups, channelTag.Priority, channelTag.Weight)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type ChannelBatch struct {
	Ids []int   `json:"ids"`
	Tag *string `json:"tag"`
}

func DeleteChannelBatch(c *gin.Context) {
	channelBatch := ChannelBatch{}
	err := c.ShouldBindJSON(&channelBatch)
	if err != nil || len(channelBatch.Ids) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	err = model.BatchDeleteChannels(channelBatch.Ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    len(channelBatch.Ids),
	})
	return
}

type PatchChannel struct {
	model.Channel
	MultiKeyMode *string `json:"multi_key_mode"`
}

func UpdateChannel(c *gin.Context) {
	channel := PatchChannel{}
	err := c.ShouldBindJSON(&channel)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 使用统一的校验函数
	if err := validateChannel(&channel.Channel, false); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	// Preserve existing ChannelInfo to ensure multi-key channels keep correct state even if the client does not send ChannelInfo in the request.
	originChannel, err := model.GetChannelById(channel.Id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Always copy the original ChannelInfo so that fields like IsMultiKey and MultiKeySize are retained.
	channel.ChannelInfo = originChannel.ChannelInfo

	// If the request explicitly specifies a new MultiKeyMode, apply it on top of the original info.
	if channel.MultiKeyMode != nil && *channel.MultiKeyMode != "" {
		channel.ChannelInfo.MultiKeyMode = constant.MultiKeyMode(*channel.MultiKeyMode)
	}
	err = channel.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	channel.Key = ""
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channel,
	})
	return
}

func FetchModels(c *gin.Context) {
	var req struct {
		BaseURL string `json:"base_url"`
		Type    int    `json:"type"`
		Key     string `json:"key"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	// 获取基础URL
	baseURL := req.BaseURL
	if baseURL == "" {
		if req.Type >= 0 && req.Type < len(constant.ChannelBaseURLs) {
			baseURL = constant.ChannelBaseURLs[req.Type]
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Unsupported channel type",
			})
			return
		}
	}

	// 构建请求URL（复用现有逻辑）
	url := buildModelsURL(req.Type, baseURL)

	// 创建HTTP请求
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 设置认证头（可以复用现有的逻辑）
	key := strings.TrimSpace(strings.Split(req.Key, "\n")[0])
	switch req.Type {
	case constant.ChannelTypeAnthropic:
		request.Header.Set("x-api-key", key)
		request.Header.Set("anthropic-version", "2023-06-01")
		request.Header.Set("Content-Type", "application/json")
	default:
		request.Header.Set("Authorization", "Bearer "+key)
	}

	// 发起请求
	client := &http.Client{}
	response, err := client.Do(request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	defer response.Body.Close()

	// 检查状态码
	if response.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": fmt.Sprintf("Failed to fetch models, status code: %d", response.StatusCode),
		})
		return
	}

	// 读取响应体
	body, err := io.ReadAll(response.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 解析响应（复用现有逻辑）
	models, err := parseModelsResponse(req.Type, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    models,
	})
}
func BatchSetChannelTag(c *gin.Context) {
	channelBatch := ChannelBatch{}
	err := c.ShouldBindJSON(&channelBatch)
	if err != nil || len(channelBatch.Ids) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	err = model.BatchSetChannelTag(channelBatch.Ids, channelBatch.Tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    len(channelBatch.Ids),
	})
	return
}

func GetTagModels(c *gin.Context) {
	tag := c.Query("tag")
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "tag不能为空",
		})
		return
	}

	channels, err := model.GetChannelsByTag(tag, false) // Assuming false for idSort is fine here
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    longestModels,
	})
	return
}

// CopyChannel handles cloning an existing channel with its key.
// POST /api/channel/copy/:id
// Optional query params:
//
//	suffix         - string appended to the original name (default "_复制")
//	reset_balance  - bool, when true will reset balance & used_quota to 0 (default true)
func CopyChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}

	suffix := c.DefaultQuery("suffix", "_复制")
	resetBalance := true
	if rbStr := c.DefaultQuery("reset_balance", "true"); rbStr != "" {
		if v, err := strconv.ParseBool(rbStr); err == nil {
			resetBalance = v
		}
	}

	// fetch original channel with key
	origin, err := model.GetChannelById(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
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
	if err := model.BatchInsertChannels([]model.Channel{clone}); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	model.InitChannelCache()
	// success
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"id": clone.Id}})
}
