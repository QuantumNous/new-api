package blockrunseedance

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// createRequest is the body of POST /v1/videos/generations. Optional scalars use
// pointers + omitempty so an explicit false/0 still reaches the gateway and an
// unset field is omitted (CLAUDE.md Rule 5).
type createRequest struct {
	// Prompt is always sent (no omitempty) to match the upstream client, which
	// always includes a "prompt" key — even for an image-only request where the
	// prompt is empty (FIX #9).
	Prompt          string `json:"prompt"`
	Model           string `json:"model"`
	ImageURL        string `json:"image_url,omitempty"`
	RealFaceAssetID string `json:"real_face_asset_id,omitempty"`
	DurationSeconds *int   `json:"duration_seconds,omitempty"`
	Resolution      string `json:"resolution,omitempty"`
	AspectRatio     string `json:"aspect_ratio,omitempty"`
	GenerateAudio   *bool  `json:"generate_audio,omitempty"`
	Seed            *int   `json:"seed,omitempty"`
	Watermark       *bool  `json:"watermark,omitempty"`
	ReturnLastFrame *bool  `json:"return_last_frame,omitempty"`
}

// blockrunExtensions are non-official seedance fields a client may set to drive
// BlockRun-specific features. Pure seedance callers simply omit them.
type blockrunExtensions struct {
	RealFaceAssetID string `json:"real_face_asset_id"`
}

// buildBlockrunSeedanceCreateRequest maps the shared seedance content[] request
// (plus BlockRun extensions) onto the gateway body. Pure function (no gin/IO).
// upstreamModelID is the already-resolved upstream model id.
func buildBlockrunSeedanceCreateRequest(seed *dto.SeedanceVideoRequest, ext blockrunExtensions, upstreamModelID string) createRequest {
	body := createRequest{
		Prompt:          seed.PromptText(),
		Model:           upstreamModelID,
		DurationSeconds: seed.Duration,
		Resolution:      seed.Resolution,
		AspectRatio:     seed.Ratio, // inbound seedance "ratio" -> upstream "aspect_ratio"
		GenerateAudio:   seed.GenerateAudio,
		Seed:            seed.Seed,
		Watermark:       seed.Watermark,
		ReturnLastFrame: seed.ReturnLastFrame,
		RealFaceAssetID: ext.RealFaceAssetID,
	}
	// Image-to-video: first image_url wins (the gateway takes a single seed image).
	if imgs := seed.Images(); len(imgs) > 0 {
		body.ImageURL = imgs[0].URL
	}
	return body
}

// supportedResolutions is the set of top-level resolutions this channel accepts
// (case-insensitive; "" = model default). Anything else fails fast at submit.
var supportedResolutions = map[string]bool{
	"360p":  true,
	"480p":  true,
	"540p":  true,
	"720p":  true,
	"1080p": true,
	"1k":    true,
	"2k":    true,
	"4k":    true,
}

// validateResolution rejects a resolution the channel can't honor, failing fast
// at submit time instead of surfacing an upstream error later. "" (model
// default) is allowed; matching is case-insensitive.
func validateResolution(r string) error {
	if r == "" || supportedResolutions[strings.ToLower(r)] {
		return nil
	}
	return fmt.Errorf("unsupported resolution %q; supported: 360p / 480p / 540p / 720p / 1080p / 1K / 2K / 4K", r)
}

// validateSeedanceValues fails fast on value-domain violations so an upstream
// 4xx never burns a pre-charge. pseudoModel is the client-facing model name.
func validateSeedanceValues(seed *dto.SeedanceVideoRequest, ext blockrunExtensions, pseudoModel string) error {
	// BlockRun Seedance only supports text-to-video and single-image-to-video.
	// Reject any input mode this channel cannot serve before the asset block.
	if len(seed.Videos()) > 0 {
		return fmt.Errorf("video input is not supported by this channel")
	}
	if len(seed.Audios()) > 0 {
		return fmt.Errorf("audio input is not supported by this channel")
	}
	if len(seed.Images()) > 1 {
		return fmt.Errorf("only a single seed image is supported")
	}
	if seed.HasFirstLastFrame() {
		return fmt.Errorf("first_frame/last_frame image roles are not supported")
	}
	if err := validateResolution(seed.Resolution); err != nil {
		return err
	}
	if ext.RealFaceAssetID != "" {
		if !strings.HasPrefix(ext.RealFaceAssetID, "ta_") {
			return fmt.Errorf("real_face_asset_id must start with 'ta_'")
		}
		if !supportsRealFaceAsset(pseudoModel) {
			return fmt.Errorf("real_face_asset_id is only supported on seedance-2.0 / seedance-2.0-fast")
		}
		if len(seed.Images()) > 0 {
			return fmt.Errorf("image input and real_face_asset_id are mutually exclusive")
		}
	}
	return nil
}

// droppedSeedanceFields lists seedance-official fields the BlockRun upstream does
// not support; logged under DEBUG so operators see why a param had no effect.
func droppedSeedanceFields(r *dto.SeedanceVideoRequest) []string {
	var dropped []string
	if r.CameraFixed != nil {
		dropped = append(dropped, "camera_fixed")
	}
	if r.Frames != nil {
		dropped = append(dropped, "frames")
	}
	if r.CallbackURL != "" {
		dropped = append(dropped, "callback_url")
	}
	return dropped
}

// debugLogDropped logs dropped fields when DEBUG is on (kept tiny for reuse).
func debugLogDropped(r *dto.SeedanceVideoRequest) {
	if common.DebugEnabled {
		if d := droppedSeedanceFields(r); len(d) > 0 {
			common.SysLog(fmt.Sprintf("[blockrun-seedance] ignoring unsupported seedance fields: %s", strings.Join(d, ", ")))
		}
	}
}
