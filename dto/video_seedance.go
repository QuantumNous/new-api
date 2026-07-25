package dto

import (
	"errors"
	"strings"
)

// SeedanceVideoRequest models the Volcengine Ark "seedance" video-generation
// create body. It is the shared, provider-neutral request shape intended to be
// reused by every seedance-based channel (kuaizi today; doubao / blockrun video
// can adopt it next) so callers integrated against the official seedance API
// can point at new-api without reshaping their request. Each channel adaptor
// translates this into its own upstream wire format.
//
// Reference: POST /api/v3/contents/generations/tasks (Volcengine Ark).
type SeedanceVideoRequest struct {
	Model            string                `json:"model"`
	Content          []SeedanceContentItem `json:"content"`
	Resolution       string                `json:"resolution,omitempty"`
	Ratio            string                `json:"ratio,omitempty"`
	Duration         *int                  `json:"duration,omitempty"`
	Frames           *int                  `json:"frames,omitempty"`
	Seed             *int                  `json:"seed,omitempty"`
	Watermark        *bool                 `json:"watermark,omitempty"`
	CameraFixed      *bool                 `json:"camera_fixed,omitempty"`
	GenerateAudio    *bool                 `json:"generate_audio,omitempty"`
	ReturnLastFrame  *bool                 `json:"return_last_frame,omitempty"`
	CallbackURL      string                `json:"callback_url,omitempty"`
	SafetyIdentifier string                `json:"safety_identifier,omitempty"`
	Priority         *int                  `json:"priority,omitempty"`
}

// Seedance content[] item types.
const (
	SeedanceContentText  = "text"
	SeedanceContentImage = "image_url"
	SeedanceContentVideo = "video_url"
	SeedanceContentAudio = "audio_url"
)

// Seedance media roles.
const (
	SeedanceRoleFirstFrame     = "first_frame"
	SeedanceRoleLastFrame      = "last_frame"
	SeedanceRoleReferenceImage = "reference_image"
	SeedanceRoleReferenceVideo = "reference_video"
	SeedanceRoleReferenceAudio = "reference_audio"
)

// SeedanceURLObject is the {url} wrapper used by image_url/video_url/audio_url.
// `url` is omitempty so this type is marshal-equivalent to the channel structs
// aliased to it (e.g. doubao MediaURL), which omit an empty url upstream.
type SeedanceURLObject struct {
	URL string `json:"url,omitempty"`
}

// SeedanceContentItem is one element of the multimodal content[] array. Exactly
// one of Text/ImageURL/VideoURL/AudioURL is populated depending on Type.
// `type` is omitempty so this type stays marshal-equivalent to channel structs
// aliased to it (e.g. doubao ContentItem); omitempty is a no-op for inbound
// parsing, which is this type's primary use.
type SeedanceContentItem struct {
	Type     string             `json:"type,omitempty"`
	Text     string             `json:"text,omitempty"`
	ImageURL *SeedanceURLObject `json:"image_url,omitempty"`
	VideoURL *SeedanceURLObject `json:"video_url,omitempty"`
	AudioURL *SeedanceURLObject `json:"audio_url,omitempty"`
	Role     string             `json:"role,omitempty"`
}

// SeedanceMedia is a flattened URL+role pair extracted from content[].
type SeedanceMedia struct {
	URL  string
	Role string
}

// PromptText concatenates all text content items (newline-joined).
func (r *SeedanceVideoRequest) PromptText() string {
	parts := make([]string, 0, len(r.Content))
	for _, it := range r.Content {
		if it.Type == SeedanceContentText && strings.TrimSpace(it.Text) != "" {
			parts = append(parts, it.Text)
		}
	}
	return strings.Join(parts, "\n")
}

func (r *SeedanceVideoRequest) media(typ string, get func(SeedanceContentItem) *SeedanceURLObject) []SeedanceMedia {
	var out []SeedanceMedia
	for _, it := range r.Content {
		if it.Type != typ {
			continue
		}
		if u := get(it); u != nil && u.URL != "" {
			out = append(out, SeedanceMedia{URL: u.URL, Role: it.Role})
		}
	}
	return out
}

// Images returns the image_url items as URL+role pairs (order preserved).
func (r *SeedanceVideoRequest) Images() []SeedanceMedia {
	return r.media(SeedanceContentImage, func(it SeedanceContentItem) *SeedanceURLObject { return it.ImageURL })
}

// Videos returns the video_url items as URL+role pairs.
func (r *SeedanceVideoRequest) Videos() []SeedanceMedia {
	return r.media(SeedanceContentVideo, func(it SeedanceContentItem) *SeedanceURLObject { return it.VideoURL })
}

// Audios returns the audio_url items as URL+role pairs.
func (r *SeedanceVideoRequest) Audios() []SeedanceMedia {
	return r.media(SeedanceContentAudio, func(it SeedanceContentItem) *SeedanceURLObject { return it.AudioURL })
}

// HasFirstLastFrame reports whether any image carries a first/last-frame role,
// which channels use to switch into first-last-frame input mode.
func (r *SeedanceVideoRequest) HasFirstLastFrame() bool {
	for _, m := range r.Images() {
		if m.Role == SeedanceRoleFirstFrame || m.Role == SeedanceRoleLastFrame {
			return true
		}
	}
	return false
}

// Validate enforces the minimal seedance contract: a text prompt OR at least
// one image/video reference must be present.
func (r *SeedanceVideoRequest) Validate() error {
	if strings.TrimSpace(r.PromptText()) == "" && len(r.Images()) == 0 && len(r.Videos()) == 0 {
		return errors.New("seedance request requires a text prompt or at least one image/video")
	}
	return nil
}
