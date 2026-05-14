package agent

import (
	"context"
)

func toolGetTopupLink() *ToolDefinition {
	return &ToolDefinition{
		Name:        "get_topup_link",
		DisplayName: "Get top-up link",
		Description: "Return a safe link to the top-up page without creating an order.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"amount_cny": map[string]interface{}{"type": "number"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			amount := toFloat(args["amount_cny"], 0)
			url := "/console/topup"
			if amount > 0 {
				url = url + "?amount=" + formatAmount(amount)
			}
			data := map[string]interface{}{"url": url}
			return ToolResult{OK: true, Data: data, Display: data, UserMessage: "Open the top-up page and finish payment there."}, nil
		},
	}
}

func toolGetDocLink() *ToolDefinition {
	return &ToolDefinition{
		Name:        "get_doc_link",
		DisplayName: "Get document link",
		Description: "Return a relevant documentation link.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"topic": map[string]interface{}{"type": "string"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			topic := safeString(args["topic"])
			url := DocLink(topic)
			data := map[string]interface{}{"topic": topic, "url": url}
			return ToolResult{OK: true, Data: data, Display: data, UserMessage: "Here is the most relevant help link."}, nil
		},
	}
}

func toolClarify() *ToolDefinition {
	return &ToolDefinition{
		Name:        "clarify",
		DisplayName: "Clarify request",
		Description: "Ask a clarification question when the request is ambiguous.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"question": map[string]interface{}{"type": "string"}}, "required": []string{"question"}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			question := safeString(args["question"])
			if question == "" {
				question = "Could you share more detail?"
			}
			return ToolResult{OK: true, Data: map[string]interface{}{"question": question}, Display: question, UserMessage: question}, nil
		},
	}
}
