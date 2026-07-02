package taskcommon

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// whitelabelChannels lists channel types whose upstream URL/branding must
// never reach customers. For these channels the public result_url is the
// new-api proxy URL; the real upstream URL is preserved inside task.Data
// and only resolved server-side by controller.VideoProxy.
var whitelabelChannels = map[int]struct{}{
	constant.ChannelTypeKuaiziLizhen:     {},
	constant.ChannelTypeBlockRunVideo:    {},
	constant.ChannelTypeBlockRunSeedance: {},
	constant.ChannelTypeJimengProxy:      {},
	constant.ChannelTypeJimengZhizinan:   {},
}

// ShouldWhitelabelPlatform reports whether tasks on the given platform must
// be served through the proxy regardless of whether the adapter produced a
// direct upstream URL. The platform string for video channels is the
// stringified channel type (see relay.GetTaskPlatform).
func ShouldWhitelabelPlatform(platform constant.TaskPlatform) bool {
	ct, err := strconv.Atoi(string(platform))
	if err != nil {
		return false
	}
	_, ok := whitelabelChannels[ct]
	return ok
}

// ShouldWhitelabelChannelType reports whether the given channel type is on
// the whitelabel list (used by controller code that has channel.Type at hand).
func ShouldWhitelabelChannelType(channelType int) bool {
	_, ok := whitelabelChannels[channelType]
	return ok
}

// brandKeywords lists provider-identifying substrings that must not appear in
// customer-facing text. Match is case-insensitive. Extend when adding new
// whitelabel channels.
var brandKeywords = []string{
	"kuaizi", "lizhen",
	"volces", "volcengine",
	"bytedance",
	"kz-cgt",
	"tos-cn-beijing",
	"blockrun", "flatkey",
	"jimeng", "jianying", "dreamina", "seedance",
}

// ContainsBrandKeyword reports whether s contains any provider-identifying
// brand keyword (case-insensitive). Exported so synchronous relay paths
// (chat/messages/responses) can reuse the same single source of brand keywords
// when scrubbing upstream error text on whitelabel channels.
func ContainsBrandKeyword(s string) bool {
	if s == "" {
		return false
	}
	lower := strings.ToLower(s)
	for _, kw := range brandKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// ScrubBrandedText returns the input unchanged when it contains none of the
// known brand keywords, otherwise returns a generic failure message. Used on
// whitelabel channels for free-form fields (e.g. fail_reason) where upstream
// text may leak the provider identity. Admins still see the original via
// TaskModel2DtoAdmin.
func ScrubBrandedText(s string) string {
	if s == "" {
		return ""
	}
	if ContainsBrandKeyword(s) {
		return "task failed at upstream provider"
	}
	return s
}

// ValidateRemoteMediaURL applies the same fetch/SSRF policy used by NewAPI's
// server-side fetch paths before a task adaptor forwards a user-supplied media
// URL to an upstream service that may fetch it.
func ValidateRemoteMediaURL(raw string) error {
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		raw,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return fmt.Errorf("image url is not allowed: %w", err)
	}
	return nil
}

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
