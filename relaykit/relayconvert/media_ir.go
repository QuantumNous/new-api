package relayconvert

import (
	"context"
	"encoding/base64"
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/ir"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func normalizeRequestMedia(ctx context.Context, from, target types.RelayFormat, req *ir.Request) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if req == nil {
		return nil
	}
	for messageIndex := range req.Messages {
		for blockIndex := range req.Messages[messageIndex].Blocks {
			path := fmt.Sprintf("messages[%d].blocks[%d]", messageIndex, blockIndex)
			if err := normalizeMediaBlock(ctx, from, target, &req.Messages[messageIndex].Blocks[blockIndex], path); err != nil {
				return err
			}
		}
	}
	return nil
}

func normalizeMediaBlock(ctx context.Context, from, target types.RelayFormat, block *ir.Block, path string) error {
	if block == nil {
		return nil
	}
	if block.Media != nil {
		if err := normalizeMedia(ctx, from, target, block.Media, path+".media"); err != nil {
			return err
		}
	}
	if block.ToolResult != nil {
		for i := range block.ToolResult.Blocks {
			if err := normalizeMediaBlock(ctx, from, target, &block.ToolResult.Blocks[i], fmt.Sprintf("%s.tool_result.blocks[%d]", path, i)); err != nil {
				return err
			}
		}
	}
	return nil
}

func normalizeMedia(ctx context.Context, from, target types.RelayFormat, media *ir.MediaBlock, path string) error {
	if media == nil {
		return nil
	}
	media.MIME = cleanMIME(media.MIME)
	media.Filename = strings.TrimSpace(media.Filename)

	if mimeType, data, ok := parseMediaDataURL(media.Data); ok {
		if media.MIME == "" {
			media.MIME = cleanMIME(mimeType)
		}
		media.Data = data
		media.Source = ir.MediaSourceBase64
	}
	if mimeType, data, ok := parseMediaDataURL(media.URL); ok {
		if media.Data != "" || media.FileID != "" {
			return fmt.Errorf("%s: media must contain exactly one of data, URL, or file ID", path)
		}
		if media.MIME == "" {
			media.MIME = cleanMIME(mimeType)
		}
		media.Data = data
		media.URL = ""
		media.Source = ir.MediaSourceBase64
	}

	locatorCount := 0
	if media.Data != "" {
		locatorCount++
	}
	if media.URL != "" {
		locatorCount++
	}
	if media.FileID != "" {
		locatorCount++
	}
	if locatorCount != 1 {
		return fmt.Errorf("%s: media must contain exactly one of data, URL, or file ID", path)
	}

	switch {
	case media.Data != "":
		media.Source = ir.MediaSourceBase64
		decoded, err := base64.StdEncoding.DecodeString(media.Data)
		if err != nil {
			return fmt.Errorf("%s: invalid base64 media data: %w", path, err)
		}
		if media.MIME == "" || media.MIME == "application/octet-stream" {
			media.MIME = detectInlineMIME(decoded, media.Filename)
		}
	case media.URL != "":
		if media.Source != ir.MediaSourceURI {
			media.Source = ir.MediaSourceURL
		}
	case media.FileID != "":
		media.Source = ir.MediaSourceID
	}

	if media.Source == ir.MediaSourceID && from != target {
		return fmt.Errorf("%s: file ID cannot be projected from %s to %s without an explicit file migration capability", path, from, target)
	}
	if media.Source == ir.MediaSourceURI && target != types.RelayFormatGemini {
		return fmt.Errorf("%s: Gemini file URI cannot be projected to %s", path, target)
	}

	needsMaterialization := media.Source == ir.MediaSourceURL && (target == types.RelayFormatGemini ||
		target == types.RelayFormatOpenAI && media.Kind == ir.MediaFile)
	if needsMaterialization {
		data, mimeType, err := relaymedia.ResolveBase64Data(ctx, types.NewURLFileSource(media.URL), "normalizing cross-protocol media")
		if err != nil {
			return fmt.Errorf("%s: materialize media URL: %w", path, err)
		}
		media.Source = ir.MediaSourceBase64
		media.Data = data
		media.URL = ""
		if clean := cleanMIME(mimeType); clean != "" {
			media.MIME = clean
		}
	}

	if media.MIME == "" && media.Source == ir.MediaSourceBase64 {
		media.MIME = "application/octet-stream"
	}
	if media.Kind == "" {
		media.Kind = mediaKindFromMIME(media.MIME)
	}
	if media.Kind == ir.MediaFile && media.Filename == "" && media.Source == ir.MediaSourceBase64 &&
		(target == types.RelayFormatOpenAI || target == types.RelayFormatOpenAIResponses) {
		media.Filename = defaultMediaFilename(media.MIME)
	}
	return nil
}

func parseMediaDataURL(value string) (mimeType, data string, ok bool) {
	if len(value) < len("data:") || !strings.EqualFold(value[:len("data:")], "data:") {
		return "", "", false
	}
	header, payload, found := strings.Cut(value[len("data:"):], ",")
	if !found {
		return "", "", false
	}
	parts := strings.Split(header, ";")
	base64Encoded := false
	for _, part := range parts[1:] {
		if strings.EqualFold(strings.TrimSpace(part), "base64") {
			base64Encoded = true
			break
		}
	}
	if !base64Encoded {
		return "", "", false
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(payload), true
}

func cleanMIME(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if mediaType, _, err := mime.ParseMediaType(value); err == nil {
		return strings.ToLower(mediaType)
	}
	return strings.ToLower(strings.TrimSpace(strings.SplitN(value, ";", 2)[0]))
}

func detectInlineMIME(decoded []byte, filename string) string {
	if byName := mimeFromName(filename); byName != "" {
		return byName
	}
	if len(decoded) == 0 {
		return "application/octet-stream"
	}
	return cleanMIME(http.DetectContentType(decoded))
}

func mimeFromName(name string) string {
	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(name)))
	if ext == "" {
		return ""
	}
	if ext == ".pdf" {
		return "application/pdf"
	}
	return cleanMIME(mime.TypeByExtension(ext))
}

func mediaKindFromMIME(mimeType string) ir.MediaKind {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return ir.MediaImage
	case strings.HasPrefix(mimeType, "audio/"):
		return ir.MediaAudio
	case strings.HasPrefix(mimeType, "video/"):
		return ir.MediaVideo
	default:
		return ir.MediaFile
	}
}

func defaultMediaFilename(mimeType string) string {
	extensions, _ := mime.ExtensionsByType(mimeType)
	if mimeType == "application/pdf" {
		return "document.pdf"
	}
	if len(extensions) > 0 {
		return "document" + extensions[0]
	}
	return "document.bin"
}
