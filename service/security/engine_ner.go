package security

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// NERDetector 命名实体识别检测引擎（占位符，待后续接入 NER 库）
type NERDetector struct {
}

func (nd *NERDetector) Name() string {
	return "ner"
}

// Detect 使用 NER 检测实体
func (nd *NERDetector) Detect(content string, rules []*model.SecurityRule) (*EngineResult, error) {
	result := &EngineResult{
		EngineName: nd.Name(),
		Detected:   false,
		Matches:    make([]*dto.SecurityMatchResult, 0),
		RiskScore:  0,
	}

	// TODO: 接入实际的 NER 库（如 github.com/jdkato/prose 或其他中文 NER 库）
	// 目前作为占位符，返回未检测到

	// 过滤 NER 类型规则
	for _, rule := range rules {
		if rule.Type == constant.SecurityRuleTypeNER && rule.Status == constant.SecurityStatusEnabled {
			// 占位逻辑：直接匹配 content 中是否包含 rule.Content 指定的实体类型关键词
			// 实际实现应调用 NER 库提取实体后匹配
		}
	}

	return result, nil
}
