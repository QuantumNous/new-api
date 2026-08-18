package ratio_setting

import "strings"

const CompactModelSuffix = "-openai-compact"
const CompactWildcardModelKey = "gpt-*" + CompactModelSuffix

func CompactBaseModelName(modelName string) string {
	return strings.TrimSuffix(modelName, CompactModelSuffix)
}

func IsGPTCompactBaseModel(modelName string) bool {
	baseModel := CompactBaseModelName(modelName)
	return strings.HasPrefix(baseModel, "gpt-") && len(baseModel) > len("gpt-")
}

func IsVirtualCompactModelName(modelName string) bool {
	return strings.HasSuffix(modelName, CompactModelSuffix) && IsGPTCompactBaseModel(modelName)
}

func WithCompactModelSuffix(modelName string) string {
	baseModel := CompactBaseModelName(modelName)
	if !IsGPTCompactBaseModel(baseModel) {
		return baseModel
	}
	return baseModel + CompactModelSuffix
}
