package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

// doubaoContentItem mirrors the "content" array items from the Doubao native API.
type doubaoContentItem struct {
	Type     string            `json:"type,omitempty"`
	Text     string            `json:"text,omitempty"`
	ImageURL *doubaoMediaURL   `json:"image_url,omitempty"`
	VideoURL *doubaoMediaURL   `json:"video_url,omitempty"`
	AudioURL *doubaoMediaURL   `json:"audio_url,omitempty"`
}

type doubaoMediaURL struct {
	URL string `json:"url,omitempty"`
}

// doubaoNativeRequest is the native Doubao video creation request body.
// POST /api/v3/contents/generations/tasks
type doubaoNativeRequest struct {
	Model      string              `json:"model"`
	Content    []doubaoContentItem `json:"content,omitempty"`
	Resolution string              `json:"resolution,omitempty"`
	Ratio      string              `json:"ratio,omitempty"`
	// Duration and Seed can be int or object {"value": N} from upstream.
	// We accept any JSON here and re-pack them into metadata.
	Duration    interface{} `json:"duration,omitempty"`
	Seed        interface{} `json:"seed,omitempty"`
	CameraFixed interface{} `json:"camera_fixed,omitempty"`
	Watermark   interface{} `json:"watermark,omitempty"`
	// Pass-through extra fields
	CallbackURL           string      `json:"callback_url,omitempty"`
	ReturnLastFrame       interface{} `json:"return_last_frame,omitempty"`
	ServiceTier           string      `json:"service_tier,omitempty"`
	ExecutionExpiresAfter interface{} `json:"execution_expires_after,omitempty"`
	GenerateAudio         interface{} `json:"generate_audio,omitempty"`
	Draft                 interface{} `json:"draft,omitempty"`
	Frames                interface{} `json:"frames,omitempty"`
	Tools                 interface{} `json:"tools,omitempty"`
}

// DoubaoRequestConvert converts native Doubao video API requests into new-api's
// internal task format so they can be handled by the existing task relay pipeline.
//
// Supported paths:
//   POST /api/v3/contents/generations/tasks         → create task
//   GET  /api/v3/contents/generations/tasks/:task_id → fetch task
func DoubaoRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		// Determine if this is a fetch request (GET with task_id)
		if c.Request.Method == http.MethodGet {
			taskID := c.Param("task_id")
			if taskID == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "task_id is required")
				return
			}
			// Route to internal fetch endpoint
			c.Request.URL.Path = "/v1/video/generations/" + taskID
			c.Set("task_id", taskID)
			c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
			c.Next()
			return
		}

		// POST: parse native Doubao request and convert to internal format
		var nativeReq doubaoNativeRequest
		if err := common.UnmarshalBodyReusable(c, &nativeReq); err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}

		// Extract prompt and images from the content array
		var prompt string
		var images []string

		for _, item := range nativeReq.Content {
			switch item.Type {
			case "text":
				if item.Text != "" {
					prompt = item.Text
				}
			case "image_url":
				if item.ImageURL != nil && item.ImageURL.URL != "" {
					images = append(images, item.ImageURL.URL)
				}
			}
		}

		// Build metadata — carry all non-standard fields so the doubao adaptor
		// can pick them up via taskcommon.UnmarshalMetadata.
		metadata := make(map[string]interface{})

		// Re-pack the full original content array so hasVideoInMetadata() works
		// correctly (doubao adaptor checks metadata["content"]).
		if len(nativeReq.Content) > 0 {
			rawContent := make([]interface{}, len(nativeReq.Content))
			for i, item := range nativeReq.Content {
				m := make(map[string]interface{})
				if item.Type != "" {
					m["type"] = item.Type
				}
				if item.Text != "" {
					m["text"] = item.Text
				}
				if item.ImageURL != nil {
					m["image_url"] = map[string]interface{}{"url": item.ImageURL.URL}
				}
				if item.VideoURL != nil {
					m["video_url"] = map[string]interface{}{"url": item.VideoURL.URL}
				}
				if item.AudioURL != nil {
					m["audio_url"] = map[string]interface{}{"url": item.AudioURL.URL}
				}
				rawContent[i] = m
			}
			metadata["content"] = rawContent
		}

		if nativeReq.Resolution != "" {
			metadata["resolution"] = nativeReq.Resolution
		}
		if nativeReq.Ratio != "" {
			metadata["ratio"] = nativeReq.Ratio
		}
		if nativeReq.Duration != nil {
			metadata["duration"] = normalizeDuration(nativeReq.Duration)
		}
		if nativeReq.Seed != nil {
			metadata["seed"] = nativeReq.Seed
		}
		if nativeReq.CameraFixed != nil {
			metadata["camera_fixed"] = nativeReq.CameraFixed
		}
		if nativeReq.Watermark != nil {
			metadata["watermark"] = nativeReq.Watermark
		}
		if nativeReq.CallbackURL != "" {
			metadata["callback_url"] = nativeReq.CallbackURL
		}
		if nativeReq.ReturnLastFrame != nil {
			metadata["return_last_frame"] = nativeReq.ReturnLastFrame
		}
		if nativeReq.ServiceTier != "" {
			metadata["service_tier"] = nativeReq.ServiceTier
		}
		if nativeReq.ExecutionExpiresAfter != nil {
			metadata["execution_expires_after"] = nativeReq.ExecutionExpiresAfter
		}
		if nativeReq.GenerateAudio != nil {
			metadata["generate_audio"] = nativeReq.GenerateAudio
		}
		if nativeReq.Draft != nil {
			metadata["draft"] = nativeReq.Draft
		}
		if nativeReq.Frames != nil {
			metadata["frames"] = nativeReq.Frames
		}
		if nativeReq.Tools != nil {
			metadata["tools"] = nativeReq.Tools
		}

		// Build unified internal request
		unifiedReq := map[string]interface{}{
			"model":    nativeReq.Model,
			"prompt":   prompt,
			"metadata": metadata,
		}

		if len(images) == 1 {
			unifiedReq["image"] = images[0]
		} else if len(images) > 1 {
			unifiedReq["images"] = images
		}

		// Extract seconds/duration for billing estimation
		if nativeReq.Duration != nil {
			if secs := extractDurationSeconds(nativeReq.Duration); secs > 0 {
				unifiedReq["seconds"] = strconv.Itoa(secs)
			}
		}

		jsonData, err := common.Marshal(unifiedReq)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to marshal request: "+err.Error())
			return
		}

		// Replace request body
		c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
		c.Set(common.KeyRequestBody, jsonData)

		// Redirect to the internal video generation endpoint
		c.Request.URL.Path = "/v1/video/generations"

		c.Next()
	}
}

// normalizeDuration converts various duration representations to a plain int.
// Doubao native API accepts both {"value": N} and plain N.
func normalizeDuration(v interface{}) interface{} {
	switch d := v.(type) {
	case float64:
		return int(d)
	case int:
		return d
	case map[string]interface{}:
		if val, ok := d["value"]; ok {
			return normalizeDuration(val)
		}
	}
	return v
}

// extractDurationSeconds returns the integer second value from a duration field.
func extractDurationSeconds(v interface{}) int {
	switch d := v.(type) {
	case float64:
		return int(d)
	case int:
		return d
	case map[string]interface{}:
		if val, ok := d["value"]; ok {
			return extractDurationSeconds(val)
		}
	}
	return 0
}
