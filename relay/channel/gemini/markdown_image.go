package gemini

import (
	"encoding/base64"
	"io"
	"mime"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const markdownDataImagePrefix = "data:image/"

type geminiMarkdownSegment struct {
	text     string
	mimeType string
	data     string
}

// normalizeGeminiMarkdownImages converts upstream Markdown data images into
// Gemini inlineData parts while preserving unrelated and unknown JSON fields.
func normalizeGeminiMarkdownImages(data []byte) ([]byte, bool, error) {
	var response map[string]any
	if err := common.Unmarshal(data, &response); err != nil {
		return nil, false, err
	}

	candidates, ok := response["candidates"].([]any)
	if !ok {
		return data, false, nil
	}

	changed := false
	for _, candidateValue := range candidates {
		candidate, ok := candidateValue.(map[string]any)
		if !ok {
			continue
		}
		content, ok := candidate["content"].(map[string]any)
		if !ok {
			continue
		}
		parts, ok := content["parts"].([]any)
		if !ok {
			continue
		}

		contentChanged := false
		normalizedParts := make([]any, 0, len(parts))
		for _, partValue := range parts {
			part, ok := partValue.(map[string]any)
			if !ok {
				normalizedParts = append(normalizedParts, partValue)
				continue
			}
			text, ok := part["text"].(string)
			if !ok {
				normalizedParts = append(normalizedParts, partValue)
				continue
			}

			segments, found := splitGeminiMarkdownImages(text)
			if !found {
				normalizedParts = append(normalizedParts, partValue)
				continue
			}

			changed = true
			contentChanged = true
			for _, segment := range segments {
				normalizedPart := cloneGeminiPart(part)
				if segment.mimeType == "" {
					normalizedPart["text"] = segment.text
					delete(normalizedPart, "inlineData")
					delete(normalizedPart, "inline_data")
				} else {
					delete(normalizedPart, "text")
					delete(normalizedPart, "inline_data")
					normalizedPart["inlineData"] = map[string]any{
						"mimeType": segment.mimeType,
						"data":     segment.data,
					}
				}
				normalizedParts = append(normalizedParts, normalizedPart)
			}
		}
		if contentChanged {
			content["parts"] = normalizedParts
		}
	}

	if !changed {
		return data, false, nil
	}
	normalized, err := common.Marshal(response)
	if err != nil {
		return nil, false, err
	}
	return normalized, true, nil
}

func splitGeminiMarkdownImages(text string) ([]geminiMarkdownSegment, bool) {
	segments := make([]geminiMarkdownSegment, 0, 3)
	last := 0
	searchFrom := 0
	found := false

	for searchFrom < len(text) {
		startOffset := strings.Index(text[searchFrom:], "![")
		if startOffset < 0 {
			break
		}
		start := searchFrom + startOffset
		labelEndOffset := strings.Index(text[start+2:], "](")
		if labelEndOffset < 0 {
			break
		}
		uriStart := start + 2 + labelEndOffset + 2
		if !strings.HasPrefix(text[uriStart:], markdownDataImagePrefix) {
			searchFrom = start + 2
			continue
		}

		commaOffset := strings.IndexByte(text[uriStart:], ',')
		if commaOffset < 0 {
			break
		}
		comma := uriStart + commaOffset
		metadata := text[uriStart+len("data:") : comma]
		encodingSeparator := strings.LastIndexByte(metadata, ';')
		if encodingSeparator < 0 || !strings.EqualFold(metadata[encodingSeparator+1:], "base64") {
			searchFrom = start + 2
			continue
		}

		mediaType, _, err := mime.ParseMediaType(metadata[:encodingSeparator])
		if err != nil || !strings.HasPrefix(strings.ToLower(mediaType), "image/") {
			searchFrom = start + 2
			continue
		}

		dataStart := comma + 1
		closeOffset := strings.IndexByte(text[dataStart:], ')')
		if closeOffset < 0 {
			break
		}
		close := dataStart + closeOffset
		imageData := text[dataStart:close]
		if imageData == "" || !validGeminiImageBase64(imageData) {
			searchFrom = start + 2
			continue
		}

		if start > last {
			segments = append(segments, geminiMarkdownSegment{text: text[last:start]})
		}
		segments = append(segments, geminiMarkdownSegment{
			mimeType: mediaType,
			data:     imageData,
		})
		found = true
		last = close + 1
		searchFrom = last
	}

	if !found {
		return nil, false
	}
	if last < len(text) {
		segments = append(segments, geminiMarkdownSegment{text: text[last:]})
	}
	return segments, true
}

func validGeminiImageBase64(data string) bool {
	decoder := base64.NewDecoder(base64.StdEncoding.Strict(), strings.NewReader(data))
	_, err := io.Copy(io.Discard, decoder)
	if err == nil {
		return true
	}
	if len(data)%4 == 0 {
		return false
	}
	decoder = base64.NewDecoder(base64.RawStdEncoding.Strict(), strings.NewReader(data))
	_, err = io.Copy(io.Discard, decoder)
	return err == nil
}

func cloneGeminiPart(part map[string]any) map[string]any {
	clone := make(map[string]any, len(part)+1)
	for key, value := range part {
		clone[key] = value
	}
	return clone
}
