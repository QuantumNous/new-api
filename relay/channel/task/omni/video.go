package omni

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	rootcommon "github.com/QuantumNous/new-api/common"
	appI18n "github.com/QuantumNous/new-api/i18n"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/abema/go-mp4"
	"github.com/gin-gonic/gin"
)

const (
	MaxReferenceVideos  = 1
	MaxInlineVideoBytes = 64 * 1024 * 1024

	preparedReferenceVideoKey = "omni_prepared_reference_video"
)

type preparedReferenceVideo struct {
	Part            *inputPart
	DurationSeconds float64
}

type referenceVideoDurationError struct {
	DurationSeconds float64
	MaxSeconds      int
	Model           string
}

func (e *referenceVideoDurationError) Error() string {
	return fmt.Sprintf("reference video duration %.3f seconds exceeds the %d-second maximum for %s", e.DurationSeconds, e.MaxSeconds, e.Model)
}

func localizeReferenceVideoError(c *gin.Context, err error) error {
	var durationErr *referenceVideoDurationError
	if !errors.As(err, &durationErr) {
		return err
	}
	message := rootcommon.TranslateMessage(c, appI18n.MsgOmniReferenceVideoDurationExceeded, map[string]any{
		"Duration": fmt.Sprintf("%.3f", durationErr.DurationSeconds),
		"Max":      durationErr.MaxSeconds,
		"Model":    durationErr.Model,
	})
	if message == appI18n.MsgOmniReferenceVideoDurationExceeded {
		return err
	}
	return errors.New(message)
}

var supportedVideoMimeTypes = map[string]struct{}{
	"video/mp4":       {},
	"video/quicktime": {},
}

func prepareReferenceVideo(c *gin.Context, req relaycommon.TaskSubmitReq) (*preparedReferenceVideo, error) {
	if cached, ok := c.Get(preparedReferenceVideoKey); ok {
		if prepared, ok := cached.(*preparedReferenceVideo); ok {
			return prepared, nil
		}
	}

	values := make([]string, 0, len(req.Videos)+1)
	if value := strings.TrimSpace(req.Video); value != "" {
		values = append(values, value)
	}
	for _, value := range req.Videos {
		if value = strings.TrimSpace(value); value != "" {
			values = append(values, value)
		}
	}
	files := multipartVideoFiles(c)
	if len(values)+len(files) > MaxReferenceVideos {
		return nil, fmt.Errorf("videos must contain at most %d item for %s", MaxReferenceVideos, ModelGeminiOmniFlashPreview)
	}

	prepared := &preparedReferenceVideo{}
	if len(files) == 1 {
		part, duration, err := videoPartFromMultipart(files[0])
		if err != nil {
			return nil, fmt.Errorf("invalid reference video: %w", err)
		}
		prepared.Part = &part
		prepared.DurationSeconds = duration
	} else if len(values) == 1 {
		part, duration, err := videoPartFromString(values[0])
		if err != nil {
			return nil, fmt.Errorf("invalid reference video: %w", err)
		}
		prepared.Part = &part
		prepared.DurationSeconds = duration
	}
	c.Set(preparedReferenceVideoKey, prepared)
	return prepared, nil
}

func multipartVideoFiles(c *gin.Context) []*multipart.FileHeader {
	form, err := c.MultipartForm()
	if err != nil || form == nil {
		return nil
	}
	var files []*multipart.FileHeader
	for _, field := range []string{"video", "videos"} {
		files = append(files, form.File[field]...)
	}
	return files
}

func videoPartFromMultipart(fileHeader *multipart.FileHeader) (inputPart, float64, error) {
	if fileHeader == nil {
		return inputPart{}, 0, fmt.Errorf("file is required")
	}
	if fileHeader.Size <= 0 || fileHeader.Size > MaxInlineVideoBytes {
		return inputPart{}, 0, fmt.Errorf("file size must be between 1 and %d bytes", MaxInlineVideoBytes)
	}
	file, err := fileHeader.Open()
	if err != nil {
		return inputPart{}, 0, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, MaxInlineVideoBytes+1))
	if err != nil {
		return inputPart{}, 0, err
	}
	if len(data) == 0 || len(data) > MaxInlineVideoBytes {
		return inputPart{}, 0, fmt.Errorf("file size must be between 1 and %d bytes", MaxInlineVideoBytes)
	}
	mimeType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	return newVideoPart(mimeType, data, "")
}

func videoPartFromString(value string) (inputPart, float64, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return inputPart{}, 0, fmt.Errorf("video is required")
	}
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return videoPartFromURL(value)
	}
	if strings.HasPrefix(value, "data:") {
		comma := strings.Index(value, ",")
		if comma < 0 {
			return inputPart{}, 0, fmt.Errorf("invalid data URI")
		}
		metadata := value[len("data:"):comma]
		if !strings.HasSuffix(metadata, ";base64") {
			return inputPart{}, 0, fmt.Errorf("video data URI must use base64 encoding")
		}
		return newInlineVideoPart(strings.TrimSuffix(metadata, ";base64"), value[comma+1:])
	}
	return newInlineVideoPart("", value)
}

func videoPartFromURL(value string) (inputPart, float64, error) {
	response, err := service.DoDownloadRequest(value, "gemini_omni_reference_video")
	if err != nil {
		return inputPart{}, 0, fmt.Errorf("failed to download video: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return inputPart{}, 0, fmt.Errorf("failed to download video: HTTP %d", response.StatusCode)
	}
	if response.ContentLength > MaxInlineVideoBytes {
		return inputPart{}, 0, fmt.Errorf("file size exceeds maximum allowed size of %d bytes", MaxInlineVideoBytes)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, MaxInlineVideoBytes+1))
	if err != nil {
		return inputPart{}, 0, fmt.Errorf("failed to read video data: %w", err)
	}
	if len(data) == 0 || len(data) > MaxInlineVideoBytes {
		return inputPart{}, 0, fmt.Errorf("file size must be between 1 and %d bytes", MaxInlineVideoBytes)
	}
	return newVideoPart(response.Header.Get("Content-Type"), data, "")
}

func newInlineVideoPart(mimeType string, encoded string) (inputPart, float64, error) {
	encoded = strings.TrimSpace(encoded)
	if encoded == "" || base64.StdEncoding.DecodedLen(len(encoded)) > MaxInlineVideoBytes+2 {
		return inputPart{}, 0, fmt.Errorf("decoded video size must be between 1 and %d bytes", MaxInlineVideoBytes)
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return inputPart{}, 0, fmt.Errorf("invalid base64 video data")
	}
	if len(data) == 0 || len(data) > MaxInlineVideoBytes {
		return inputPart{}, 0, fmt.Errorf("decoded video size must be between 1 and %d bytes", MaxInlineVideoBytes)
	}
	return newVideoPart(mimeType, data, encoded)
}

func newVideoPart(mimeType string, data []byte, encoded string) (inputPart, float64, error) {
	mimeType = normalizeVideoMimeType(mimeType, data)
	if _, ok := supportedVideoMimeTypes[mimeType]; !ok {
		return inputPart{}, 0, fmt.Errorf("unsupported video MIME type %q; use MP4 or QuickTime", mimeType)
	}
	probe, err := mp4.Probe(bytes.NewReader(data))
	if err != nil {
		return inputPart{}, 0, fmt.Errorf("failed to read video duration: %w", err)
	}
	if probe.Timescale == 0 || probe.Duration == 0 {
		return inputPart{}, 0, fmt.Errorf("video duration is missing or invalid")
	}
	duration := float64(probe.Duration) / float64(probe.Timescale)
	if duration > MaxDurationSeconds {
		return inputPart{}, 0, &referenceVideoDurationError{
			DurationSeconds: duration,
			MaxSeconds:      MaxDurationSeconds,
			Model:           ModelGeminiOmniFlashPreview,
		}
	}
	if encoded == "" {
		encoded = base64.StdEncoding.EncodeToString(data)
	}

	return inputPart{
		Type:     "video",
		MimeType: mimeType,
		Data:     encoded,
	}, duration, nil
}

func normalizeVideoMimeType(mimeType string, data []byte) string {
	mimeType = strings.ToLower(strings.TrimSpace(strings.SplitN(mimeType, ";", 2)[0]))
	switch mimeType {
	case "video/mov":
		return "video/quicktime"
	case "video/x-m4v":
		return "video/mp4"
	case "", "application/octet-stream":
		return http.DetectContentType(data)
	default:
		return mimeType
	}
}
