package gemini

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func blocksFromGeminiParts(parts []dto.GeminiPart) ([]ir.Block, error) {
	blocks := make([]ir.Block, 0, len(parts))
	for _, part := range parts {
		partBlocks, err := blocksFromGeminiPart(part)
		if err != nil {
			return nil, err
		}
		blocks = append(blocks, partBlocks...)
	}
	return blocks, nil
}

func blocksFromGeminiPart(part dto.GeminiPart) ([]ir.Block, error) {
	var sig []byte
	if jsonx.Present(part.ThoughtSignature) {
		sig = append([]byte(nil), part.ThoughtSignature...)
	}
	switch {
	case part.FunctionCall != nil:
		input, err := jsonx.Marshal(part.FunctionCall.Arguments)
		if err != nil {
			return nil, err
		}
		block := ir.ToolUse("", part.FunctionCall.FunctionName, input)
		block.ToolUse.ProviderSig = sig
		return []ir.Block{block}, nil
	case part.FunctionResponse != nil:
		raw, err := jsonx.Marshal(part.FunctionResponse.Response)
		if err != nil {
			return nil, err
		}
		text := ""
		if jsonx.Present(raw) {
			text = string(raw)
		}
		block := ir.ToolResult("", []ir.Block{ir.Text(text)})
		block.ToolResult.Name = part.FunctionResponse.Name
		return []ir.Block{block}, nil
	case part.InlineData != nil:
		media := &ir.MediaBlock{
			Kind:   mimeKind(part.InlineData.MimeType),
			MIME:   part.InlineData.MimeType,
			Source: ir.MediaSourceBase64,
			Data:   part.InlineData.Data,
		}
		return []ir.Block{{Kind: ir.BlockKindMedia, Media: media}}, nil
	case part.FileData != nil:
		media := &ir.MediaBlock{
			Kind:   mimeKind(part.FileData.MimeType),
			MIME:   part.FileData.MimeType,
			Source: ir.MediaSourceURI,
			URL:    part.FileData.FileUri,
		}
		return []ir.Block{{Kind: ir.BlockKindMedia, Media: media}}, nil
	case part.ExecutableCode != nil:
		return []ir.Block{{
			Kind: ir.BlockKindCode,
			Code: &ir.CodeBlock{Language: part.ExecutableCode.Language, Code: part.ExecutableCode.Code},
		}}, nil
	case part.CodeExecutionResult != nil:
		return []ir.Block{{
			Kind: ir.BlockKindCode,
			Code: &ir.CodeBlock{
				Outcome: part.CodeExecutionResult.Outcome,
				Output:  part.CodeExecutionResult.Output,
				Result:  true,
			},
		}}, nil
	case part.Thought:
		block := ir.Think(part.Text, "")
		block.Think.ProviderSig = sig
		return []ir.Block{block}, nil
	case part.Text != "" || jsonx.Present(part.ThoughtSignature):
		if part.Text == "" && len(sig) > 0 {
			block := ir.Think("", "")
			block.Think.ProviderSig = sig
			return []ir.Block{block}, nil
		}
		return []ir.Block{ir.Text(part.Text)}, nil
	default:
		raw, err := jsonx.Marshal(part)
		if err != nil {
			return nil, err
		}
		if !jsonx.Present(raw) || string(raw) == "{}" {
			return nil, nil
		}
		return []ir.Block{ir.Raw("", raw)}, nil
	}
}

func mimeKind(mime string) ir.MediaKind {
	switch {
	case strings.HasPrefix(mime, "audio/"):
		return ir.MediaAudio
	case strings.HasPrefix(mime, "video/"):
		return ir.MediaVideo
	case strings.HasPrefix(mime, "image/"), mime == "":
		return ir.MediaImage
	default:
		return ir.MediaFile
	}
}

func blocksToGeminiParts(blocks []ir.Block) ([]dto.GeminiPart, error) {
	parts := make([]dto.GeminiPart, 0, len(blocks))
	for _, block := range blocks {
		part, err := blockToGeminiPart(block)
		if err != nil {
			return nil, err
		}
		if part != nil {
			parts = append(parts, *part)
		}
	}
	return parts, nil
}

func blockToGeminiPart(block ir.Block) (*dto.GeminiPart, error) {
	switch block.Kind {
	case ir.BlockKindText:
		if block.Text == nil || block.Text.Text == "" {
			return nil, nil
		}
		return &dto.GeminiPart{Text: block.Text.Text}, nil
	case ir.BlockKindThink:
		if block.Think == nil {
			return nil, nil
		}
		if block.Think.Text == "" && len(block.Think.ProviderSig) == 0 {
			return nil, nil
		}
		return &dto.GeminiPart{
			Text:             block.Think.Text,
			Thought:          !block.Think.Redacted,
			ThoughtSignature: json.RawMessage(block.Think.ProviderSig),
		}, nil
	case ir.BlockKindMedia:
		return mediaToGeminiPart(block.Media)
	case ir.BlockKindToolUse:
		if block.ToolUse == nil || block.ToolUse.Name == "" {
			return nil, nil
		}
		var args any
		if jsonx.Present(block.ToolUse.Input) {
			if err := json.Unmarshal(block.ToolUse.Input, &args); err != nil {
				return nil, err
			}
		}
		return &dto.GeminiPart{
			FunctionCall:     &dto.FunctionCall{FunctionName: block.ToolUse.Name, Arguments: args},
			ThoughtSignature: json.RawMessage(block.ToolUse.ProviderSig),
		}, nil
	case ir.BlockKindToolResult:
		if block.ToolResult == nil || block.ToolResult.Name == "" {
			return nil, nil
		}
		response := map[string]any{}
		if len(block.ToolResult.Blocks) == 1 && block.ToolResult.Blocks[0].Kind == ir.BlockKindText && block.ToolResult.Blocks[0].Text != nil {
			raw := []byte(block.ToolResult.Blocks[0].Text.Text)
			if json.Valid(raw) {
				if err := json.Unmarshal(raw, &response); err != nil {
					response = map[string]any{"result": block.ToolResult.Blocks[0].Text.Text}
				}
			} else {
				response = map[string]any{"result": block.ToolResult.Blocks[0].Text.Text}
			}
		}
		return &dto.GeminiPart{
			FunctionResponse: &dto.GeminiFunctionResponse{
				Name:     block.ToolResult.Name,
				Response: response,
			},
		}, nil
	case ir.BlockKindCode:
		if block.Code == nil {
			return &dto.GeminiPart{}, nil
		}
		if block.Code.Result {
			return &dto.GeminiPart{CodeExecutionResult: &dto.GeminiPartCodeExecutionResult{
				Outcome: block.Code.Outcome,
				Output:  block.Code.Output,
			}}, nil
		}
		return &dto.GeminiPart{ExecutableCode: &dto.GeminiPartExecutableCode{
			Language: block.Code.Language,
			Code:     block.Code.Code,
		}}, nil
	case ir.BlockKindRaw:
		if block.Raw == nil || !jsonx.Present(block.Raw.JSON) {
			return nil, nil
		}
		var part dto.GeminiPart
		if err := json.Unmarshal(block.Raw.JSON, &part); err != nil {
			return nil, fmt.Errorf("raw gemini part: %w", err)
		}
		return &part, nil
	default:
		return nil, fmt.Errorf("unsupported ir block kind %q", block.Kind)
	}
}

func mediaToGeminiPart(media *ir.MediaBlock) (*dto.GeminiPart, error) {
	if media == nil {
		return &dto.GeminiPart{}, nil
	}
	if media.Source == ir.MediaSourceURI || media.URL != "" && media.Data == "" {
		return &dto.GeminiPart{FileData: &dto.GeminiFileData{MimeType: media.MIME, FileUri: media.URL}}, nil
	}
	return &dto.GeminiPart{InlineData: &dto.GeminiInlineData{MimeType: media.MIME, Data: media.Data}}, nil
}

func geminiRoleToIR(role string) ir.Role {
	switch role {
	case "model":
		return ir.RoleAssistant
	case "user", "":
		return ir.RoleUser
	default:
		return ir.Role(role)
	}
}

func irRoleToGemini(role ir.Role) string {
	switch role {
	case ir.RoleAssistant:
		return "model"
	case ir.RoleUser, ir.RoleTool:
		return "user"
	default:
		return string(role)
	}
}
