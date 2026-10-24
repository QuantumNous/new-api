package gemini

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

var videoMetadataKeyAliases = map[string]string{
	"start_offset": "startOffset",
	"end_offset":   "endOffset",
	"startOffset":  "startOffset",
	"endOffset":    "endOffset",
	"fps":          "fps",
}

// BuildGeminiPartFromOpenAIFile converts a Chat Completions type:file object into
// a Gemini part. Prefer file_data when present so an OpenAI Files API id
// (file-xxx) paired with inline bytes does not send the id to the media
// resolver. URI-shaped file_id values may be forwarded as fileData.fileUri when
// allowRemoteFileURI is true (Vertex); otherwise http(s) sources are downloaded
// into inlineData. Bare OpenAI Files API ids without file_data are rejected.
func BuildGeminiPartFromOpenAIFile(ctx context.Context, file *dto.MessageFile, allowRemoteFileURI bool) (dto.GeminiPart, error) {
	if file == nil {
		return dto.GeminiPart{}, fmt.Errorf("messages[].content[].file is required")
	}

	passed := strings.TrimSpace(file.FileData)
	if passed == "" {
		passed = strings.TrimSpace(file.FileId)
	}
	if passed == "" {
		return dto.GeminiPart{}, fmt.Errorf("messages[].content[].file requires file_id or file_data")
	}

	if isOpenAIFilesAPIID(passed) {
		return dto.GeminiPart{}, fmt.Errorf("messages[].content[].file.file_id %q is an OpenAI Files API id; resolve it to file_data or a media URI before Gemini conversion", passed)
	}

	mimeType := strings.TrimSpace(file.Format)
	if mimeType == "" {
		mimeType = mimeTypeFromMediaRef(passed)
	}
	mimeType = strings.ToLower(mimeType)

	part := dto.GeminiPart{}
	switch {
	case strings.HasPrefix(passed, "gs://"),
		isGeminiFilesAPIURL(passed),
		allowRemoteFileURI && strings.HasPrefix(passed, "https://") && mimeType != "":
		if mimeType == "" {
			return dto.GeminiPart{}, fmt.Errorf("messages[].content[].file: cannot infer mime type for file_uri %q; set format", passed)
		}
		if _, ok := SupportedMimeTypes[mimeType]; !ok {
			return dto.GeminiPart{}, fmt.Errorf("mime type is not supported by Gemini: %q, url: %q, supported types are: %v", mimeType, passed, SupportedMimeTypesList())
		}
		part.FileData = &dto.GeminiFileData{MimeType: mimeType, FileUri: passed}
	default:
		source := types.NewFileSourceFromData(passed, mimeType)
		base64Data, resolvedMIME, err := relaymedia.ResolveBase64Data(ctx, source, "formatting file for Gemini")
		if err != nil {
			return dto.GeminiPart{}, fmt.Errorf("get file data from %q failed: %w", source.GetIdentifier(), err)
		}
		if mimeType == "" {
			mimeType = strings.ToLower(resolvedMIME)
		}
		if mimeType == "" {
			return dto.GeminiPart{}, fmt.Errorf("messages[].content[].file: cannot infer mime type for %q; set format", passed)
		}
		if _, ok := SupportedMimeTypes[mimeType]; !ok {
			return dto.GeminiPart{}, fmt.Errorf("mime type is not supported by Gemini: %q, url: %q, supported types are: %v", mimeType, passed, SupportedMimeTypesList())
		}
		part.InlineData = &dto.GeminiInlineData{MimeType: mimeType, Data: base64Data}
	}

	if mediaResolution, err := mediaResolutionFromDetail(file.Detail); err != nil {
		return dto.GeminiPart{}, err
	} else if len(mediaResolution) > 0 {
		part.MediaResolution = mediaResolution
	}
	if videoMetadata, err := normalizeVideoMetadata(file.VideoMetadata); err != nil {
		return dto.GeminiPart{}, err
	} else if len(videoMetadata) > 0 {
		part.VideoMetadata = videoMetadata
	}
	return part, nil
}

func isOpenAIFilesAPIID(s string) bool {
	s = strings.TrimSpace(s)
	return strings.HasPrefix(s, "file-") && !dto.IsRemoteMediaURI(s)
}

func isGeminiFilesAPIURL(s string) bool {
	lower := strings.ToLower(s)
	return strings.Contains(lower, "generativelanguage.googleapis.com/") && strings.Contains(lower, "/files/")
}

func mimeTypeFromMediaRef(ref string) string {
	ref = strings.TrimSpace(ref)
	if strings.HasPrefix(ref, "data:") {
		header, _, ok := strings.Cut(ref, ";")
		if !ok {
			header, _, _ = strings.Cut(ref, ",")
		}
		if mime, ok := strings.CutPrefix(header, "data:"); ok {
			return strings.ToLower(strings.TrimSpace(mime))
		}
		return ""
	}
	pathName := ref
	if u, err := url.Parse(ref); err == nil && u.Path != "" {
		pathName = u.Path
	}
	ext := strings.ToLower(path.Ext(pathName))
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".mov":
		return "video/mov"
	case ".mpeg", ".mpg":
		return "video/mpeg"
	case ".avi":
		return "video/avi"
	case ".wmv":
		return "video/wmv"
	case ".flv":
		return "video/flv"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".heic":
		return "image/heic"
	case ".heif":
		return "image/heif"
	case ".mp3":
		return "audio/mp3"
	case ".wav":
		return "audio/wav"
	case ".pdf":
		return "application/pdf"
	case ".txt":
		return "text/plain"
	default:
		return ""
	}
}

func mediaResolutionFromDetail(detail string) ([]byte, error) {
	switch strings.ToLower(strings.TrimSpace(detail)) {
	case "":
		return nil, nil
	case "high":
		return kitutil.Marshal(map[string]string{"level": "MEDIA_RESOLUTION_HIGH"})
	case "low":
		return kitutil.Marshal(map[string]string{"level": "MEDIA_RESOLUTION_LOW"})
	case "medium":
		return kitutil.Marshal(map[string]string{"level": "MEDIA_RESOLUTION_MEDIUM"})
	case "auto":
		return nil, nil
	default:
		return nil, fmt.Errorf("messages[].content[].file.detail %q is not supported; use high, low, medium, or auto", detail)
	}
}

func normalizeVideoMetadata(raw []byte) ([]byte, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var incoming map[string]any
	if err := kitutil.Unmarshal(raw, &incoming); err != nil {
		return nil, fmt.Errorf("messages[].content[].file.video_metadata must be an object: %w", err)
	}
	if len(incoming) == 0 {
		return nil, nil
	}
	out := make(map[string]any, len(incoming))
	for key, value := range incoming {
		if canonical, ok := videoMetadataKeyAliases[key]; ok {
			out[canonical] = value
			continue
		}
		out[key] = value
	}
	encoded, err := kitutil.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("messages[].content[].file.video_metadata encode failed: %w", err)
	}
	return encoded, nil
}
