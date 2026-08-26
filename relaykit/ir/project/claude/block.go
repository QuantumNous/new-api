package claude

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func blocksFromClaudeContent(content any) ([]ir.Block, error) {
	if content == nil {
		return nil, nil
	}
	if s, ok := content.(string); ok {
		if s == "" {
			return nil, nil
		}
		return []ir.Block{ir.Text(s)}, nil
	}
	items, ok := asSlice(content)
	if !ok {
		block, err := blockFromClaudeValue(content)
		if err != nil {
			return nil, err
		}
		return []ir.Block{block}, nil
	}
	blocks := make([]ir.Block, 0, len(items))
	for _, item := range items {
		block, err := blockFromClaudeValue(item)
		if err != nil {
			return nil, err
		}
		blocks = append(blocks, block)
	}
	return blocks, nil
}

func blockFromClaudeValue(v any) (ir.Block, error) {
	if s, ok := v.(string); ok {
		return ir.Text(s), nil
	}
	if msg, ok := v.(dto.ClaudeMediaMessage); ok {
		return blockFromClaudeMedia(msg)
	}
	if msg, ok := v.(*dto.ClaudeMediaMessage); ok && msg != nil {
		return blockFromClaudeMedia(*msg)
	}
	m, ok := asMap(v)
	if !ok {
		raw, err := marshalRaw(v)
		if err != nil {
			return ir.Block{}, err
		}
		return ir.Raw("", raw), nil
	}
	return blockFromClaudeMap(m)
}

func blockFromClaudeMedia(msg dto.ClaudeMediaMessage) (ir.Block, error) {
	raw, err := marshalRaw(msg)
	if err != nil {
		return ir.Block{}, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return ir.Block{}, err
	}
	return blockFromClaudeMap(m)
}

func blockFromClaudeMap(m map[string]any) (ir.Block, error) {
	typ := mapString(m, "type")
	switch typ {
	case "", "text", "input_text":
		text := mapString(m, "text")
		block := ir.Block{
			Kind: ir.BlockKindText,
			Text: &ir.TextBlock{
				Text:         text,
				CacheControl: cacheControlFromAny(m["cache_control"]),
			},
		}
		if citations, err := marshalRaw(m["citations"]); err != nil {
			return ir.Block{}, err
		} else if rawPresent(citations) {
			block.Text.Citations = citations
		}
		return block, nil
	case "image", "document":
		return mediaFromClaudeMap(typ, m)
	case "thinking":
		return ir.Think(mapString(m, "thinking"), mapString(m, "signature")), nil
	case "redacted_thinking":
		return ir.RedactedThink(mapString(m, "data")), nil
	case "tool_use", "server_tool_use":
		input, err := marshalRaw(m["input"])
		if err != nil {
			return ir.Block{}, err
		}
		block := ir.ToolUse(mapString(m, "id"), mapString(m, "name"), input)
		block.ToolUse.Server = typ == "server_tool_use"
		return block, nil
	case "tool_result":
		return toolResultFromClaudeMap(m)
	default:
		raw, err := marshalRaw(m)
		if err != nil {
			return ir.Block{}, err
		}
		return ir.Raw(typ, raw), nil
	}
}

func mediaFromClaudeMap(typ string, m map[string]any) (ir.Block, error) {
	kind := ir.MediaImage
	if typ == "document" {
		kind = ir.MediaFile
	}
	media := &ir.MediaBlock{
		Kind:         kind,
		CacheControl: cacheControlFromAny(m["cache_control"]),
	}
	if src, ok := asMap(m["source"]); ok {
		media.MIME = mapString(src, "media_type")
		switch mapString(src, "type") {
		case "url":
			media.Source = ir.MediaSourceURL
			media.URL = mapString(src, "url")
		case "file":
			media.Source = ir.MediaSourceID
			media.FileID = mapString(src, "file_id")
			if media.MIME == "" {
				media.MIME = mapString(src, "media_type")
			}
		default:
			media.Source = ir.MediaSourceBase64
			media.Data = asString(src["data"])
			if media.URL == "" {
				media.URL = mapString(src, "url")
			}
		}
	}
	return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
}

func toolResultFromClaudeMap(m map[string]any) (ir.Block, error) {
	nested, err := blocksFromClaudeContent(m["content"])
	if err != nil {
		return ir.Block{}, err
	}
	block := ir.ToolResult(mapString(m, "tool_use_id"), nested)
	block.ToolResult.Name = mapString(m, "name")
	block.ToolResult.CacheControl = cacheControlFromAny(m["cache_control"])
	if isError, ok := mapBool(m, "is_error"); ok {
		block.ToolResult.IsError = isError
	}
	return block, nil
}

func blocksToClaudeContent(blocks []ir.Block) (any, error) {
	if len(blocks) == 0 {
		return []any{}, nil
	}
	out := make([]any, 0, len(blocks))
	for _, block := range blocks {
		item, err := blockToClaudeValue(block)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, nil
}

func blockToClaudeValue(block ir.Block) (any, error) {
	switch block.Kind {
	case ir.BlockKindText:
		if block.Text == nil {
			return map[string]any{"type": "text", "text": ""}, nil
		}
		m := map[string]any{"type": "text", "text": block.Text.Text}
		if cc := cacheControlToMap(block.Text.CacheControl); cc != nil {
			m["cache_control"] = cc
		}
		putRaw(m, "citations", block.Text.Citations)
		return m, nil
	case ir.BlockKindThink:
		if block.Think == nil {
			return map[string]any{"type": "thinking", "thinking": ""}, nil
		}
		if block.Think.Redacted {
			return map[string]any{"type": "redacted_thinking", "data": block.Think.RedactedData}, nil
		}
		m := map[string]any{"type": "thinking", "thinking": block.Think.Text}
		putIfNotEmpty(m, "signature", block.Think.Signature)
		return m, nil
	case ir.BlockKindMedia:
		return mediaToClaudeValue(block.Media)
	case ir.BlockKindToolUse:
		if block.ToolUse == nil {
			return map[string]any{"type": "tool_use"}, nil
		}
		typ := "tool_use"
		if block.ToolUse.Server {
			typ = "server_tool_use"
		}
		m := map[string]any{"type": typ}
		putIfNotEmpty(m, "id", block.ToolUse.ID)
		putIfNotEmpty(m, "name", block.ToolUse.Name)
		m["input"] = claudeToolInputValue(block.ToolUse.Input)
		return m, nil
	case ir.BlockKindToolResult:
		if block.ToolResult == nil {
			return map[string]any{"type": "tool_result"}, nil
		}
		m := map[string]any{"type": "tool_result"}
		putIfNotEmpty(m, "tool_use_id", block.ToolResult.ToolUseID)
		putIfNotEmpty(m, "name", block.ToolResult.Name)
		content, err := toolResultContent(block.ToolResult.Blocks)
		if err != nil {
			return nil, err
		}
		if content != nil {
			m["content"] = content
		}
		if block.ToolResult.IsError {
			m["is_error"] = true
		}
		if cc := cacheControlToMap(block.ToolResult.CacheControl); cc != nil {
			m["cache_control"] = cc
		}
		return m, nil
	case ir.BlockKindRaw:
		if block.Raw == nil {
			return map[string]any{"type": ""}, nil
		}
		if rawPresent(block.Raw.JSON) {
			var v any
			if err := json.Unmarshal(block.Raw.JSON, &v); err != nil {
				return nil, fmt.Errorf("raw claude block: %w", err)
			}
			if m, ok := v.(map[string]any); ok && mapString(m, "type") == "" && block.Raw.Type != "" {
				m["type"] = block.Raw.Type
			}
			return v, nil
		}
		return map[string]any{"type": block.Raw.Type}, nil
	default:
		return nil, fmt.Errorf("unsupported ir block kind %q", block.Kind)
	}
}

func mediaToClaudeValue(media *ir.MediaBlock) (any, error) {
	if media == nil {
		return map[string]any{"type": "image"}, nil
	}
	typ := "image"
	if media.Kind == ir.MediaFile {
		typ = "document"
	}
	source := map[string]any{}
	switch media.Source {
	case ir.MediaSourceURL:
		source["type"] = "url"
		putIfNotEmpty(source, "url", media.URL)
	case ir.MediaSourceID:
		source["type"] = "file"
		putIfNotEmpty(source, "file_id", media.FileID)
	default:
		source["type"] = "base64"
		if media.Data != "" {
			source["data"] = media.Data
		}
		putIfNotEmpty(source, "url", media.URL)
	}
	putIfNotEmpty(source, "media_type", media.MIME)
	m := map[string]any{"type": typ, "source": source}
	if cc := cacheControlToMap(media.CacheControl); cc != nil {
		m["cache_control"] = cc
	}
	return m, nil
}

func blocksFromClaudeMediaList(items []dto.ClaudeMediaMessage) ([]ir.Block, error) {
	if len(items) == 0 {
		return nil, nil
	}
	blocks := make([]ir.Block, 0, len(items))
	for _, item := range items {
		block, err := blockFromClaudeMedia(item)
		if err != nil {
			return nil, err
		}
		blocks = append(blocks, block)
	}
	return blocks, nil
}

func blocksToClaudeMediaList(blocks []ir.Block) ([]dto.ClaudeMediaMessage, error) {
	if len(blocks) == 0 {
		return nil, nil
	}
	out := make([]dto.ClaudeMediaMessage, 0, len(blocks))
	for _, block := range blocks {
		value, err := blockToClaudeValue(block)
		if err != nil {
			return nil, err
		}
		raw, err := marshalRaw(value)
		if err != nil {
			return nil, err
		}
		var msg dto.ClaudeMediaMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			return nil, err
		}
		out = append(out, msg)
	}
	return out, nil
}

func toolResultContent(blocks []ir.Block) (any, error) {
	if len(blocks) == 1 && blocks[0].Kind == ir.BlockKindText && blocks[0].Text != nil {
		text := blocks[0].Text.Text
		var value any
		if err := json.Unmarshal([]byte(text), &value); err == nil {
			switch value.(type) {
			case map[string]any, []any:
				return value, nil
			}
		}
		return text, nil
	}
	return blocksToClaudeContent(blocks)
}

func systemFromClaude(system any) ([]ir.Block, error) {
	if system == nil {
		return nil, nil
	}
	if s, ok := system.(string); ok {
		if strings.TrimSpace(s) == "" {
			return nil, nil
		}
		return []ir.Block{ir.Text(s)}, nil
	}
	return blocksFromClaudeContent(system)
}

func claudeToolInputValue(raw json.RawMessage) any {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return map[string]any{}
	}
	switch typed := v.(type) {
	case map[string]any:
		return typed
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return map[string]any{}
		}
		var inner any
		if err := json.Unmarshal([]byte(trimmed), &inner); err == nil {
			if m, ok := inner.(map[string]any); ok {
				return m
			}
		}
		return map[string]any{}
	default:
		return map[string]any{}
	}
}

func systemToClaude(blocks []ir.Block) (any, error) {
	if len(blocks) == 0 {
		return nil, nil
	}
	if len(blocks) == 1 && blocks[0].Kind == ir.BlockKindText && blocks[0].Text != nil &&
		blocks[0].Text.CacheControl == nil && !rawPresent(blocks[0].Text.Citations) {
		return blocks[0].Text.Text, nil
	}
	items := make([]any, 0, len(blocks))
	for _, block := range blocks {
		value, err := blockToClaudeValue(block)
		if err != nil {
			return nil, err
		}
		items = append(items, value)
	}
	return items, nil
}
