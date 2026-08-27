package responses

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func messagesFromResponsesInput(raw json.RawMessage) ([]ir.Message, error) {
	if !jsonx.Present(raw) {
		return nil, nil
	}
	if jsonx.RawJSONType(raw) == "string" {
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, err
		}
		return []ir.Message{{Role: ir.RoleUser, Blocks: []ir.Block{ir.Text(s)}}}, nil
	}
	items, ok := jsonx.AsSlice(raw)
	if !ok {
		return nil, nil
	}
	out := make([]ir.Message, 0, len(items))
	for _, item := range items {
		msg, err := messageFromResponsesItem(item)
		if err != nil {
			return nil, err
		}
		out = append(out, msg)
	}
	return out, nil
}

func messageFromResponsesItem(item any) (ir.Message, error) {
	m, ok := jsonx.AsMap(item)
	if !ok {
		raw, err := jsonx.Marshal(item)
		if err != nil {
			return ir.Message{}, err
		}
		return ir.Message{Role: ir.RoleUser, Blocks: []ir.Block{ir.Raw("", raw)}}, nil
	}
	typ := jsonx.MapString(m, "type")
	full, err := jsonx.Marshal(m)
	if err != nil {
		return ir.Message{}, err
	}
	switch typ {
	case "", "message":
		role, err := ir.NormalizeRole(jsonx.MapString(m, "role"))
		if err != nil {
			return ir.Message{}, err
		}
		blocks, err := blocksFromResponsesContent(m["content"])
		if err != nil {
			return ir.Message{}, err
		}
		return ir.Message{Role: role, Blocks: blocks}, nil
	case "custom_tool_call", "custom_tool_call_output":
		return ir.Message{Role: ir.RoleAssistant, Blocks: []ir.Block{ir.Raw(typ, full)}}, nil
	case "function_call":
		input := json.RawMessage(nil)
		if args := m["arguments"]; args != nil {
			input, err = jsonx.Marshal(args)
			if err != nil {
				return ir.Message{}, err
			}
			if jsonx.RawJSONType(input) == "string" {
				var s string
				_ = json.Unmarshal(input, &s)
				if json.Valid([]byte(s)) {
					input = json.RawMessage(s)
				}
			}
		}
		id := jsonx.MapString(m, "call_id")
		if id == "" {
			id = jsonx.MapString(m, "id")
		}
		return ir.Message{
			Role:   ir.RoleAssistant,
			Blocks: []ir.Block{ir.ToolUse(id, responsesFunctionName(m), input)},
		}, nil
	case "function_call_output":
		content := m["output"]
		if content == nil {
			content = m["content"]
		}
		blocks, err := blocksFromResponsesContent(content)
		if err != nil {
			return ir.Message{}, err
		}
		if len(blocks) == 0 {
			blocks = []ir.Block{ir.Text(jsonx.AsString(content))}
		}
		id := jsonx.MapString(m, "call_id")
		return ir.Message{
			Role:   ir.RoleTool,
			Blocks: []ir.Block{ir.ToolResult(id, blocks)},
		}, nil
	case "reasoning":
		text := reasoningTextFromMap(m)
		return ir.Message{Role: ir.RoleAssistant, Blocks: []ir.Block{ir.Think(text, "")}}, nil
	default:
		return ir.Message{Role: ir.RoleAssistant, Blocks: []ir.Block{ir.Raw(typ, full)}}, nil
	}
}

func responsesFunctionName(m map[string]any) string {
	if name := jsonx.MapString(m, "name"); name != "" {
		return name
	}
	if fn, ok := jsonx.AsMap(m["function"]); ok {
		return jsonx.MapString(fn, "name")
	}
	return ""
}

func reasoningTextFromMap(m map[string]any) string {
	if summary, ok := jsonx.AsSlice(m["summary"]); ok {
		var text string
		for _, part := range summary {
			if inner, ok := jsonx.AsMap(part); ok {
				text += jsonx.MapString(inner, "text")
			}
		}
		return text
	}
	return jsonx.MapString(m, "content")
}

func blocksFromResponsesContent(content any) ([]ir.Block, error) {
	if content == nil {
		return nil, nil
	}
	if s, ok := content.(string); ok {
		if s == "" {
			return nil, nil
		}
		return []ir.Block{ir.Text(s)}, nil
	}
	if m, ok := jsonx.AsMap(content); ok {
		raw, err := json.Marshal(m)
		if err != nil {
			return nil, err
		}
		return []ir.Block{ir.Text(string(raw))}, nil
	}
	if raw, ok := content.(json.RawMessage); ok {
		switch jsonx.RawJSONType(raw) {
		case "string":
			var s string
			if err := json.Unmarshal(raw, &s); err != nil {
				return nil, err
			}
			return []ir.Block{ir.Text(s)}, nil
		case "array":
			var items []any
			if err := json.Unmarshal(raw, &items); err != nil {
				return nil, err
			}
			return blocksFromResponsesContent(items)
		}
	}
	items, ok := jsonx.AsSlice(content)
	if !ok {
		if s := jsonx.AsString(content); s != "" {
			return []ir.Block{ir.Text(s)}, nil
		}
		return nil, nil
	}
	blocks := make([]ir.Block, 0, len(items))
	for _, item := range items {
		block, err := blockFromResponsesPart(item)
		if err != nil {
			return nil, err
		}
		blocks = append(blocks, block)
	}
	return blocks, nil
}

func blockFromResponsesPart(item any) (ir.Block, error) {
	m, ok := jsonx.AsMap(item)
	if !ok {
		return ir.Text(jsonx.AsString(item)), nil
	}
	typ := jsonx.MapString(m, "type")
	switch typ {
	case "", "input_text", "output_text", "text":
		return ir.Text(jsonx.MapString(m, "text")), nil
	case "input_image":
		media := &ir.MediaBlock{Kind: ir.MediaImage, Detail: jsonx.MapString(m, "detail")}
		url := jsonx.MapString(m, "image_url")
		if url == "" {
			if inner, ok := jsonx.AsMap(m["image_url"]); ok {
				url = jsonx.MapString(inner, "url")
			}
		}
		if mime, data, ok := jsonx.ParseDataURL(url); ok {
			media.Source = ir.MediaSourceBase64
			media.MIME = mime
			media.Data = data
		} else {
			media.Source = ir.MediaSourceURL
			media.URL = url
		}
		return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
	case "input_file":
		media := &ir.MediaBlock{
			Kind:     ir.MediaFile,
			Filename: firstNonEmpty(jsonx.MapString(m, "filename"), jsonx.MapString(m, "file_name")),
			MIME:     firstNonEmpty(jsonx.MapString(m, "mime_type"), jsonx.MapString(m, "media_type")),
		}
		fileData := jsonx.MapString(m, "file_data")
		fileURL := jsonx.MapString(m, "file_url")
		if fileURL == "" {
			if inner, ok := jsonx.AsMap(m["file_url"]); ok {
				fileURL = jsonx.MapString(inner, "url")
			}
		}
		media.URL = fileURL
		media.FileID = jsonx.MapString(m, "file_id")
		switch {
		case fileData != "":
			media.Source = ir.MediaSourceBase64
			if mime, data, ok := jsonx.ParseDataURL(fileData); ok {
				if media.MIME == "" {
					media.MIME = mime
				}
				media.Data = data
			} else {
				media.Data = fileData
			}
		case fileURL != "":
			if mime, data, ok := jsonx.ParseDataURL(fileURL); ok {
				media.Source = ir.MediaSourceBase64
				media.URL = ""
				if media.MIME == "" {
					media.MIME = mime
				}
				media.Data = data
			} else {
				media.Source = ir.MediaSourceURL
				media.URL = fileURL
			}
		case media.FileID != "":
			media.Source = ir.MediaSourceID
		}
		return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
	default:
		raw, err := jsonx.Marshal(m)
		if err != nil {
			return ir.Block{}, err
		}
		return ir.Raw(typ, raw), nil
	}
}

func messageToResponsesItems(msg ir.Message) ([]any, error) {
	if len(msg.Blocks) == 1 && msg.Blocks[0].Kind == ir.BlockKindRaw && msg.Blocks[0].Raw != nil {
		var v any
		if err := json.Unmarshal(msg.Blocks[0].Raw.JSON, &v); err != nil {
			return nil, err
		}
		return []any{v}, nil
	}
	var items []any
	var pending []ir.Block
	flushMessage := func() error {
		if len(pending) == 0 {
			return nil
		}
		content, err := blocksToResponsesContent(pending, msg.Role != ir.RoleAssistant)
		if err != nil {
			return err
		}
		item := map[string]any{"type": "message", "content": content}
		jsonx.PutIfNotEmpty(item, "role", string(msg.Role))
		items = append(items, item)
		pending = nil
		return nil
	}
	for _, block := range msg.Blocks {
		switch block.Kind {
		case ir.BlockKindThink:
			if err := flushMessage(); err != nil {
				return nil, err
			}
			text := ""
			if block.Think != nil {
				text = block.Think.Text
			}
			items = append(items, map[string]any{
				"type": "reasoning",
				"summary": []any{
					map[string]any{"type": "summary_text", "text": text},
				},
			})
		case ir.BlockKindToolUse:
			if err := flushMessage(); err != nil {
				return nil, err
			}
			items = append(items, functionCallItem(block.ToolUse))
		case ir.BlockKindToolResult:
			if err := flushMessage(); err != nil {
				return nil, err
			}
			item, err := functionCallOutputItem(block.ToolResult)
			if err != nil {
				return nil, err
			}
			items = append(items, item)
		case ir.BlockKindRaw:
			if err := flushMessage(); err != nil {
				return nil, err
			}
			if block.Raw != nil && jsonx.Present(block.Raw.JSON) {
				var v any
				if err := json.Unmarshal(block.Raw.JSON, &v); err != nil {
					return nil, err
				}
				items = append(items, v)
			}
		default:
			pending = append(pending, block)
		}
	}
	if err := flushMessage(); err != nil {
		return nil, err
	}
	return items, nil
}

func functionCallItem(use *ir.ToolUseBlock) map[string]any {
	item := map[string]any{"type": "function_call"}
	if use == nil {
		return item
	}
	jsonx.PutIfNotEmpty(item, "call_id", use.ID)
	if use.ID != "" {
		item["id"] = responsesFunctionItemID(use.ID)
	}
	jsonx.PutIfNotEmpty(item, "name", use.Name)
	if jsonx.Present(use.Input) {
		item["arguments"] = rawToResponsesArguments(use.Input)
	}
	return item
}

func functionCallOutputItem(result *ir.ToolResultBlock) (map[string]any, error) {
	item := map[string]any{"type": "function_call_output"}
	if result == nil {
		return item, nil
	}
	jsonx.PutIfNotEmpty(item, "call_id", result.ToolUseID)
	if len(result.Blocks) == 1 && result.Blocks[0].Kind == ir.BlockKindText && result.Blocks[0].Text != nil {
		item["output"] = result.Blocks[0].Text.Text
		return item, nil
	}
	content, err := blocksToResponsesContent(result.Blocks, false)
	if err != nil {
		return nil, err
	}
	item["output"] = content
	return item, nil
}

func responsesFunctionItemID(callID string) string {
	if strings.HasPrefix(callID, "fc_") {
		return "fc_item_" + strings.TrimPrefix(callID, "fc_")
	}
	return "fc_" + callID
}

func blocksToResponsesContent(blocks []ir.Block, input bool) (any, error) {
	if len(blocks) == 1 && blocks[0].Kind == ir.BlockKindText && blocks[0].Text != nil {
		return blocks[0].Text.Text, nil
	}
	parts := make([]any, 0, len(blocks))
	for _, block := range blocks {
		part, err := blockToResponsesPart(block, input)
		if err != nil {
			return nil, err
		}
		if part != nil {
			parts = append(parts, part)
		}
	}
	return parts, nil
}

func blockToResponsesPart(block ir.Block, input bool) (any, error) {
	switch block.Kind {
	case ir.BlockKindText:
		text := ""
		if block.Text != nil {
			text = block.Text.Text
		}
		typ := "output_text"
		if input {
			typ = "input_text"
		}
		return map[string]any{"type": typ, "text": text}, nil
	case ir.BlockKindMedia:
		if block.Media == nil {
			return nil, nil
		}
		if block.Media.Kind == ir.MediaFile {
			item := map[string]any{"type": "input_file"}
			jsonx.PutIfNotEmpty(item, "filename", block.Media.Filename)
			switch block.Media.Source {
			case ir.MediaSourceBase64:
				if block.Media.Data != "" {
					item["file_data"] = jsonx.DataURL(block.Media.MIME, block.Media.Data)
				}
			case ir.MediaSourceURL:
				jsonx.PutIfNotEmpty(item, "file_url", block.Media.URL)
			case ir.MediaSourceID:
				jsonx.PutIfNotEmpty(item, "file_id", block.Media.FileID)
			}
			return item, nil
		}
		url := block.Media.URL
		if block.Media.Source == ir.MediaSourceBase64 && block.Media.Data != "" {
			url = jsonx.DataURL(block.Media.MIME, block.Media.Data)
		}
		item := map[string]any{"type": "input_image", "image_url": url}
		jsonx.PutIfNotEmpty(item, "detail", block.Media.Detail)
		return item, nil
	case ir.BlockKindRaw:
		if block.Raw == nil || !jsonx.Present(block.Raw.JSON) {
			return nil, nil
		}
		var v any
		if err := json.Unmarshal(block.Raw.JSON, &v); err != nil {
			return nil, err
		}
		return v, nil
	default:
		return nil, nil
	}
}

func responsesArgumentsToRaw(raw json.RawMessage) json.RawMessage {
	if jsonx.RawJSONType(raw) != "string" {
		return jsonx.Clone(raw)
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return jsonx.Clone(raw)
	}
	if json.Valid([]byte(value)) {
		return json.RawMessage(value)
	}
	encoded, _ := json.Marshal(value)
	return encoded
}

func rawToResponsesArguments(raw json.RawMessage) string {
	if jsonx.RawJSONType(raw) == "string" {
		var s string
		if err := json.Unmarshal(raw, &s); err == nil {
			return s
		}
	}
	return string(raw)
}
