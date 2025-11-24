package openai

// ReasoningHolder 定义一个通用的接口，用于操作包含reasoning字段的结构体
type ReasoningHolder interface {
	// 获取reasoning字段的值
	GetReasoning() string
	// 设置reasoning字段的值
	SetReasoning(reasoning string)
	// 获取reasoning_content字段的值
	GetReasoningContent() string
	// 设置reasoning_content字段的值
	SetReasoningContent(reasoningContent string)
}

// ConvertReasoningField 通用的reasoning字段转换函数
// 将reasoning字段的内容移动到reasoning_content字段
// ConvertReasoningField moves the holder's reasoning into its reasoning content and clears the original reasoning field.
// If GetReasoning returns an empty string, the holder is unchanged. When clearing, types that implement SetReasoningToNil()
// will have that method invoked; otherwise SetReasoning("") is used.
func ConvertReasoningField[T ReasoningHolder](holder T) {
	reasoning := holder.GetReasoning()
	if reasoning != "" {
		holder.SetReasoningContent(reasoning)
	}
	
	// 使用类型断言来智能清理reasoning字段
	switch h := any(holder).(type) {
	case interface{ SetReasoningToNil() }:
		// 流式响应：指针类型，设为nil
		h.SetReasoningToNil()
	default:
		// 非流式响应：值类型，设为空字符串
		holder.SetReasoning("")
	}
}
