package model

import "strings"

// GetMissingModels returns model names that are referenced in the system
// but do not have corresponding records in the models meta table.
func GetMissingModels() ([]string, error) {
	// 获取所有已启用模型（去重）
	models := GetEnabledModels()
	if len(models) == 0 {
		return []string{}, nil
	}

	// 查询所有已有的元数据模型，按匹配优先级分组
	var existingModels []Model
	if err := DB.Model(&Model{}).Select("model_name, name_rule").Find(&existingModels).Error; err != nil {
		return nil, err
	}

	// 按匹配规则分组，提高查找效率
	exactModels := make(map[string]bool)
	var prefixModels, containsModels, suffixModels []string

	for _, existing := range existingModels {
		switch existing.NameRule {
		case NameRuleExact:
			exactModels[existing.ModelName] = true
		case NameRulePrefix:
			prefixModels = append(prefixModels, existing.ModelName)
		case NameRuleContains:
			containsModels = append(containsModels, existing.ModelName)
		case NameRuleSuffix:
			suffixModels = append(suffixModels, existing.ModelName)
		}
	}

	// 检查每个启用的模型是否有匹配的配置
	missing := make([]string, 0, len(models))
	for _, modelName := range models {
		if !isModelConfigured(modelName, exactModels, prefixModels, containsModels, suffixModels) {
			missing = append(missing, modelName)
		}
	}

	return missing, nil
}

// isModelConfigured 检查模型是否已配置，按优先级顺序检查：精确 > 前缀 > 后缀 > 包含
func isModelConfigured(modelName string, exactModels map[string]bool, prefixModels, containsModels, suffixModels []string) bool {
	// 1. 精确匹配（最高优先级）
	if exactModels[modelName] {
		return true
	}

	// 2. 前缀匹配
	for _, prefix := range prefixModels {
		if strings.HasPrefix(modelName, prefix) {
			return true
		}
	}

	// 3. 后缀匹配
	for _, suffix := range suffixModels {
		if strings.HasSuffix(modelName, suffix) {
			return true
		}
	}

	// 4. 包含匹配（最低优先级）
	for _, contains := range containsModels {
		if strings.Contains(modelName, contains) {
			return true
		}
	}

	return false
}
