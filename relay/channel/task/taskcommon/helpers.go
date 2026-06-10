package taskcommon

import (
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
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
	// GCS 转存模式下剥离上游回调/直写旁路字段（必须在 unmarshal 进 payload 结构体之前
	// 在 metadata map 上删键——unmarshal 后置空结构体字段会像 Kling 的 CallbackUrl
	// 先例一样被整体灌入覆盖，见 gcs-video-transfer-design.md 2.2）。
	StripBypassMetadata(metadata)
	metaBytes, err := common.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata failed: %w", err)
	}
	if err := common.Unmarshal(metaBytes, target); err != nil {
		return fmt.Errorf("unmarshal metadata failed: %w", err)
	}
	return nil
}

// StripBypassMetadata 在 GCS 转存模式开启时，从用户 metadata 中删除旁路字段
// （gcs-video-transfer-design.md 2.2 / 实现清单项 5）：
//   - 回调类（webhookUrl / webhook_url / callback_url / callbackUrl）：上游完成时会把含
//     时效直链的 payload 直接 POST 到用户回调地址，绕过"转存完成才返回成功"语义；
//   - Veo 的 storageUri / storage_uri：让上游把结果直接写进用户自己的 GCS bucket，
//     不经网关任何出口，且使 Vertex 的 base64 重取必然失败（误退款路径）。
//
// 必须在 UnmarshalMetadata 之前对 metadata map 删键（结构体字面量置空会被随后的
// unmarshal 覆盖）。键匹配做大小写与 _/- 分隔符归一化：encoding/json 的字段匹配
// 大小写不敏感，精确删键可被 "CALLBACK_URL" 之类的变体绕过。
func StripBypassMetadata(metadata map[string]any) {
	if !setting.GCSTransferEnabled || metadata == nil {
		return
	}
	for k := range metadata {
		switch normalizeMetadataKey(k) {
		case "callbackurl", "webhookurl", "storageuri":
			delete(metadata, k)
		}
	}
}

// normalizeMetadataKey 归一化 metadata 键名用于旁路字段匹配：小写并去除 _ / - 分隔符。
func normalizeMetadataKey(k string) string {
	k = strings.ToLower(k)
	k = strings.ReplaceAll(k, "_", "")
	k = strings.ReplaceAll(k, "-", "")
	return k
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
	// ProgressTransferring GCS 转存阶段的固定专用 progress 值（gcs-video-transfer-design.md 4.4）。
	// 红线：UpstreamDoneAt != 0 时任何路径禁止把 progress 写成 100%（终态 CAS 除外）——
	// 「status=IN_PROGRESS 且 progress=100%」会同时退出轮询与超时清扫集合，永久卡死、资金悬置。
	ProgressTransferring = "95%"
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
