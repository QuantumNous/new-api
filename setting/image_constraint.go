package setting

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

// ImageConstraint 描述对单张图片做"缩放 + 降质量"压缩时的约束。
// MaxBytes 指编码后文件字节阈值（对应 AWS Bedrock 文档 "images must be under 3.75 MB"）。
type ImageConstraint struct {
	Enabled       bool
	MaxBytes      int64
	MaxDim        int
	QualitySteps  []int
	PreserveAlpha bool
}

// ImageCompressionOverride 允许渠道 otherSettings 对默认值做部分覆盖。
// 所有字段为指针，以区分"未设置"与"显式写入零值"。
type ImageCompressionOverride struct {
	Enabled       *bool  `json:"enabled,omitempty"`
	MaxBytes      *int64 `json:"max_bytes,omitempty"`
	MaxDim        *int   `json:"max_dim,omitempty"`
	QualitySteps  []int  `json:"quality_steps,omitempty"`
	PreserveAlpha *bool  `json:"preserve_alpha,omitempty"`
}

// DefaultConstraintFor 返回某渠道类型的内置默认约束。
// AWS 渠道首发启用；其他渠道默认关闭，等待逐个开启。
func DefaultConstraintFor(channelType int) ImageConstraint {
	switch channelType {
	case constant.ChannelTypeAws:
		return ImageConstraint{
			Enabled:       true,
			MaxBytes:      3_750_000,
			MaxDim:        1568,
			QualitySteps:  []int{85, 70, 55, 40},
			PreserveAlpha: false,
		}
	default:
		return ImageConstraint{Enabled: false}
	}
}

// MergeOverride 在 base 上应用 override，返回新实例。override 为 nil 时直接返回 base。
func (base ImageConstraint) MergeOverride(override *ImageCompressionOverride) ImageConstraint {
	if override == nil {
		return base
	}
	out := base
	if override.Enabled != nil {
		out.Enabled = *override.Enabled
	}
	if override.MaxBytes != nil {
		out.MaxBytes = *override.MaxBytes
	}
	if override.MaxDim != nil {
		out.MaxDim = *override.MaxDim
	}
	if override.QualitySteps != nil {
		out.QualitySteps = override.QualitySteps
	}
	if override.PreserveAlpha != nil {
		out.PreserveAlpha = *override.PreserveAlpha
	}
	return out
}

// Fingerprint 用于副本缓存 key；同约束得到同指纹，不同约束得到不同指纹。
func (c ImageConstraint) Fingerprint() string {
	qs := make([]string, len(c.QualitySteps))
	for i, q := range c.QualitySteps {
		qs[i] = strconv.Itoa(q)
	}
	return fmt.Sprintf("e=%t|b=%d|d=%d|q=%s|pa=%t",
		c.Enabled, c.MaxBytes, c.MaxDim, strings.Join(qs, ","), c.PreserveAlpha)
}
