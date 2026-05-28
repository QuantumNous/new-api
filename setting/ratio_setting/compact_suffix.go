package ratio_setting

import (
	"os"
	"strings"
)

const CompactModelSuffix = "-openai-compact"
const CompactWildcardModelKey = "*" + CompactModelSuffix

func CompactUseBaseModel() bool {
	return os.Getenv("COMPACT_USE_BASE_MODEL") == "true"
}

func WithCompactModelSuffix(modelName string) string {
	if strings.HasSuffix(modelName, CompactModelSuffix) {
		return modelName
	}
	return modelName + CompactModelSuffix
}
