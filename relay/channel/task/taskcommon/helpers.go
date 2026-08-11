package taskcommon

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// GinKeyUpstreamRequestBody stores the marshaled upstream create JSON on gin.Context
// so the task insert path can persist it into TaskPrivateData.RequestBody.
const GinKeyUpstreamRequestBody = "task_upstream_request_body"

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

// IsTaskProxyContentURL reports whether url points at this task's video proxy endpoint.
func IsTaskProxyContentURL(url, taskID string) bool {
	if strings.TrimSpace(url) == "" || strings.TrimSpace(taskID) == "" {
		return false
	}
	return strings.Contains(url, "/v1/videos/"+taskID+"/content")
}

// IsVideoProxyContentURL reports whether url looks like any new-api style video content proxy
// (any host / any task id): .../v1/videos/{id}/content
// Used to reject upstream gateway result_url values (e.g. api.catertx.com) that must not
// be exposed to clients as the final media URL.
func IsVideoProxyContentURL(rawURL string) bool {
	rawURL = strings.TrimSpace(rawURL)
	idx := strings.Index(rawURL, "/v1/videos/")
	if idx < 0 {
		return false
	}
	rest := rawURL[idx+len("/v1/videos/"):]
	slash := strings.IndexByte(rest, '/')
	if slash <= 0 {
		return false
	}
	return strings.HasPrefix(rest[slash:], "/content")
}

// ExtractVideoURLFromJSON scans common upstream video response fields for a direct HTTP URL.
func ExtractVideoURLFromJSON(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	s := string(raw)
	for _, path := range []string{
		"url",
		"video_url",
		"metadata.url",
		"metadata.video_url",
		"content.video_url",
		"upstream_response.content.video_url",
		"data.video_url",
		"data.content.video_url",
		"data.url",
		"data.data.url",
		"data.data.video_url",
		"data.data.data.0.url",
		"remixed_from_video_id",
	} {
		u := strings.TrimSpace(gjson.Get(s, path).String())
		if u == "" || !strings.HasPrefix(u, "http") {
			continue
		}
		if IsVideoProxyContentURL(u) {
			continue
		}
		return u
	}
	return ""
}

// ResolveTaskVideoURL returns the upstream video URL for proxying, avoiding self-referencing proxy URLs.
func ResolveTaskVideoURL(task *model.Task) string {
	if task == nil {
		return ""
	}
	stored := strings.TrimSpace(task.GetResultURL())
	if stored != "" && !IsTaskProxyContentURL(stored, task.TaskID) && !IsVideoProxyContentURL(stored) && !IsLikelyExpiredSignedVideoURL(stored) {
		return stored
	}
	if u := ExtractVideoURLFromJSON(task.Data); u != "" && !IsLikelyExpiredSignedVideoURL(u) {
		return u
	}
	if stored != "" && !IsTaskProxyContentURL(stored, task.TaskID) && !IsVideoProxyContentURL(stored) {
		return stored
	}
	if u := ExtractVideoURLFromJSON(task.Data); u != "" {
		return u
	}
	return ""
}

// ExtractUpstreamTaskIDFromJSON returns a provider task id stored in task data when it differs from the public task id.
func ExtractUpstreamTaskIDFromJSON(data []byte, publicTaskID string) string {
	if len(data) == 0 {
		return ""
	}
	publicTaskID = strings.TrimSpace(publicTaskID)
	for _, path := range []string{"id", "task_id", "video_id"} {
		id := strings.TrimSpace(gjson.GetBytes(data, path).String())
		if id == "" || id == publicTaskID {
			continue
		}
		if publicTaskID == "" || id != publicTaskID {
			return id
		}
	}
	return ""
}

// IsLikelyExpiredSignedVideoURL reports whether a signed object-storage URL is probably expired.
func IsLikelyExpiredSignedVideoURL(rawURL string) bool {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return false
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	query := parsed.Query()
	expiresRaw := strings.TrimSpace(query.Get("X-Tos-Expires"))
	dateRaw := strings.TrimSpace(query.Get("X-Tos-Date"))
	if expiresRaw == "" || dateRaw == "" {
		return false
	}
	expiresSec, err := time.ParseDuration(expiresRaw + "s")
	if err != nil {
		return false
	}
	signedAt, err := time.Parse("20060102T150405Z", dateRaw)
	if err != nil {
		return false
	}
	return time.Now().After(signedAt.Add(expiresSec))
}

// PickTaskResultURL stores the best available result URL, avoiding proxy self-reference when possible.
// Upstream gateway proxy URLs (any host's /v1/videos/{id}/content) are never stored — prefer a
// direct media URL from data, otherwise fall back to this server's BuildProxyURL.
func PickTaskResultURL(task *model.Task, candidateURL string, data []byte) string {
	candidateURL = strings.TrimSpace(candidateURL)
	if strings.HasPrefix(candidateURL, "data:") {
		return BuildProxyURL(task.TaskID)
	}
	if candidateURL != "" && !IsTaskProxyContentURL(candidateURL, task.TaskID) && !IsVideoProxyContentURL(candidateURL) {
		return candidateURL
	}
	if u := ExtractVideoURLFromJSON(data); u != "" {
		return u
	}
	return BuildProxyURL(task.TaskID)
}

// Status-to-progress mapping constants for polling updates.
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
