package helper

import (
	"encoding/json"
	"errors"
	"fmt"

	rootcommon "github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hostreasoning "github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func ModelMappedHelper(c *gin.Context, info *relaycommon.RelayInfo, request dto.Request) error {
	if info.ChannelMeta == nil {
		info.ChannelMeta = &relaycommon.ChannelMeta{}
	}

	var modelMap map[string]string
	// map model name
	modelMapping := c.GetString("model_mapping")
	if modelMapping != "" && modelMapping != "{}" {
		modelMap = make(map[string]string)
		err := rootcommon.Unmarshal([]byte(modelMapping), &modelMap)
		if err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}

		mappedModel, isMapped, err := resolveMappedModel(info.OriginModelName, modelMap)
		if err != nil {
			return err
		}
		info.IsModelMapped = isMapped
		if isMapped {
			info.UpstreamModelName = mappedModel
		}
	}

	if request != nil {
		request.SetModelName(info.UpstreamModelName)
		if len(modelMap) > 0 {
			if err := mapRequestToolModels(request, modelMap); err != nil {
				return err
			}
		}
	}
	return nil
}

// resolveMappedModel applies chained model_mapping resolution with cycle
// detection and reasoning-suffix base-model fallback.
func resolveMappedModel(originModel string, modelMap map[string]string) (string, bool, error) {
	if originModel == "" || len(modelMap) == 0 {
		return originModel, false, nil
	}

	// 支持链式模型重定向，最终使用链尾的模型
	currentModel := originModel
	visitedModels := map[string]bool{
		currentModel: true,
	}
	isMapped := false
	for {
		mappedModel, exists := modelMap[currentModel]
		baseModel := hostreasoning.BaseModelName(currentModel)
		if (!exists || mappedModel == "") && baseModel != currentModel {
			mappedModel, exists = modelMap[baseModel]
		}
		if exists && mappedModel != "" {
			// 模型重定向循环检测，避免无限循环
			if visitedModels[mappedModel] {
				if mappedModel == currentModel {
					if currentModel == originModel {
						return originModel, false, nil
					}
					return currentModel, true, nil
				}
				return "", false, errors.New("model_mapping_contains_cycle")
			}
			visitedModels[mappedModel] = true
			currentModel = mappedModel
			isMapped = true
		} else {
			break
		}
	}
	return currentModel, isMapped, nil
}

// mapRequestToolModels rewrites nested tools[].model aliases (e.g. Anthropic's
// advisor tool or OpenAI Responses built-in tools) using the channel's
// model_mapping while preserving raw JSON property order.
func mapRequestToolModels(request dto.Request, modelMap map[string]string) error {
	switch req := request.(type) {
	case *dto.ClaudeRequest:
		if req.Tools == nil {
			return nil
		}
		switch tools := req.Tools.(type) {
		case json.RawMessage:
			updated, changed, err := mapToolModelsInRawArray(tools, modelMap)
			if err != nil {
				return err
			}
			if changed {
				req.Tools = updated
			}
		case []any:
			for i, item := range tools {
				switch tool := item.(type) {
				case map[string]any:
					modelName, ok := tool["model"].(string)
					if !ok || modelName == "" {
						continue
					}
					mapped, isMapped, err := resolveMappedModel(modelName, modelMap)
					if err != nil {
						return err
					}
					if isMapped && mapped != modelName {
						tool["model"] = mapped
					}
				case json.RawMessage:
					updated, changed, err := mapToolModelInRawObject(tool, modelMap)
					if err != nil {
						return err
					}
					if changed {
						tools[i] = updated
					}
				}
			}
		}
	case *dto.OpenAIResponsesRequest:
		if len(req.Tools) == 0 {
			return nil
		}
		updated, changed, err := mapToolModelsInRawArray(req.Tools, modelMap)
		if err != nil {
			return err
		}
		if changed {
			req.Tools = updated
		}
	case *dto.GeneralOpenAIRequest:
		for i := range req.Tools {
			if len(req.Tools[i].Native) == 0 {
				continue
			}
			updated, changed, err := mapToolModelInRawObject(req.Tools[i].Native, modelMap)
			if err != nil {
				return err
			}
			if changed {
				req.Tools[i].Native = updated
			}
		}
	}
	return nil
}

func mapToolModelsInRawArray(raw json.RawMessage, modelMap map[string]string) (json.RawMessage, bool, error) {
	if len(raw) == 0 || len(modelMap) == 0 {
		return raw, false, nil
	}
	root := gjson.ParseBytes(raw)
	if !root.IsArray() {
		return raw, false, nil
	}

	var updated []byte
	for i, elem := range root.Array() {
		if !elem.IsObject() {
			continue
		}
		modelVal := elem.Get("model")
		if modelVal.Type != gjson.String {
			continue
		}
		originToolModel := modelVal.String()
		if originToolModel == "" {
			continue
		}
		mapped, isMapped, err := resolveMappedModel(originToolModel, modelMap)
		if err != nil {
			return nil, false, err
		}
		if !isMapped || mapped == originToolModel {
			continue
		}
		if updated == nil {
			updated = append([]byte(nil), raw...)
		}
		updated, err = sjson.SetBytes(updated, fmt.Sprintf("%d.model", i), mapped)
		if err != nil {
			return nil, false, err
		}
	}
	if updated == nil {
		return raw, false, nil
	}
	return json.RawMessage(updated), true, nil
}

func mapToolModelInRawObject(raw json.RawMessage, modelMap map[string]string) (json.RawMessage, bool, error) {
	if len(raw) == 0 || len(modelMap) == 0 {
		return raw, false, nil
	}
	root := gjson.ParseBytes(raw)
	if !root.IsObject() {
		return raw, false, nil
	}
	modelVal := root.Get("model")
	if modelVal.Type != gjson.String {
		return raw, false, nil
	}
	originToolModel := modelVal.String()
	if originToolModel == "" {
		return raw, false, nil
	}
	mapped, isMapped, err := resolveMappedModel(originToolModel, modelMap)
	if err != nil {
		return nil, false, err
	}
	if !isMapped || mapped == originToolModel {
		return raw, false, nil
	}
	updated, err := sjson.SetBytes(append([]byte(nil), raw...), "model", mapped)
	if err != nil {
		return nil, false, err
	}
	return json.RawMessage(updated), true, nil
}
