package chat

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func blocksFromChatMessage(msg dto.Message) ([]ir.Block, error) {
	var blocks []ir.Block
	if reasoning := msg.GetReasoningContent(); reasoning != "" {
		blocks = append(blocks, ir.Think(reasoning, ""))
	}
	if msg.Role != "tool" {
		for _, call := range msg.ParseToolCalls() {
			input, err := chatArgumentsToRaw(call.Function.Arguments)
			if err != nil {
				return nil, err
			}
			block := ir.ToolUse(call.ID, call.Function.Name, input)
			blocks = append(blocks, block)
		}
	}
	if msg.Role == "tool" {
		contentBlocks, err := blocksFromChatContent(msg.Content)
		if err != nil {
			return nil, err
		}
		if len(contentBlocks) == 0 && msg.Content != nil {
			contentBlocks = []ir.Block{ir.Text(msg.StringContent())}
		}
		blocks = append(blocks, ir.ToolResult(msg.ToolCallId, contentBlocks))
		return blocks, nil
	}
	contentBlocks, err := blocksFromChatContent(msg.Content)
	if err != nil {
		return nil, err
	}
	blocks = append(blocks, contentBlocks...)
	return blocks, nil
}

func blocksFromChatContent(content any) ([]ir.Block, error) {
	if content == nil {
		return nil, nil
	}
	if s, ok := content.(string); ok {
		if s == "" {
			return nil, nil
		}
		return []ir.Block{ir.Text(s)}, nil
	}
	items, ok := jsonx.AsSlice(content)
	if !ok {
		block, err := blockFromChatPart(content)
		if err != nil {
			return nil, err
		}
		return []ir.Block{block}, nil
	}
	blocks := make([]ir.Block, 0, len(items))
	for _, item := range items {
		block, err := blockFromChatPart(item)
		if err != nil {
			return nil, err
		}
		blocks = append(blocks, block)
	}
	return blocks, nil
}

func blockFromChatPart(v any) (ir.Block, error) {
	if s, ok := v.(string); ok {
		return ir.Text(s), nil
	}
	m, ok := jsonx.AsMap(v)
	if !ok {
		raw, err := jsonx.Marshal(v)
		if err != nil {
			return ir.Block{}, err
		}
		return ir.Raw("", raw), nil
	}
	typ := jsonx.MapString(m, "type")
	switch typ {
	case "", dto.ContentTypeText:
		block := ir.Text(jsonx.MapString(m, "text"))
		block.Text.CacheControl = jsonx.CacheControlFrom(m["cache_control"])
		return block, nil
	case dto.ContentTypeImageURL:
		return imageFromChatMap(m)
	case dto.ContentTypeInputAudio:
		return audioFromChatMap(m)
	case dto.ContentTypeFile:
		return fileFromChatMap(m)
	case dto.ContentTypeVideoUrl:
		return videoFromChatMap(m)
	default:
		raw, err := jsonx.Marshal(m)
		if err != nil {
			return ir.Block{}, err
		}
		return ir.Raw(typ, raw), nil
	}
}

func imageFromChatMap(m map[string]any) (ir.Block, error) {
	media := &ir.MediaBlock{Kind: ir.MediaImage, CacheControl: jsonx.CacheControlFrom(m["cache_control"])}
	switch img := m["image_url"].(type) {
	case string:
		applyChatImageURL(media, img, "")
	default:
		if inner, ok := jsonx.AsMap(img); ok {
			applyChatImageURL(media, jsonx.MapString(inner, "url"), jsonx.MapString(inner, "detail"))
			if media.MIME == "" {
				media.MIME = jsonx.MapString(inner, "mime_type")
			}
		}
	}
	return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
}

func applyChatImageURL(media *ir.MediaBlock, url, detail string) {
	media.Detail = detail
	if mime, data, ok := jsonx.ParseDataURL(url); ok {
		media.Source = ir.MediaSourceBase64
		media.MIME = mime
		media.Data = data
		return
	}
	media.Source = ir.MediaSourceURL
	media.URL = url
}

func audioFromChatMap(m map[string]any) (ir.Block, error) {
	media := &ir.MediaBlock{Kind: ir.MediaAudio, Source: ir.MediaSourceBase64, CacheControl: jsonx.CacheControlFrom(m["cache_control"])}
	if inner, ok := jsonx.AsMap(m["input_audio"]); ok {
		media.Data = jsonx.MapString(inner, "data")
		format := jsonx.MapString(inner, "format")
		if format != "" && !strings.Contains(format, "/") {
			media.MIME = "audio/" + format
		} else {
			media.MIME = format
		}
	}
	return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
}

func fileFromChatMap(m map[string]any) (ir.Block, error) {
	media := &ir.MediaBlock{Kind: ir.MediaFile, CacheControl: jsonx.CacheControlFrom(m["cache_control"])}
	if inner, ok := jsonx.AsMap(m["file"]); ok {
		media.FileID = jsonx.MapString(inner, "file_id")
		media.Data = jsonx.MapString(inner, "file_data")
		if media.Data != "" {
			media.Source = ir.MediaSourceBase64
		} else if media.FileID != "" {
			media.Source = ir.MediaSourceID
		}
	}
	return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
}

func videoFromChatMap(m map[string]any) (ir.Block, error) {
	media := &ir.MediaBlock{Kind: ir.MediaVideo, Source: ir.MediaSourceURL, CacheControl: jsonx.CacheControlFrom(m["cache_control"])}
	switch video := m["video_url"].(type) {
	case string:
		media.URL = video
	default:
		if inner, ok := jsonx.AsMap(video); ok {
			media.URL = jsonx.MapString(inner, "url")
		}
	}
	return ir.Block{Kind: ir.BlockKindMedia, Media: media}, nil
}

func chatArgumentsToRaw(arguments string) (json.RawMessage, error) {
	if strings.TrimSpace(arguments) == "" {
		return nil, nil
	}
	trimmed := strings.TrimSpace(arguments)
	if json.Valid([]byte(trimmed)) {
		return json.RawMessage(trimmed), nil
	}
	return json.Marshal(arguments)
}

func blocksToChatMessage(msg ir.Message) (dto.Message, error) {
	out := dto.Message{Role: string(msg.Role)}
	if msg.Name != "" {
		name := msg.Name
		out.Name = &name
	}
	if jsonx.Present(msg.Extra) {
		if err := jsonx.MergeInto(&out, msg.Extra); err != nil {
			return dto.Message{}, err
		}
	}

	var thinkText string
	var content []ir.Block
	var toolCalls []dto.ToolCallRequest
	var toolResult *ir.ToolResultBlock
	for _, block := range msg.Blocks {
		switch block.Kind {
		case ir.BlockKindThink:
			if block.Think != nil {
				thinkText += block.Think.Text
			}
		case ir.BlockKindToolUse:
			if block.ToolUse == nil {
				continue
			}
			toolCalls = append(toolCalls, dto.ToolCallRequest{
				ID:   block.ToolUse.ID,
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      block.ToolUse.Name,
					Arguments: rawToChatArguments(block.ToolUse.Input),
				},
			})
		case ir.BlockKindToolResult:
			toolResult = block.ToolResult
		default:
			content = append(content, block)
		}
	}
	if thinkText != "" {
		out.ReasoningContent = &thinkText
	}
	if len(toolCalls) > 0 {
		out.SetToolCalls(toolCalls)
	}
	if msg.Role == ir.RoleTool || toolResult != nil {
		out.Role = "tool"
		if toolResult != nil {
			out.ToolCallId = toolResult.ToolUseID
			body, err := blocksToChatContent(toolResult.Blocks)
			if err != nil {
				return dto.Message{}, err
			}
			out.Content = body
		}
		return out, nil
	}
	body, err := blocksToChatContent(content)
	if err != nil {
		return dto.Message{}, err
	}
	out.Content = body
	return out, nil
}

func blocksToChatContent(blocks []ir.Block) (any, error) {
	if len(blocks) == 0 {
		return nil, nil
	}
	parts := make([]any, 0, len(blocks))
	onlyText := true
	var texts []string
	for _, block := range blocks {
		part, err := blockToChatPart(block)
		if err != nil {
			return nil, err
		}
		if part == nil {
			continue
		}
		parts = append(parts, part)
		text, ok := chatPartText(part)
		if !ok {
			onlyText = false
			continue
		}
		texts = append(texts, text)
	}
	if len(parts) == 0 {
		return nil, nil
	}
	if onlyText {
		return strings.Join(texts, ""), nil
	}
	return parts, nil
}

func chatPartText(part any) (string, bool) {
	m, ok := jsonx.AsMap(part)
	if !ok {
		return "", false
	}
	if jsonx.MapString(m, "type") != "text" && jsonx.MapString(m, "type") != "" {
		return "", false
	}
	for key := range m {
		switch key {
		case "type", "text":
		default:
			return "", false
		}
	}
	return jsonx.MapString(m, "text"), true
}

func blockToChatPart(block ir.Block) (any, error) {
	switch block.Kind {
	case ir.BlockKindText:
		text := ""
		if block.Text != nil {
			text = block.Text.Text
		}
		return map[string]any{"type": "text", "text": text}, nil
	case ir.BlockKindMedia:
		return mediaToChatPart(block.Media)
	case ir.BlockKindRaw:
		if block.Raw == nil {
			return map[string]any{"type": ""}, nil
		}
		if jsonx.Present(block.Raw.JSON) {
			var v any
			if err := json.Unmarshal(block.Raw.JSON, &v); err != nil {
				return nil, err
			}
			return v, nil
		}
		return map[string]any{"type": block.Raw.Type}, nil
	default:
		return nil, nil
	}
}

func mediaToChatPart(media *ir.MediaBlock) (any, error) {
	if media == nil {
		return map[string]any{"type": dto.ContentTypeImageURL}, nil
	}
	switch media.Kind {
	case ir.MediaAudio:
		format := strings.TrimPrefix(media.MIME, "audio/")
		m := map[string]any{
			"type": dto.ContentTypeInputAudio,
			"input_audio": map[string]any{
				"data":   media.Data,
				"format": format,
			},
		}
		return m, nil
	case ir.MediaFile:
		file := map[string]any{}
		jsonx.PutIfNotEmpty(file, "file_id", media.FileID)
		jsonx.PutIfNotEmpty(file, "file_data", media.Data)
		m := map[string]any{"type": dto.ContentTypeFile, "file": file}
		return m, nil
	case ir.MediaVideo:
		m := map[string]any{"type": dto.ContentTypeVideoUrl, "video_url": map[string]any{"url": media.URL}}
		return m, nil
	default:
		url := media.URL
		if media.Source == ir.MediaSourceBase64 && media.Data != "" {
			url = jsonx.DataURL(media.MIME, media.Data)
		}
		image := map[string]any{"url": url}
		jsonx.PutIfNotEmpty(image, "detail", media.Detail)
		jsonx.PutIfNotEmpty(image, "mime_type", media.MIME)
		m := map[string]any{"type": dto.ContentTypeImageURL, "image_url": image}
		return m, nil
	}
}

func rawToChatArguments(raw json.RawMessage) string {
	if !jsonx.Present(raw) {
		return ""
	}
	if jsonx.RawJSONType(raw) == "string" {
		var s string
		if err := json.Unmarshal(raw, &s); err == nil {
			return s
		}
	}
	return string(raw)
}

func messageExtraFromChat(msg dto.Message) (json.RawMessage, error) {
	return jsonx.WithoutKeys(msg, "role", "content", "name", "reasoning_content", "reasoning", "tool_calls", "tool_call_id")
}
