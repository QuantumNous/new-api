package oaiimage

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	geminichat "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/gemini_chat"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

const fallbackTokensPerImage = 258

func GeminiChatResponseToOpenAIImage(response *dto.GeminiChatResponse) (*dto.ImageResponse, *dto.Usage, error) {
	if response == nil {
		return nil, nil, fmt.Errorf("response is nil")
	}

	out := &dto.ImageResponse{
		Created: kitutil.GetTimestamp(),
		Data:    make([]dto.ImageData, 0),
	}
	for _, candidate := range response.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData == nil || part.InlineData.Data == "" {
				continue
			}
			if part.InlineData.MimeType != "" && !strings.HasPrefix(part.InlineData.MimeType, "image") {
				continue
			}
			out.Data = append(out.Data, dto.ImageData{
				B64Json: part.InlineData.Data,
			})
		}
	}
	if len(out.Data) == 0 {
		return nil, nil, fmt.Errorf("no images generated")
	}

	usage := geminichat.UsageFromGeminiMetadata(response.GetUsageMetadata(), 0)
	if usage == nil {
		usage = &dto.Usage{}
	}
	if usage.TotalTokens == 0 {
		tokens := fallbackTokensPerImage * len(out.Data)
		if usage.PromptTokens == 0 {
			usage.PromptTokens = tokens
		}
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		if usage.TotalTokens == 0 {
			usage.TotalTokens = tokens
		}
	}
	return out, usage, nil
}
