package responses

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func FromResponse(resp *dto.OpenAIResponsesResponse) (*ir.Response, error) {
	if resp == nil {
		return nil, fmt.Errorf("responses response is nil")
	}
	out := &ir.Response{
		ID:    resp.ID,
		Model: resp.Model,
	}
	for _, item := range resp.Output {
		blocks, err := blocksFromResponsesOutput(item)
		if err != nil {
			return nil, err
		}
		out.Blocks = append(out.Blocks, blocks...)
	}
	if resp.Usage != nil {
		out.Usage = ir.Usage{
			Input:   resp.Usage.InputTokens,
			Output:  resp.Usage.OutputTokens,
			Thought: resp.Usage.CompletionTokenDetails.ReasoningTokens,
		}
		if out.Usage.Input == 0 {
			out.Usage.Input = resp.Usage.PromptTokens
		}
		if out.Usage.Output == 0 {
			out.Usage.Output = resp.Usage.CompletionTokens
		}
	}
	ext := &ir.ResponsesExt{
		Object: resp.Object,
		Status: jsonx.Clone(resp.Status),
	}
	if ext.Object != "" || jsonx.Present(ext.Status) {
		out.Extensions.Responses = ext
	}
	return out, nil
}

func ToResponse(resp *ir.Response) (*dto.OpenAIResponsesResponse, error) {
	if resp == nil {
		return nil, fmt.Errorf("ir response is nil")
	}
	output := make([]dto.ResponsesOutput, 0, len(resp.Blocks))
	for _, block := range resp.Blocks {
		item, err := blockToResponsesOutput(block)
		if err != nil {
			return nil, err
		}
		output = append(output, item)
	}
	out := &dto.OpenAIResponsesResponse{
		ID:     resp.ID,
		Object: "response",
		Model:  resp.Model,
		Output: output,
		Usage: &dto.Usage{
			InputTokens:      resp.Usage.Input,
			OutputTokens:     resp.Usage.Output,
			TotalTokens:      resp.Usage.Input + resp.Usage.Output,
			PromptTokens:     resp.Usage.Input,
			CompletionTokens: resp.Usage.Output,
			CompletionTokenDetails: dto.OutputTokenDetails{
				ReasoningTokens: resp.Usage.Thought,
			},
		},
	}
	if ext := resp.Extensions.Responses; ext != nil {
		if ext.Object != "" {
			out.Object = ext.Object
		}
		out.Status = jsonx.Clone(ext.Status)
		if err := jsonx.MergeInto(out, ext.Raw); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func blocksFromResponsesOutput(item dto.ResponsesOutput) ([]ir.Block, error) {
	switch item.Type {
	case "message":
		var blocks []ir.Block
		for _, part := range item.Content {
			blocks = append(blocks, ir.Text(part.Text))
		}
		return blocks, nil
	case "function_call":
		return []ir.Block{ir.ToolUse(item.CallId, item.Name, item.Arguments)}, nil
	case "reasoning":
		var text string
		for _, part := range item.Summary {
			text += part.Text
		}
		if text == "" {
			for _, part := range item.Content {
				text += part.Text
			}
		}
		if text == "" {
			text = item.Result
		}
		return []ir.Block{ir.Think(text, "")}, nil
	default:
		raw, err := jsonx.Marshal(item)
		if err != nil {
			return nil, err
		}
		return []ir.Block{ir.Raw(item.Type, raw)}, nil
	}
}

func blockToResponsesOutput(block ir.Block) (dto.ResponsesOutput, error) {
	switch block.Kind {
	case ir.BlockKindText:
		text := ""
		if block.Text != nil {
			text = block.Text.Text
		}
		return dto.ResponsesOutput{
			Type:    "message",
			Role:    "assistant",
			Status:  "completed",
			Content: []dto.ResponsesOutputContent{{Type: "output_text", Text: text}},
		}, nil
	case ir.BlockKindThink:
		text := ""
		if block.Think != nil {
			text = block.Think.Text
		}
		return dto.ResponsesOutput{
			Type:   "reasoning",
			Status: "completed",
			Summary: []dto.ResponsesReasoningSummaryPart{{
				Type: "summary_text",
				Text: text,
			}},
		}, nil
	case ir.BlockKindToolUse:
		out := dto.ResponsesOutput{Type: "function_call", Status: "completed"}
		if block.ToolUse != nil {
			out.CallId = block.ToolUse.ID
			out.Name = block.ToolUse.Name
			out.Arguments = jsonx.Clone(block.ToolUse.Input)
		}
		return out, nil
	case ir.BlockKindRaw:
		var item dto.ResponsesOutput
		if block.Raw != nil && jsonx.Present(block.Raw.JSON) {
			if err := json.Unmarshal(block.Raw.JSON, &item); err != nil {
				return dto.ResponsesOutput{}, err
			}
		}
		return item, nil
	default:
		return dto.ResponsesOutput{Type: string(block.Kind)}, nil
	}
}
