package ali

import (
	"errors"
	"fmt"
	"mime"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const happyHorseRequestContextKey = "ali_happyhorse_request"

// HappyHorseRequest is the official JSON request shape accepted by the
// HappyHorse video models. It intentionally does not model the legacy flat or
// multipart Ali task request formats.
type HappyHorseRequest struct {
	Model      string               `json:"model"`
	Input      HappyHorseInput      `json:"input"`
	Parameters HappyHorseParameters `json:"parameters"`
}

type HappyHorseInput struct {
	Prompt string            `json:"prompt,omitempty"`
	Media  []HappyHorseMedia `json:"media,omitempty"`
}

type HappyHorseMedia struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

// HappyHorseParameters preserves explicit zero and false values when the
// request is forwarded upstream.
type HappyHorseParameters struct {
	Resolution   *string `json:"resolution,omitempty"`
	Ratio        *string `json:"ratio,omitempty"`
	Duration     *int    `json:"duration,omitempty"`
	Seed         *int    `json:"seed,omitempty"`
	Watermark    *bool   `json:"watermark,omitempty"`
	AudioSetting *string `json:"audio_setting,omitempty"`
}

func (r *HappyHorseRequest) Validate() error {
	if r.Parameters.Resolution != nil && *r.Parameters.Resolution != "720P" && *r.Parameters.Resolution != "1080P" {
		return errors.New("parameters.resolution must be 720P or 1080P")
	}
	if r.Parameters.Seed != nil && (*r.Parameters.Seed < 0 || *r.Parameters.Seed > 2147483647) {
		return errors.New("parameters.seed must be between 0 and 2147483647")
	}
	for i, media := range r.Input.Media {
		if media.URL == "" {
			return fmt.Errorf("input.media[%d].url is required", i)
		}
	}

	switch r.Model {
	case "happyhorse-1.1-t2v":
		return r.validateT2V()
	case "happyhorse-1.1-i2v":
		return r.validateI2V()
	case "happyhorse-1.1-r2v":
		return r.validateR2V()
	case "happyhorse-1.0-video-edit":
		return r.validateVideoEdit()
	default:
		return fmt.Errorf("unsupported model %q", r.Model)
	}
}

func (r *HappyHorseRequest) validateT2V() error {
	if strings.TrimSpace(r.Input.Prompt) == "" {
		return errors.New("input.prompt is required for happyhorse-1.1-t2v")
	}
	if len(r.Input.Media) != 0 {
		return errors.New("input.media is not supported for happyhorse-1.1-t2v")
	}
	if r.Parameters.AudioSetting != nil {
		return errors.New("parameters.audio_setting is not supported for happyhorse-1.1-t2v")
	}
	if r.Parameters.Duration == nil || *r.Parameters.Duration <= 0 {
		return errors.New("parameters.duration must be greater than 0 for happyhorse-1.1-t2v")
	}
	return r.validateRatio()
}

func (r *HappyHorseRequest) validateI2V() error {
	if len(r.Input.Media) != 1 || r.Input.Media[0].Type != "first_frame" || !isHappyHorseImageURL(r.Input.Media[0].URL) {
		return errors.New("happyhorse-1.1-i2v requires exactly one first_frame image")
	}
	if r.Parameters.Ratio != nil {
		return errors.New("parameters.ratio is not supported for happyhorse-1.1-i2v")
	}
	if r.Parameters.AudioSetting != nil {
		return errors.New("parameters.audio_setting is not supported for happyhorse-1.1-i2v")
	}
	return r.validateOptionalDuration()
}

func (r *HappyHorseRequest) validateR2V() error {
	if strings.TrimSpace(r.Input.Prompt) == "" {
		return errors.New("input.prompt is required for happyhorse-1.1-r2v")
	}
	if len(r.Input.Media) < 1 || len(r.Input.Media) > 9 {
		return errors.New("happyhorse-1.1-r2v requires 1 to 9 reference_image items")
	}
	for _, media := range r.Input.Media {
		if media.Type != "reference_image" || !isHappyHorseImageURL(media.URL) {
			return errors.New("happyhorse-1.1-r2v accepts only reference_image items")
		}
	}
	if r.Parameters.AudioSetting != nil {
		return errors.New("parameters.audio_setting is not supported for happyhorse-1.1-r2v")
	}
	if err := r.validateOptionalDuration(); err != nil {
		return err
	}
	return r.validateRatio()
}

func (r *HappyHorseRequest) validateVideoEdit() error {
	if strings.TrimSpace(r.Input.Prompt) == "" {
		return errors.New("input.prompt is required for happyhorse-1.0-video-edit")
	}
	videoCount := 0
	referenceImageCount := 0
	for _, media := range r.Input.Media {
		switch media.Type {
		case "video":
			videoCount++
			if !isHappyHorseHTTPURL(media.URL) {
				return errors.New("video URL must use HTTP or HTTPS")
			}
		case "reference_image":
			referenceImageCount++
			if !isHappyHorseImageURL(media.URL) {
				return errors.New("reference_image URL must use HTTP, HTTPS, or data:image")
			}
		default:
			return errors.New("happyhorse-1.0-video-edit accepts only video and reference_image items")
		}
	}
	if videoCount != 1 || referenceImageCount > 5 {
		return errors.New("happyhorse-1.0-video-edit requires exactly one video and at most 5 reference_image items")
	}
	if r.Parameters.Ratio != nil {
		return errors.New("parameters.ratio is not supported for happyhorse-1.0-video-edit")
	}
	if r.Parameters.AudioSetting != nil && *r.Parameters.AudioSetting != "auto" && *r.Parameters.AudioSetting != "origin" {
		return errors.New("parameters.audio_setting must be auto or origin")
	}
	if r.Parameters.Duration != nil {
		return errors.New("parameters.duration is not supported for happyhorse-1.0-video-edit")
	}
	return nil
}

func (r *HappyHorseRequest) validateOptionalDuration() error {
	if r.Parameters.Duration != nil && (*r.Parameters.Duration < 3 || *r.Parameters.Duration > 15) {
		return errors.New("parameters.duration must be between 3 and 15")
	}
	return nil
}

// ReservationSeconds returns the duration used to reserve quota for the
// exact HappyHorse model in the request.
func (r *HappyHorseRequest) ReservationSeconds() (int, error) {
	switch r.Model {
	case "happyhorse-1.1-t2v":
		if r.Parameters.Duration == nil {
			return 0, errors.New("parameters.duration is required for happyhorse-1.1-t2v")
		}
		return *r.Parameters.Duration, nil
	case "happyhorse-1.1-i2v", "happyhorse-1.1-r2v":
		if r.Parameters.Duration == nil {
			return 5, nil
		}
		return *r.Parameters.Duration, nil
	case "happyhorse-1.0-video-edit":
		return 30, nil
	default:
		return 0, fmt.Errorf("unsupported model %q", r.Model)
	}
}

func (r *HappyHorseRequest) validateRatio() error {
	if r.Parameters.Ratio == nil {
		return nil
	}
	switch *r.Parameters.Ratio {
	case "16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4", "9:21", "21:9":
		return nil
	default:
		return errors.New("parameters.ratio is unsupported")
	}
}

func isHappyHorseImageURL(value string) bool {
	return isHappyHorseHTTPURL(value) || strings.HasPrefix(value, "data:image/")
}

func isHappyHorseHTTPURL(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

// BindHappyHorseRequest accepts only the official application/json request
// shape, validates its nested input, and caches it for later adaptor stages.
func BindHappyHorseRequest(c *gin.Context) (*HappyHorseRequest, error) {
	return bindHappyHorseRequest(c, "")
}

func bindHappyHorseRequest(c *gin.Context, mappedModel string) (*HappyHorseRequest, error) {
	contentType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || !strings.EqualFold(contentType, gin.MIMEJSON) {
		return nil, errors.New("Content-Type must be application/json")
	}

	var req HappyHorseRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if mappedModel != "" {
		req.Model = mappedModel
	}
	if err := req.Validate(); err != nil {
		return nil, err
	}
	c.Set(happyHorseRequestContextKey, &req)
	return &req, nil
}

func getHappyHorseRequestForModel(c *gin.Context, mappedModel string) (*HappyHorseRequest, error) {
	if value, ok := c.Get(happyHorseRequestContextKey); ok {
		if req, ok := value.(*HappyHorseRequest); ok && req != nil {
			req.Model = mappedModel
			if err := req.Validate(); err != nil {
				return nil, err
			}
			return req, nil
		}
	}
	return bindHappyHorseRequest(c, mappedModel)
}

// GetHappyHorseRequest returns the request cached by BindHappyHorseRequest. If
// binding has not happened yet, it binds and caches the reusable request body.
func GetHappyHorseRequest(c *gin.Context) (*HappyHorseRequest, error) {
	if value, ok := c.Get(happyHorseRequestContextKey); ok {
		if req, ok := value.(*HappyHorseRequest); ok && req != nil {
			return req, nil
		}
	}
	return BindHappyHorseRequest(c)
}
