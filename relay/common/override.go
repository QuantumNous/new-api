package common

import (
	"encoding/json"
	"fmt"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const InternalPromptTokensKey = "NewAPIInternal"

type NewAPIInternal struct {
	PromptTokens int `json:"PromptTokens"`
}

type ParamOperation struct {
	Path       string               `json:"path"`
	Mode       string               `json:"mode"` // delete, set, move, prepend, append, block, pass
	Value      interface{}          `json:"value"`
	KeepOrigin bool                 `json:"keep_origin"`
	From       string               `json:"from,omitempty"`
	To         string               `json:"to,omitempty"`
	Conditions []ConditionOperation `json:"conditions,omitempty"` // 条件列表
	Logic      string               `json:"logic,omitempty"`      // AND, OR (默认OR)
}

func ApplyParamOverride(jsonData []byte, Relayinfo *RelayInfo) ([]byte, bool, error) {
	if len(Relayinfo.ParamOverride) == 0 {
		return jsonData, false, nil
	}

	// 尝试断言为操作格式
	if operations, ok := tryParseOperations(Relayinfo.ParamOverride); ok {
		info := &NewAPIInternal{PromptTokens: Relayinfo.PromptTokens}
		// 使用新方法
		result, isBlock, err := applyOperations(string(jsonData), operations, info)
		return []byte(result), isBlock, err
	}

	// 直接使用旧方法
	result, err := applyOperationsLegacy(jsonData, Relayinfo.ParamOverride)
	return result, false, err
}

func tryParseOperations(paramOverride map[string]interface{}) ([]ParamOperation, bool) {
	// 检查是否包含 "operations" 字段
	if opsValue, exists := paramOverride["operations"]; exists {
		if opsSlice, ok := opsValue.([]interface{}); ok {
			var operations []ParamOperation
			for _, op := range opsSlice {
				if opMap, ok := op.(map[string]interface{}); ok {
					operation := ParamOperation{}

					// 断言必要字段
					if path, ok := opMap["path"].(string); ok {
						operation.Path = path
					}
					if mode, ok := opMap["mode"].(string); ok {
						operation.Mode = mode
					} else {
						return nil, false // mode 是必需的
					}

					// 可选字段
					if value, exists := opMap["value"]; exists {
						operation.Value = value
					}
					if keepOrigin, ok := opMap["keep_origin"].(bool); ok {
						operation.KeepOrigin = keepOrigin
					}
					if from, ok := opMap["from"].(string); ok {
						operation.From = from
					}
					if to, ok := opMap["to"].(string); ok {
						operation.To = to
					}
					if logic, ok := opMap["logic"].(string); ok {
						operation.Logic = logic
					} else {
						operation.Logic = "OR" // 默认为OR
					}

					// 解析条件
					if conditions, exists := opMap["conditions"]; exists {
						if condSlice, ok := conditions.([]interface{}); ok {
							for _, cond := range condSlice {
								if condMap, ok := cond.(map[string]interface{}); ok {
									condition := ConditionOperation{}
									if path, ok := condMap["path"].(string); ok {
										condition.Path = path
									}
									if mode, ok := condMap["mode"].(string); ok {
										condition.Mode = mode
									}
									if value, ok := condMap["value"]; ok {
										condition.Value = value
									}
									if invert, ok := condMap["invert"].(bool); ok {
										condition.Invert = invert
									}
									if passMissingKey, ok := condMap["pass_missing_key"].(bool); ok {
										condition.PassMissingKey = passMissingKey
									}
									operation.Conditions = append(operation.Conditions, condition)
								}
							}
						}
					}

					operations = append(operations, operation)
				} else {
					return nil, false
				}
			}
			return operations, true
		}
	}

	return nil, false
}

// applyOperationsLegacy 原参数覆盖方法
func applyOperationsLegacy(jsonData []byte, paramOverride map[string]interface{}) ([]byte, error) {
	reqMap := make(map[string]interface{})
	err := json.Unmarshal(jsonData, &reqMap)
	if err != nil {
		return nil, err
	}

	for key, value := range paramOverride {
		reqMap[key] = value
	}

	return json.Marshal(reqMap)
}

func applyOperations(jsonStr string, operations []ParamOperation, info *NewAPIInternal) (string, bool, error) {
	jsonStrWithTokens, err := sjson.Set(jsonStr, InternalPromptTokensKey, info)
	if err != nil {
		return "", false, fmt.Errorf("failed to add %s: %v", InternalPromptTokensKey, err)
	}
	result := jsonStrWithTokens
	for _, op := range operations {
		// 检查条件是否满足
		ok, err := CheckConditions(result, op.Conditions, op.Logic)
		if err != nil {
			return "", false, err
		}
		if !ok {
			continue // 条件不满足，跳过当前操作
		}
		// 处理block和pass操作
		if op.Mode == "block" {
			blockMessage := "request blocked by param override conditions"
			return result, true, fmt.Errorf(blockMessage)
		}
		if op.Mode == "pass" {
			// 移除添加的内部字段
			result, _ = sjson.Delete(result, InternalPromptTokensKey)
			return result, false, nil // 直接通过
		}
		// 处理路径中的负数索引
		opPath := processNegativeIndex(result, op.Path)
		opFrom := processNegativeIndex(result, op.From)
		opTo := processNegativeIndex(result, op.To)
		switch op.Mode {
		case "delete":
			result, err = sjson.Delete(result, opPath)
		case "set":
			if op.KeepOrigin && gjson.Get(result, opPath).Exists() {
				continue
			}
			result, err = sjson.Set(result, opPath, op.Value)
		case "move":
			result, err = moveValue(result, opFrom, opTo)
		case "prepend":
			result, err = modifyValue(result, opPath, op.Value, op.KeepOrigin, true)
		case "append":
			result, err = modifyValue(result, opPath, op.Value, op.KeepOrigin, false)
		default:
			return "", false, fmt.Errorf("unknown operation: %s", op.Mode)
		}
		if err != nil {
			return "", false, fmt.Errorf("operation %s failed: %v", op.Mode, err)
		}
	}
	// 移除添加的内部字段
	result, _ = sjson.Delete(result, InternalPromptTokensKey)
	return result, false, nil
}

func moveValue(jsonStr, fromPath, toPath string) (string, error) {
	sourceValue := gjson.Get(jsonStr, fromPath)
	if !sourceValue.Exists() {
		return jsonStr, fmt.Errorf("source path does not exist: %s", fromPath)
	}
	result, err := sjson.Set(jsonStr, toPath, sourceValue.Value())
	if err != nil {
		return "", err
	}
	return sjson.Delete(result, fromPath)
}

func modifyValue(jsonStr, path string, value interface{}, keepOrigin, isPrepend bool) (string, error) {
	current := gjson.Get(jsonStr, path)
	switch {
	case current.IsArray():
		return modifyArray(jsonStr, path, value, isPrepend)
	case current.Type == gjson.String:
		return modifyString(jsonStr, path, value, isPrepend)
	case current.Type == gjson.JSON:
		return mergeObjects(jsonStr, path, value, keepOrigin)
	}
	return jsonStr, fmt.Errorf("operation not supported for type: %v", current.Type)
}

func modifyArray(jsonStr, path string, value interface{}, isPrepend bool) (string, error) {
	current := gjson.Get(jsonStr, path)
	var newArray []interface{}
	// 添加新值
	addValue := func() {
		if arr, ok := value.([]interface{}); ok {
			newArray = append(newArray, arr...)
		} else {
			newArray = append(newArray, value)
		}
	}
	// 添加原值
	addOriginal := func() {
		current.ForEach(func(_, val gjson.Result) bool {
			newArray = append(newArray, val.Value())
			return true
		})
	}
	if isPrepend {
		addValue()
		addOriginal()
	} else {
		addOriginal()
		addValue()
	}
	return sjson.Set(jsonStr, path, newArray)
}

func modifyString(jsonStr, path string, value interface{}, isPrepend bool) (string, error) {
	current := gjson.Get(jsonStr, path)
	valueStr := fmt.Sprintf("%v", value)
	var newStr string
	if isPrepend {
		newStr = valueStr + current.String()
	} else {
		newStr = current.String() + valueStr
	}
	return sjson.Set(jsonStr, path, newStr)
}

func mergeObjects(jsonStr, path string, value interface{}, keepOrigin bool) (string, error) {
	current := gjson.Get(jsonStr, path)
	var currentMap, newMap map[string]interface{}

	// 解析当前值
	if err := json.Unmarshal([]byte(current.Raw), &currentMap); err != nil {
		return "", err
	}
	// 解析新值
	switch v := value.(type) {
	case map[string]interface{}:
		newMap = v
	default:
		jsonBytes, _ := json.Marshal(v)
		if err := json.Unmarshal(jsonBytes, &newMap); err != nil {
			return "", err
		}
	}
	// 合并
	result := make(map[string]interface{})
	for k, v := range currentMap {
		result[k] = v
	}
	for k, v := range newMap {
		if !keepOrigin || result[k] == nil {
			result[k] = v
		}
	}
	return sjson.Set(jsonStr, path, result)
}
