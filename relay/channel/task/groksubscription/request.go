package groksubscription

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

type MediaReference struct {
	URL string `json:"url"`
}

type VoiceReference struct {
	VoiceID string `json:"voice_id"`
}

type VideoRequest struct {
	Model           string           `json:"model"`
	Action          string           `json:"action,omitempty"`
	Prompt          string           `json:"prompt"`
	Duration        *int             `json:"duration,omitempty"`
	AspectRatio     *string          `json:"aspect_ratio,omitempty"`
	Resolution      *string          `json:"resolution,omitempty"`
	Image           *MediaReference  `json:"image,omitempty"`
	Video           *MediaReference  `json:"video,omitempty"`
	ReferenceImages []MediaReference `json:"reference_images,omitempty"`
	ReferenceAudios []VoiceReference `json:"reference_audios,omitempty"`
}

type upstreamVideoRequest struct {
	Model           string           `json:"model"`
	Prompt          string           `json:"prompt"`
	Duration        *int             `json:"duration,omitempty"`
	AspectRatio     *string          `json:"aspect_ratio,omitempty"`
	Resolution      *string          `json:"resolution,omitempty"`
	Image           *MediaReference  `json:"image,omitempty"`
	Video           *MediaReference  `json:"video,omitempty"`
	ReferenceImages []MediaReference `json:"reference_images,omitempty"`
	ReferenceAudios []VoiceReference `json:"reference_audios,omitempty"`
}

func validateVideoRequest(c *gin.Context, info *relaycommon.RelayInfo) (*VideoRequest, error) {
	req, err := decodeVideoRequest(c)
	if err != nil {
		return nil, err
	}
	if err := normalizeAndValidateVideoRequest(req); err != nil {
		return nil, err
	}

	c.Set(videoRequestContextKey, req)
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	relaycommon.StoreTaskRequest(c, info, req.Action, synthesizeTaskSubmitReq(req))
	return req, nil
}

func getVideoRequest(c *gin.Context) (*VideoRequest, error) {
	if v, ok := c.Get(videoRequestContextKey); ok {
		if req, ok := v.(*VideoRequest); ok && req != nil {
			return req, nil
		}
	}
	return nil, fmt.Errorf("grok subscription video request not found in context")
}

func decodeVideoRequest(c *gin.Context) (*VideoRequest, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}

	var req VideoRequest
	err = common.DecodeJsonDisallowUnknownFields(storage, &req)
	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil && err == nil {
		err = seekErr
	}
	c.Request.Body = io.NopCloser(storage)
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func normalizeAndValidateVideoRequest(req *VideoRequest) error {
	req.Model = strings.TrimSpace(req.Model)
	req.Action = strings.TrimSpace(req.Action)
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Action == "" {
		req.Action = actionGenerate
	}

	if !isSupportedModel(req.Model) {
		return fmt.Errorf("unsupported model %q", req.Model)
	}
	switch req.Action {
	case actionGenerate:
		return validateGenerateRequest(req)
	case actionEdit:
		return validateEditRequest(req)
	case actionExtend:
		return validateExtendRequest(req)
	default:
		return fmt.Errorf("unsupported action %q", req.Action)
	}
}

func validateGenerateRequest(req *VideoRequest) error {
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if req.Video != nil {
		return fmt.Errorf("video is not allowed for generate")
	}
	if req.Image != nil && (len(req.ReferenceImages) > 0 || len(req.ReferenceAudios) > 0) {
		return fmt.Errorf("image is mutually exclusive with references")
	}
	if len(req.ReferenceImages) > 7 {
		return fmt.Errorf("at most 7 reference_images are supported")
	}
	if len(req.ReferenceAudios) > 3 {
		return fmt.Errorf("at most 3 reference_audios are supported")
	}
	if req.Model == ModelGrokImagineVideo && len(req.ReferenceAudios) > 0 {
		return fmt.Errorf("%s does not support reference_audios", ModelGrokImagineVideo)
	}
	if err := validateDurationPointer(&req.Duration, defaultGenerateDuration, 1, 15); err != nil {
		return err
	}
	if err := validateAspectRatio(req.AspectRatio); err != nil {
		return err
	}
	if err := validateGenerateResolution(req); err != nil {
		return err
	}
	if req.Image != nil {
		if err := validateImageReference(*req.Image); err != nil {
			return err
		}
	}
	for _, ref := range req.ReferenceImages {
		if err := validateImageReference(ref); err != nil {
			return err
		}
	}
	for _, ref := range req.ReferenceAudios {
		if strings.TrimSpace(ref.VoiceID) == "" {
			return fmt.Errorf("voice_id is required")
		}
	}
	return nil
}

func validateEditRequest(req *VideoRequest) error {
	if req.Model != ModelGrokImagineVideo {
		return fmt.Errorf("edit is only supported by %s", ModelGrokImagineVideo)
	}
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if req.Video == nil {
		return fmt.Errorf("video is required")
	}
	if err := rejectEditExtendGenerateFields(req); err != nil {
		return err
	}
	if req.Duration != nil {
		return fmt.Errorf("duration is not allowed for edit")
	}
	return validateVideoReference(*req.Video)
}

func validateExtendRequest(req *VideoRequest) error {
	if req.Model != ModelGrokImagineVideo {
		return fmt.Errorf("extend is only supported by %s", ModelGrokImagineVideo)
	}
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if req.Video == nil {
		return fmt.Errorf("video is required")
	}
	if err := rejectEditExtendGenerateFields(req); err != nil {
		return err
	}
	if err := validateDurationPointer(&req.Duration, defaultExtendDuration, 2, 10); err != nil {
		return err
	}
	return validateVideoReference(*req.Video)
}

func rejectEditExtendGenerateFields(req *VideoRequest) error {
	if req.Image != nil {
		return fmt.Errorf("image is not allowed for %s", req.Action)
	}
	if len(req.ReferenceImages) > 0 || len(req.ReferenceAudios) > 0 {
		return fmt.Errorf("references are not allowed for %s", req.Action)
	}
	if req.AspectRatio != nil {
		return fmt.Errorf("aspect_ratio is not allowed for %s", req.Action)
	}
	if req.Resolution != nil {
		return fmt.Errorf("resolution is not allowed for %s", req.Action)
	}
	return nil
}

func validateDurationPointer(duration **int, defaultValue, minValue, maxValue int) error {
	if *duration == nil {
		v := defaultValue
		*duration = &v
		return nil
	}
	if **duration < minValue || **duration > maxValue {
		return fmt.Errorf("duration must be between %d and %d", minValue, maxValue)
	}
	return nil
}

func validateAspectRatio(ratio *string) error {
	if ratio == nil {
		return nil
	}
	switch *ratio {
	case "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3":
		return nil
	default:
		return fmt.Errorf("unsupported aspect_ratio %q", *ratio)
	}
}

func validateGenerateResolution(req *VideoRequest) error {
	if req.Resolution == nil {
		return nil
	}
	switch *req.Resolution {
	case "480p", "720p", "1080p":
	default:
		return fmt.Errorf("unsupported resolution %q", *req.Resolution)
	}
	if req.Model == ModelGrokImagineVideo && *req.Resolution == "1080p" {
		return fmt.Errorf("%s does not support 1080p", ModelGrokImagineVideo)
	}
	if req.Model == ModelGrokImagineVideo15 && *req.Resolution == "1080p" && (len(req.ReferenceImages) > 0 || len(req.ReferenceAudios) > 0) {
		return fmt.Errorf("%s reference generation does not support 1080p", ModelGrokImagineVideo15)
	}
	return nil
}

func validateImageReference(ref MediaReference) error {
	return validateMediaURL(ref.URL, "image", map[string]struct{}{
		"image/jpeg": {},
		"image/png":  {},
	})
}

func validateVideoReference(ref MediaReference) error {
	return validateMediaURL(ref.URL, "video", map[string]struct{}{
		"video/mp4": {},
	})
}

func validateMediaURL(raw, mediaKind string, allowedDataMIMEs map[string]struct{}) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fmt.Errorf("%s url is required", mediaKind)
	}
	if raw != trimmed {
		return fmt.Errorf("%s url must not include leading or trailing whitespace", mediaKind)
	}
	if strings.HasPrefix(trimmed, "data:") {
		return validateDataURI(trimmed, mediaKind, allowedDataMIMEs)
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("%s url is invalid", mediaKind)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("%s url must use https or base64 data URI", mediaKind)
	}
	return nil
}

func validateDataURI(raw, mediaKind string, allowedMIMEs map[string]struct{}) error {
	header, encoded, ok := strings.Cut(raw, ",")
	if !ok || encoded == "" {
		return fmt.Errorf("%s data URI is malformed", mediaKind)
	}
	if !strings.HasSuffix(header, ";base64") {
		return fmt.Errorf("%s data URI must be base64", mediaKind)
	}
	mimeType := strings.TrimPrefix(strings.TrimSuffix(header, ";base64"), "data:")
	if _, ok := allowedMIMEs[mimeType]; !ok {
		return fmt.Errorf("%s data URI MIME type is unsupported", mediaKind)
	}
	if _, err := base64.StdEncoding.DecodeString(encoded); err != nil {
		return fmt.Errorf("%s data URI base64 is malformed", mediaKind)
	}
	return nil
}

func isSupportedModel(model string) bool {
	switch model {
	case ModelGrokImagineVideo, ModelGrokImagineVideo15:
		return true
	default:
		return false
	}
}

func synthesizeTaskSubmitReq(req *VideoRequest) relaycommon.TaskSubmitReq {
	taskReq := relaycommon.TaskSubmitReq{
		Model:      req.Model,
		Prompt:     req.Prompt,
		Resolution: stringValue(req.Resolution),
		Ratio:      stringValue(req.AspectRatio),
	}
	if req.Duration != nil {
		taskReq.Duration = *req.Duration
	}
	if req.Image != nil {
		taskReq.Image = req.Image.URL
		taskReq.Images = []string{req.Image.URL}
	}
	for _, ref := range req.ReferenceImages {
		taskReq.Images = append(taskReq.Images, ref.URL)
	}
	if req.Video != nil {
		taskReq.InputReference = req.Video.URL
	}
	return taskReq
}

func stringValue(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func buildUpstreamVideoRequest(req *VideoRequest) upstreamVideoRequest {
	body := upstreamVideoRequest{
		Model:  req.Model,
		Prompt: req.Prompt,
	}
	switch req.Action {
	case actionGenerate:
		body.Duration = req.Duration
		body.AspectRatio = req.AspectRatio
		body.Resolution = req.Resolution
		body.Image = req.Image
		body.ReferenceImages = req.ReferenceImages
		body.ReferenceAudios = req.ReferenceAudios
	case actionEdit:
		body.Video = req.Video
	case actionExtend:
		body.Duration = req.Duration
		body.Video = req.Video
	}
	return body
}
