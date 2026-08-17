package controller

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/ai360"
	"github.com/QuantumNous/new-api/relay/channel/lingyiwanwu"
	"github.com/QuantumNous/new-api/relay/channel/minimax"
	"github.com/QuantumNous/new-api/relay/channel/moonshot"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// https://platform.openai.com/docs/api-reference/models/list

var openAIModels []dto.OpenAIModels
var openAIModelsMap map[string]dto.OpenAIModels
var channelId2Models map[int][]string

func init() {
	// https://platform.openai.com/docs/models/model-endpoint-compatibility
	for i := 0; i < constant.APITypeDummy; i++ {
		if i == constant.APITypeAIProxyLibrary {
			continue
		}
		adaptor := relay.GetAdaptor(i)
		channelName := adaptor.GetChannelName()
		modelNames := adaptor.GetModelList()
		for _, modelName := range modelNames {
			openAIModels = append(openAIModels, dto.OpenAIModels{
				Id:      modelName,
				Object:  "model",
				Created: 1626777600,
				OwnedBy: channelName,
			})
		}
	}
	for _, modelName := range ai360.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:      modelName,
			Object:  "model",
			Created: 1626777600,
			OwnedBy: ai360.ChannelName,
		})
	}
	for _, modelName := range moonshot.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:      modelName,
			Object:  "model",
			Created: 1626777600,
			OwnedBy: moonshot.ChannelName,
		})
	}
	for _, modelName := range lingyiwanwu.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:      modelName,
			Object:  "model",
			Created: 1626777600,
			OwnedBy: lingyiwanwu.ChannelName,
		})
	}
	for _, modelName := range minimax.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:      modelName,
			Object:  "model",
			Created: 1626777600,
			OwnedBy: minimax.ChannelName,
		})
	}
	for modelName, _ := range constant.MidjourneyModel2Action {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:      modelName,
			Object:  "model",
			Created: 1626777600,
			OwnedBy: "midjourney",
		})
	}
	openAIModelsMap = make(map[string]dto.OpenAIModels)
	for _, aiModel := range openAIModels {
		openAIModelsMap[aiModel.Id] = aiModel
	}
	channelId2Models = make(map[int][]string)
	for i := 1; i <= constant.ChannelTypeDummy; i++ {
		apiType, success := common.ChannelType2APIType(i)
		if !success || apiType == constant.APITypeAIProxyLibrary {
			continue
		}
		meta := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: i,
		}}
		adaptor := relay.GetAdaptor(apiType)
		adaptor.Init(meta)
		channelId2Models[i] = adaptor.GetModelList()
	}
	openAIModels = lo.UniqBy(openAIModels, func(m dto.OpenAIModels) string {
		return m.Id
	})
}

func channelOwnerName(channelType int) string {
	apiType, success := common.ChannelType2APIType(channelType)
	if !success {
		return strings.ToLower(constant.GetChannelTypeName(channelType))
	}
	adaptor := relay.GetAdaptor(apiType)
	if adaptor == nil {
		return strings.ToLower(constant.GetChannelTypeName(channelType))
	}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType: channelType,
	}})
	if name := strings.TrimSpace(adaptor.GetChannelName()); name != "" {
		return name
	}
	return strings.ToLower(constant.GetChannelTypeName(channelType))
}

func getPreferredModelOwners(modelNames []string, groups []string) map[string]string {
	channelTypes, err := model.GetPreferredModelOwnerChannelTypes(modelNames, groups)
	if err != nil {
		common.SysLog(fmt.Sprintf("GetPreferredModelOwnerChannelTypes error: %v", err))
		return map[string]string{}
	}

	ownerByChannelType := make(map[int]string)
	owners := make(map[string]string, len(channelTypes))
	for modelName, channelType := range channelTypes {
		owner, ok := ownerByChannelType[channelType]
		if !ok {
			owner = channelOwnerName(channelType)
			ownerByChannelType[channelType] = owner
		}
		if owner != "" {
			owners[modelName] = owner
		}
	}
	return owners
}

func buildOpenAIModel(modelName string, ownerByModel map[string]string) dto.OpenAIModels {
	return buildOpenAIModelWithEndpointTypes(modelName, ownerByModel, model.GetModelSupportEndpointTypes(modelName))
}

func buildOpenAIModelWithEndpointTypes(modelName string, ownerByModel map[string]string, endpointTypes []constant.EndpointType) dto.OpenAIModels {
	var oaiModel dto.OpenAIModels
	if staticModel, ok := openAIModelsMap[modelName]; ok {
		oaiModel = staticModel
	} else {
		oaiModel = dto.OpenAIModels{
			Id:      modelName,
			Object:  "model",
			Created: 1626777600,
			OwnedBy: "custom",
		}
	}
	if owner, ok := ownerByModel[modelName]; ok && owner != "" {
		oaiModel.OwnedBy = owner
	}
	oaiModel.SupportedEndpointTypes = endpointTypes
	return oaiModel
}

func tokenAllowsModel(tokenModelLimit map[string]bool, modelName string) bool {
	return tokenModelLimit[modelName] || tokenModelLimit[ratio_setting.FormatMatchingModelName(modelName)]
}

func projectModelEndpointTypesForToken(modelName string, tokenModelLimit map[string]bool, modelLimitEnabled bool) ([]constant.EndpointType, bool) {
	endpointTypes := model.GetModelSupportEndpointTypes(modelName)
	if !modelLimitEnabled {
		return endpointTypes, true
	}
	if strings.HasSuffix(modelName, ratio_setting.CompactModelSuffix) {
		return endpointTypes, tokenAllowsModel(tokenModelLimit, modelName)
	}

	baseAllowed := tokenAllowsModel(tokenModelLimit, modelName)
	compactAllowed := slices.Contains(endpointTypes, constant.EndpointTypeOpenAIResponseCompact) &&
		tokenAllowsModel(tokenModelLimit, ratio_setting.WithCompactModelSuffix(modelName))
	if !baseAllowed && !compactAllowed {
		return nil, false
	}

	projected := make([]constant.EndpointType, 0, len(endpointTypes))
	for _, endpointType := range endpointTypes {
		if endpointType == constant.EndpointTypeOpenAIResponseCompact {
			if compactAllowed {
				projected = append(projected, endpointType)
			}
			continue
		}
		if baseAllowed {
			projected = append(projected, endpointType)
		}
	}
	return projected, true
}

type modelListGroups struct {
	userGroup   string
	tokenGroup  string
	ownerGroups []string
}

func getModelListGroups(c *gin.Context) (modelListGroups, error) {
	tokenGroup := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	if userGroup == "" && (tokenGroup == "" || tokenGroup == "auto") {
		var err error
		userGroup, err = model.GetUserGroup(c.GetInt("id"), false)
		if err != nil {
			return modelListGroups{}, err
		}
	}

	if tokenGroup == "auto" {
		return modelListGroups{
			userGroup:   userGroup,
			tokenGroup:  tokenGroup,
			ownerGroups: service.GetRequestAutoGroups(c, userGroup),
		}, nil
	}

	group := userGroup
	if tokenGroup != "" {
		group = tokenGroup
	}
	return modelListGroups{
		userGroup:   userGroup,
		tokenGroup:  tokenGroup,
		ownerGroups: []string{group},
	}, nil
}

func ListModels(c *gin.Context, modelType int) {
	acceptUnsetRatioModel := operation_setting.SelfUseModeEnabled
	if !acceptUnsetRatioModel {
		userId := c.GetInt("id")
		if userId > 0 {
			userSettings, _ := model.GetUserSetting(userId, false)
			if userSettings.AcceptUnsetRatioModel {
				acceptUnsetRatioModel = true
			}
		}
	}

	userModelNames := make([]string, 0)
	groups, err := getModelListGroups(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "get user group failed",
		})
		return
	}
	ownerGroups := groups.ownerGroups
	modelLimitEnable := common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled)
	var tokenModelLimit map[string]bool
	if modelLimitEnable {
		s, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
		if ok {
			tokenModelLimit, _ = s.(map[string]bool)
		}
		if tokenModelLimit == nil {
			tokenModelLimit = map[string]bool{}
		}
	}
	models := service.GetGroupsEnabledModels(ownerGroups)
	endpointTypesByModel := make(map[string][]constant.EndpointType, len(models))
	for _, modelName := range models {
		endpointTypes := model.GetModelSupportEndpointTypes(modelName)
		visible := !modelLimitEnable || tokenAllowsModel(tokenModelLimit, modelName)
		if modelType == constant.ChannelTypeOpenAI {
			endpointTypes, visible = projectModelEndpointTypesForToken(modelName, tokenModelLimit, modelLimitEnable)
		}
		if !visible {
			continue
		}
		if !acceptUnsetRatioModel && !helper.HasModelBillingConfig(modelName) {
			continue
		}
		userModelNames = append(userModelNames, modelName)
		endpointTypesByModel[modelName] = endpointTypes
	}

	ownerByModel := map[string]string{}
	if len(ownerGroups) > 0 {
		ownerByModel = getPreferredModelOwners(userModelNames, ownerGroups)
	}
	userOpenAiModels := make([]dto.OpenAIModels, 0, len(userModelNames))
	for _, modelName := range userModelNames {
		userOpenAiModels = append(userOpenAiModels, buildOpenAIModelWithEndpointTypes(modelName, ownerByModel, endpointTypesByModel[modelName]))
	}

	switch modelType {
	case constant.ChannelTypeAnthropic:
		useranthropicModels := make([]dto.AnthropicModel, len(userOpenAiModels))
		for i, model := range userOpenAiModels {
			useranthropicModels[i] = dto.AnthropicModel{
				ID:          model.Id,
				CreatedAt:   time.Unix(int64(model.Created), 0).UTC().Format(time.RFC3339),
				DisplayName: model.Id,
				Type:        "model",
			}
		}
		firstID := ""
		lastID := ""
		if len(useranthropicModels) > 0 {
			firstID = useranthropicModels[0].ID
			lastID = useranthropicModels[len(useranthropicModels)-1].ID
		}
		c.JSON(200, gin.H{
			"data":     useranthropicModels,
			"first_id": firstID,
			"has_more": false,
			"last_id":  lastID,
		})
	case constant.ChannelTypeGemini:
		userGeminiModels := make([]dto.GeminiModel, len(userOpenAiModels))
		for i, model := range userOpenAiModels {
			userGeminiModels[i] = dto.GeminiModel{
				Name:        model.Id,
				DisplayName: model.Id,
			}
		}
		c.JSON(200, gin.H{
			"models":        userGeminiModels,
			"nextPageToken": nil,
		})
	default:
		c.JSON(200, gin.H{
			"success": true,
			"data":    userOpenAiModels,
			"object":  "list",
		})
	}
}

func ChannelListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    openAIModels,
	})
}

func DashboardListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    channelId2Models,
	})
}

func EnabledListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    model.GetEnabledModels(),
	})
}

func RetrieveModel(c *gin.Context, modelType int) {
	modelId := c.Param("model")
	if aiModel, ok := openAIModelsMap[modelId]; ok {
		switch modelType {
		case constant.ChannelTypeAnthropic:
			c.JSON(200, dto.AnthropicModel{
				ID:          aiModel.Id,
				CreatedAt:   time.Unix(int64(aiModel.Created), 0).UTC().Format(time.RFC3339),
				DisplayName: aiModel.Id,
				Type:        "model",
			})
		default:
			c.JSON(200, aiModel)
		}
	} else {
		openAIError := types.OpenAIError{
			Message: fmt.Sprintf("The model '%s' does not exist", modelId),
			Type:    "invalid_request_error",
			Param:   "model",
			Code:    "model_not_found",
		}
		c.JSON(200, gin.H{
			"error": openAIError,
		})
	}
}
