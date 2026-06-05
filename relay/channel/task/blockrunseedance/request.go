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
	Prompt          string `json:"prompt,omitempty"`
	Model           string `json:"model"`
	ImageURL        string `json:"image_url,omitempty"`
	RealFaceAssetID string `json:"real_face_asset_id,omitempty"`
	DurationSeconds *int   `json:"duration_seconds,omitempty"`
	Resolution      string `json:"resolution,omitempty"`
	GenerateAudio   *bool  `json:"generate_audio,omitempty"`
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
		GenerateAudio:   seed.GenerateAudio,
		RealFaceAssetID: ext.RealFaceAssetID,
	}
	// Image-to-video: first image_url wins (the gateway takes a single seed image).
	if imgs := seed.Images(); len(imgs) > 0 {
		body.ImageURL = imgs[0].URL
	}
	return body
}

// validateSeedanceValues fails fast on value-domain violations so an upstream
// 4xx never burns a pre-charge. pseudoModel is the client-facing model name.
func validateSeedanceValues(seed *dto.SeedanceVideoRequest, ext blockrunExtensions, pseudoModel string) error {
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
	if r.Seed != nil {
		dropped = append(dropped, "seed")
	}
	if r.Watermark != nil {
		dropped = append(dropped, "watermark")
	}
	if r.Ratio != "" {
		dropped = append(dropped, "ratio")
	}
	if r.ReturnLastFrame != nil {
		dropped = append(dropped, "return_last_frame")
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
