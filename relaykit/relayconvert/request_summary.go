package relayconvert

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type RequestConversionSummary struct {
	From           types.RelayFormat
	To             types.RelayFormat
	Model          string
	SourceRoles    []string
	TargetRoles    []string
	Media          []MediaConversionSummary
	ToolCallIDs    []string
	ProjectionLoss ir.Report
}

type MediaConversionSummary struct {
	Kind       ir.MediaKind
	MIME       string
	Filename   string
	Source     ir.MediaSourceKind
	ByteLength int
	SHA256     string
}

// SummarizeRequestConversion returns a content-safe conversion summary for
// debug logs. It never includes text bodies, URLs, file IDs, or base64 payloads.
func SummarizeRequestConversion(from, to types.RelayFormat, source, target any, report ir.Report) (*RequestConversionSummary, error) {
	irRequest, err := project.FromRequest(to, target)
	if err != nil {
		return nil, err
	}
	summary := &RequestConversionSummary{
		From:           from,
		To:             to,
		Model:          irRequest.Model,
		SourceRoles:    requestWireRoles(from, source),
		TargetRoles:    requestWireRoles(to, target),
		ProjectionLoss: report,
	}
	for _, message := range irRequest.Messages {
		for _, block := range message.Blocks {
			appendBlockSummary(summary, block)
		}
	}
	return summary, nil
}

func appendBlockSummary(summary *RequestConversionSummary, block ir.Block) {
	if summary == nil {
		return
	}
	if block.Media != nil {
		media := MediaConversionSummary{
			Kind:     block.Media.Kind,
			MIME:     block.Media.MIME,
			Filename: block.Media.Filename,
			Source:   block.Media.Source,
		}
		if block.Media.Source == ir.MediaSourceBase64 && block.Media.Data != "" {
			if decoded, err := base64.StdEncoding.DecodeString(block.Media.Data); err == nil {
				media.ByteLength = len(decoded)
				hash := sha256.Sum256(decoded)
				media.SHA256 = hex.EncodeToString(hash[:])
			}
		}
		summary.Media = append(summary.Media, media)
	}
	if block.ToolUse != nil && block.ToolUse.ID != "" {
		summary.ToolCallIDs = append(summary.ToolCallIDs, block.ToolUse.ID)
	}
	if block.ToolResult != nil {
		for _, nested := range block.ToolResult.Blocks {
			appendBlockSummary(summary, nested)
		}
	}
}

func requestWireRoles(format types.RelayFormat, request any) []string {
	switch format {
	case types.RelayFormatOpenAI:
		if req := chatRequestValue(request); req != nil {
			roles := make([]string, 0, len(req.Messages))
			for _, message := range req.Messages {
				roles = append(roles, message.Role)
			}
			return roles
		}
	case types.RelayFormatClaude:
		if req := claudeRequestValue(request); req != nil {
			roles := make([]string, 0, len(req.Messages)+1)
			if req.System != nil {
				roles = append(roles, "system")
			}
			for _, message := range req.Messages {
				roles = append(roles, message.Role)
			}
			return roles
		}
	case types.RelayFormatGemini:
		if req := geminiRequestValue(request); req != nil {
			roles := make([]string, 0, len(req.Contents)+1)
			if req.SystemInstructions != nil {
				roles = append(roles, "systemInstruction")
			}
			for _, content := range req.Contents {
				roles = append(roles, content.Role)
			}
			return roles
		}
	case types.RelayFormatOpenAIResponses:
		if req := responsesRequestValue(request); req != nil {
			roles := make([]string, 0)
			if len(req.Instructions) > 0 {
				roles = append(roles, "instructions")
			}
			var input any
			if json.Unmarshal(req.Input, &input) == nil {
				collectResponsesRoles(input, &roles)
			}
			return roles
		}
	}
	return nil
}

func collectResponsesRoles(value any, roles *[]string) {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			collectResponsesRoles(item, roles)
		}
	case map[string]any:
		if role, ok := typed["role"].(string); ok && role != "" {
			*roles = append(*roles, role)
		}
	}
}

func chatRequestValue(request any) *dto.GeneralOpenAIRequest {
	switch value := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return value
	case dto.GeneralOpenAIRequest:
		return &value
	default:
		return nil
	}
}

func responsesRequestValue(request any) *dto.OpenAIResponsesRequest {
	switch value := request.(type) {
	case *dto.OpenAIResponsesRequest:
		return value
	case dto.OpenAIResponsesRequest:
		return &value
	default:
		return nil
	}
}

func claudeRequestValue(request any) *dto.ClaudeRequest {
	switch value := request.(type) {
	case *dto.ClaudeRequest:
		return value
	case dto.ClaudeRequest:
		return &value
	default:
		return nil
	}
}

func geminiRequestValue(request any) *dto.GeminiChatRequest {
	switch value := request.(type) {
	case *dto.GeminiChatRequest:
		return value
	case dto.GeminiChatRequest:
		return &value
	default:
		return nil
	}
}
