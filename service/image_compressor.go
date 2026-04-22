package service

import (
	"github.com/QuantumNous/new-api/setting"
)

// CompressResult 是 Apply 的返回值。Bytes 为最终编码字节（可能就是输入原字节）；
// Info 描述发生了什么。
type CompressResult struct {
	Bytes []byte
	Mime  string
	Info  CompressionInfo
}

// CompressionInfo 记录压缩路径上的决策与数值，便于日志与测试断言。
type CompressionInfo struct {
	Skipped       bool
	Resized       bool
	OriginalSize  int64
	FinalSize     int64
	QualityUsed   int
	FormatChanged bool
}

// Apply 对单张静态图片执行"缩放 + 降质量"级联压缩。
// 约束未启用或图像已在阈值内时，直接返回原字节 (Skipped=true)。
func Apply(raw []byte, mime string, c setting.ImageConstraint) (*CompressResult, error) {
	if !c.Enabled {
		return &CompressResult{
			Bytes: raw,
			Mime:  mime,
			Info: CompressionInfo{
				Skipped:      true,
				OriginalSize: int64(len(raw)),
				FinalSize:    int64(len(raw)),
			},
		}, nil
	}
	// 后续 Task 扩展
	return &CompressResult{
		Bytes: raw,
		Mime:  mime,
		Info: CompressionInfo{
			Skipped:      true,
			OriginalSize: int64(len(raw)),
			FinalSize:    int64(len(raw)),
		},
	}, nil
}
