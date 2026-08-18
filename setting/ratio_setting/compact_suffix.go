package ratio_setting

import "strings"

const CompactModelSuffix = "-openai-compact"
const CompactWildcardModelKey = "*" + CompactModelSuffix

const virtualCompactModelPrefix = "gpt-"

// CompactModelBaseName removes the virtual compact suffix without changing
// ordinary model names.
func CompactModelBaseName(modelName string) string {
	return strings.TrimSuffix(strings.TrimSpace(modelName), CompactModelSuffix)
}

// IsVirtualCompactModel reports whether modelName is the only compact variant
// that the platform synthesizes: gpt-<name>-openai-compact.
func IsVirtualCompactModel(modelName string) bool {
	modelName = strings.TrimSpace(modelName)
	baseName := CompactModelBaseName(modelName)
	return strings.HasSuffix(modelName, CompactModelSuffix) &&
		strings.HasPrefix(baseName, virtualCompactModelPrefix) &&
		len(baseName) > len(virtualCompactModelPrefix)
}

// VirtualCompactModelName canonicalizes a compact request. It returns the
// virtual suffix for GPT models and the base name for every other model.
func VirtualCompactModelName(modelName string) (string, bool) {
	baseName := CompactModelBaseName(modelName)
	if !strings.HasPrefix(baseName, virtualCompactModelPrefix) ||
		len(baseName) <= len(virtualCompactModelPrefix) {
		return baseName, false
	}
	return baseName + CompactModelSuffix, true
}

func WithCompactModelSuffix(modelName string) string {
	if strings.HasSuffix(modelName, CompactModelSuffix) {
		return modelName
	}
	return modelName + CompactModelSuffix
}
