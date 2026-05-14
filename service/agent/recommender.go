package agent

func RecommendModels(taskType string) []map[string]interface{} {
	switch taskType {
	case "code":
		return []map[string]interface{}{{"model": "claude-sonnet-4-5", "reason": "strong code reasoning", "latency_tier": "medium"}, {"model": "gpt-5.4", "reason": "balanced coding and general reasoning", "latency_tier": "medium"}}
	case "long_context":
		return []map[string]interface{}{{"model": "gemini-2.5-pro", "reason": "long context friendly", "latency_tier": "medium"}}
	case "image":
		return []map[string]interface{}{{"model": "gpt-image-2", "reason": "image generation workflow", "latency_tier": "slow"}}
	default:
		return []map[string]interface{}{{"model": "gpt-4o-mini", "reason": "low cost and stable tool use", "latency_tier": "fast"}, {"model": "deepseek-v4-flash", "reason": "cost-first general chat", "latency_tier": "fast"}}
	}
}
