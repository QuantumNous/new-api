package claude

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func FromResponse(resp *dto.ClaudeResponse) (*ir.Response, error) {
	if resp == nil {
		return nil, fmt.Errorf("claude response is nil")
	}
	blocks, err := blocksFromClaudeMediaList(resp.Content)
	if err != nil {
		return nil, err
	}
	out := &ir.Response{
		ID:             resp.Id,
		Model:          resp.Model,
		Blocks:         blocks,
		Finish:         ir.FinishFromClaude(resp.StopReason),
		ProviderFinish: resp.StopReason,
	}
	if resp.Usage != nil {
		out.Usage = ir.Usage{
			Input:      resp.Usage.InputTokens,
			Output:     resp.Usage.OutputTokens,
			CacheRead:  resp.Usage.CacheReadInputTokens,
			CacheWrite: resp.Usage.GetCacheCreationTotalTokens(),
		}
		raw, err := marshalRaw(resp.Usage)
		if err != nil {
			return nil, err
		}
		out.Extensions.Claude = &ir.ClaudeExt{
			Usage:        raw,
			ResponseType: resp.Type,
			ResponseRole: resp.Role,
		}
	} else if resp.Type != "" || resp.Role != "" {
		out.Extensions.Claude = &ir.ClaudeExt{
			ResponseType: resp.Type,
			ResponseRole: resp.Role,
		}
	}
	return out, nil
}

func ToResponse(resp *ir.Response) (*dto.ClaudeResponse, error) {
	if resp == nil {
		return nil, fmt.Errorf("ir response is nil")
	}
	content, err := blocksToClaudeMediaList(resp.Blocks)
	if err != nil {
		return nil, err
	}
	out := &dto.ClaudeResponse{
		Id:      resp.ID,
		Model:   resp.Model,
		Content: content,
		Type:    "message",
		Role:    "assistant",
	}
	if resp.ProviderFinish != "" {
		out.StopReason = resp.ProviderFinish
	} else {
		out.StopReason = resp.Finish.ToClaudeStopReason()
	}
	if ext := resp.Extensions.Claude; ext != nil {
		if ext.ResponseType != "" {
			out.Type = ext.ResponseType
		}
		if ext.ResponseRole != "" {
			out.Role = ext.ResponseRole
		}
		if rawPresent(ext.Usage) {
			var usage dto.ClaudeUsage
			if err := json.Unmarshal(ext.Usage, &usage); err != nil {
				return nil, err
			}
			out.Usage = &usage
		}
	}
	if out.Usage == nil && (resp.Usage.Input != 0 || resp.Usage.Output != 0 || resp.Usage.CacheRead != 0 || resp.Usage.CacheWrite != 0) {
		out.Usage = &dto.ClaudeUsage{
			InputTokens:              resp.Usage.Input,
			OutputTokens:             resp.Usage.Output,
			CacheReadInputTokens:     resp.Usage.CacheRead,
			CacheCreationInputTokens: resp.Usage.CacheWrite,
		}
	}
	return out, nil
}
