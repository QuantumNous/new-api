package taskcommon

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// UnmarshalMetadata converts a map[string]any metadata to a typed struct via JSON round-trip.
// This replaces the repeated pattern: json.Marshal(metadata) → json.Unmarshal(bytes, &target).
func UnmarshalMetadata(metadata map[string]any, target any) error {
	if metadata == nil {
		return nil
	}
	// Prevent metadata from overriding model fields to avoid billing bypass.
	delete(metadata, "model")
	metaBytes, err := common.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata failed: %w", err)
	}
	if err := common.Unmarshal(metaBytes, target); err != nil {
		return fmt.Errorf("unmarshal metadata failed: %w", err)
	}
	return nil
}

// DefaultString returns val if non-empty, otherwise fallback.
func DefaultString(val, fallback string) string {
	if val == "" {
		return fallback
	}
	return val
}

// DefaultInt returns val if non-zero, otherwise fallback.
func DefaultInt(val, fallback int) int {
	if val == 0 {
		return fallback
	}
	return val
}

// EncodeLocalTaskID encodes an upstream operation name to a URL-safe base64 string.
// Used by Gemini/Vertex to store upstream names as task IDs.
func EncodeLocalTaskID(name string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(name))
}

// DecodeLocalTaskID decodes a base64-encoded upstream operation name.
func DecodeLocalTaskID(id string) (string, error) {
	b, err := base64.RawURLEncoding.DecodeString(id)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// BuildProxyURL constructs the video proxy URL using the public task ID.
// e.g., "https://your-server.com/v1/videos/task_xxxx/content"
func BuildProxyURL(taskID string) string {
	return fmt.Sprintf("%s/v1/videos/%s/content", system_setting.ServerAddress, taskID)
}

// ShouldProxyVideoURL reports whether a provider URL must not be exposed to clients.
func ShouldProxyVideoURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "data:") {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return true
	}
	host := strings.ToLower(u.Host)
	if host == "" {
		return false
	}
	if strings.Contains(host, "apimart.ai") || strings.Contains(host, "apib.ai") || strings.Contains(host, "cdn.apimart") || strings.Contains(host, "getapib.org") {
		return true
	}
	return false
}

// ApplyVideoResultURL stores upstream CDN URL privately and exposes proxy URL to clients.
func ApplyVideoResultURL(task *model.Task, upstreamURL string) {
	upstreamURL = strings.TrimSpace(upstreamURL)
	if upstreamURL == "" || task == nil {
		return
	}
	if ShouldProxyVideoURL(upstreamURL) {
		task.PrivateData.UpstreamVideoURL = upstreamURL
		task.PrivateData.ResultURL = BuildProxyURL(task.TaskID)
		return
	}
	task.PrivateData.ResultURL = upstreamURL
}

// VideoResolutionSizeRatio maps resolution to a billing multiplier against the 720p per-second base.
// Official list prices (80% on APIMaster): sora-2 720p $0.08/s; sora-2-pro 720p $0.24/s, 1024p $0.40/s, 1080p $0.56/s.
func VideoResolutionSizeRatio(resolution string) float64 {
	switch strings.ToLower(strings.TrimSpace(resolution)) {
	case "1080p":
		return 2.333333 // 0.56 / 0.24
	case "1024p":
		return 1.666667 // 0.40 / 0.24
	default:
		return 1.0
	}
}

// VideoOpenAISizeRatio maps OpenAI-style size strings to the same billing multipliers.
func VideoOpenAISizeRatio(size string) float64 {
	switch size {
	case "1920x1080", "1080x1920":
		return VideoResolutionSizeRatio("1080p")
	case "1792x1024", "1024x1792":
		return VideoResolutionSizeRatio("1024p")
	default:
		return 1.0
	}
}

const (
	ProgressSubmitted  = "10%"
	ProgressQueued     = "20%"
	ProgressInProgress = "30%"
	ProgressComplete   = "100%"
)

// ---------------------------------------------------------------------------
// BaseBilling — embeddable no-op implementations for TaskAdaptor billing methods.
// Adaptors that do not need custom billing can embed this struct directly.
// ---------------------------------------------------------------------------

type BaseBilling struct{}

// EstimateBilling returns nil (no extra ratios; use base model price).
func (BaseBilling) EstimateBilling(_ *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	return nil
}

// AdjustBillingOnSubmit returns nil (no submit-time adjustment).
func (BaseBilling) AdjustBillingOnSubmit(_ *relaycommon.RelayInfo, _ []byte) map[string]float64 {
	return nil
}

// AdjustBillingOnComplete returns 0 (keep pre-charged amount).
func (BaseBilling) AdjustBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return 0
}
