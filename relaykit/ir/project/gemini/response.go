package gemini

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func FromResponse(resp *dto.GeminiChatResponse) (*ir.Response, error) {
	if resp == nil {
		return nil, fmt.Errorf("gemini response is nil")
	}
	out := &ir.Response{}
	if len(resp.Candidates) > 0 {
		candidate := resp.Candidates[0]
		if candidate.FinishReason != nil {
			out.ProviderFinish = *candidate.FinishReason
			out.Finish = ir.FinishFromGemini(*candidate.FinishReason)
		}
		blocks, err := blocksFromGeminiParts(candidate.Content.Parts)
		if err != nil {
			return nil, err
		}
		out.Blocks = blocks
	}
	if meta := resp.GetUsageMetadata(); meta != nil {
		out.Usage = ir.Usage{
			Input:     meta.PromptTokenCount,
			Output:    meta.CandidatesTokenCount,
			Thought:   meta.ThoughtsTokenCount,
			CacheRead: meta.CachedContentTokenCount,
		}
	}
	return out, nil
}

func ToResponse(resp *ir.Response) (*dto.GeminiChatResponse, error) {
	if resp == nil {
		return nil, fmt.Errorf("ir response is nil")
	}
	parts, err := blocksToGeminiParts(resp.Blocks)
	if err != nil {
		return nil, err
	}
	finish := resp.ProviderFinish
	if finish == "" {
		finish = resp.Finish.ToGeminiFinishReason()
	}
	out := &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{{
			Content: dto.GeminiChatContent{Role: "model", Parts: parts},
		}},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:        resp.Usage.Input,
			CandidatesTokenCount:    resp.Usage.Output,
			ThoughtsTokenCount:      resp.Usage.Thought,
			CachedContentTokenCount: resp.Usage.CacheRead,
			TotalTokenCount:         resp.Usage.Input + resp.Usage.Output + resp.Usage.Thought,
		},
		HasUsageMetadata: true,
	}
	if finish != "" {
		out.Candidates[0].FinishReason = &finish
	}
	return out, nil
}
