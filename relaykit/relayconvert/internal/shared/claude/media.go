package claude

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
)

// imageMediaTypes are the image formats Claude accepts.
var imageMediaTypes = map[string]struct{}{
	"image/jpeg": {},
	"image/png":  {},
	"image/gif":  {},
	"image/webp": {},
}

// MediaBlock builds the Claude content block for resolved base64 media: an
// image in a format Claude accepts, a PDF document, or a plain-text document
// for text files. declaredImage marks media sent as an image part, which
// passes through when its MIME type is unknown. A non-empty reason means
// Claude cannot carry the media and the block must be omitted.
func MediaBlock(base64Data string, mimeType string, declaredImage bool) (dto.ClaudeMediaMessage, string) {
	mediaType, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(mimeType)), ";")
	mediaType = strings.TrimSpace(mediaType)
	if mediaType == "image/jpg" {
		mediaType = "image/jpeg"
	}
	switch {
	case mediaType == "application/pdf":
		return dto.ClaudeMediaMessage{
			Type:   "document",
			Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: mediaType, Data: base64Data},
		}, ""
	case relaymedia.IsTextMimeType(mediaType):
		text, ok := relaymedia.DecodeText(base64Data)
		if !ok {
			return dto.ClaudeMediaMessage{}, fmt.Sprintf("text file of MIME type %q could not be decoded as UTF-8 text", mimeType)
		}
		return dto.ClaudeMediaMessage{
			Type:   "document",
			Source: &dto.ClaudeMessageSource{Type: "text", MediaType: "text/plain", Data: text},
		}, ""
	case mediaType == "" && declaredImage:
		return dto.ClaudeMediaMessage{
			Type:   "image",
			Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: mimeType, Data: base64Data},
		}, ""
	case mediaType == "application/octet-stream" && declaredImage:
		return dto.ClaudeMediaMessage{}, "the image format could not be identified"
	}
	if _, ok := imageMediaTypes[mediaType]; ok {
		return dto.ClaudeMediaMessage{
			Type:   "image",
			Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: mediaType, Data: base64Data},
		}, ""
	}
	if strings.HasPrefix(mediaType, "image/") {
		return dto.ClaudeMediaMessage{}, fmt.Sprintf("Claude accepts only JPEG, PNG, GIF, and WebP images, not %q", mimeType)
	}
	return dto.ClaudeMediaMessage{}, fmt.Sprintf("Claude Messages cannot carry content of MIME type %q", mimeType)
}
