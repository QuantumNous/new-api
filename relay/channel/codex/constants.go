package codex

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/samber/lo"
)

var baseModelList = []string{
	"gpt-5", "gpt-5-codex", "gpt-5-codex-mini",
	"gpt-5.1", "gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini",
	"gpt-5.2", "gpt-5.2-codex", "gpt-5.3-codex", "gpt-5.3-codex-spark",
	"gpt-5.4", "gpt-5.4-mini", "gpt-5.5",
	"gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
}

// 图像模型:codex 后端只有一套原生图像能力,model 名仅作标签;对外暴露 gpt-image-2。
var imageModelList = []string{"gpt-image-2"}

// ModelList = 文本模型(含 compact 变体) + 图像模型
var ModelList = append(withCompactModelSuffix(baseModelList), imageModelList...)

const ChannelName = "codex"

// defaultImageCarrierModel 是承载图像 Responses 请求的文本模型默认值。
// 解析优先级见 image.go resolveImageCarrierModel:per-channel > 全局 > 此默认。
const defaultImageCarrierModel = "gpt-5.4"

// IsCodexImageModel 判断给定(已映射)模型名是否走图像路径。
func IsCodexImageModel(model string) bool {
	return strings.HasPrefix(model, "gpt-image-")
}

func withCompactModelSuffix(models []string) []string {
	return lo.Filter(ratio_setting.WithCompactModelVariants(models), func(model string, _ int) bool {
		return model != ratio_setting.WithCompactModelSuffix("codex-auto-review")
	})
}
