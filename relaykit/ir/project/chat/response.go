package chat

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func FromResponse(resp *dto.OpenAITextResponse) (*ir.Response, error) {
	if resp == nil {
		return nil, fmt.Errorf("chat response is nil")
	}
	out := &ir.Response{
		ID:    resp.Id,
		Model: resp.Model,
	}
	if len(resp.Choices) > 0 {
		choice := resp.Choices[0]
		out.ProviderFinish = choice.FinishReason
		out.Finish = ir.FinishFromChat(choice.FinishReason)
		blocks, err := blocksFromChatMessage(choice.Message)
		if err != nil {
			return nil, err
		}
		out.Blocks = blocks
	}
	out.Usage = ir.Usage{
		Input:      resp.PromptTokens,
		Output:     resp.CompletionTokens,
		Thought:    resp.CompletionTokenDetails.ReasoningTokens,
		CacheRead:  resp.PromptTokensDetails.CachedTokens,
		CacheWrite: resp.PromptTokensDetails.CacheCreationTokensTotal(),
	}
	ext := &ir.ChatExt{Object: resp.Object}
	created, err := jsonx.Marshal(resp.Created)
	if err != nil {
		return nil, err
	}
	ext.Created = created
	if ext.Object != "" || jsonx.Present(ext.Created) {
		out.Extensions.Chat = ext
	}
	return out, nil
}

func ToResponse(resp *ir.Response) (*dto.OpenAITextResponse, error) {
	if resp == nil {
		return nil, fmt.Errorf("ir response is nil")
	}
	msg, err := blocksToChatMessage(ir.Message{Role: ir.RoleAssistant, Blocks: resp.Blocks})
	if err != nil {
		return nil, err
	}
	finish := resp.ProviderFinish
	if finish == "" {
		finish = resp.Finish.ToChatFinishReason()
	}
	out := &dto.OpenAITextResponse{
		Id:    resp.ID,
		Model: resp.Model,
		Choices: []dto.OpenAITextResponseChoice{{
			Index:        0,
			Message:      msg,
			FinishReason: finish,
		}},
		Usage: dto.Usage{
			PromptTokens:     resp.Usage.Input,
			CompletionTokens: resp.Usage.Output,
			TotalTokens:      resp.Usage.Input + resp.Usage.Output,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         resp.Usage.CacheRead,
				CachedCreationTokens: resp.Usage.CacheWrite,
			},
			CompletionTokenDetails: dto.OutputTokenDetails{
				ReasoningTokens: resp.Usage.Thought,
			},
		},
	}
	if ext := resp.Extensions.Chat; ext != nil {
		out.Object = ext.Object
		if jsonx.Present(ext.Created) {
			_ = json.Unmarshal(ext.Created, &out.Created)
		}
		if err := jsonx.MergeInto(out, ext.Raw); err != nil {
			return nil, err
		}
	}
	return out, nil
}
