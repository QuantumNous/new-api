package taskcommon

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// GCS 视频任务结果转存：上游资产模型（gcs-video-transfer-design.md 4.2）。
//
// UpstreamAsset 在轮询循环发现"上游成功"时由 adaptor.ExtractUpstreamAssets 枚举产生，
// 序列化后暂存进 task.PrivateData.UpstreamAssets（JSON 字符串），供异步转存 worker
// 取流与读取侧按 Index 重组使用。清单含上游直链，绝不对外返回。

// 对象扩展名按渠道静态映射在暂存时定死（视频 mp4、封面/图片 jpg、未知 bin），
// 不随下载的 Content-Type 漂移——扩展名参与 GCS 对象命名
// （{prefix}/{task_id}_{index}.{ext}），漂移会破坏 If-GenerationMatch:0 条件写的幂等。
const (
	AssetExtVideo = "mp4"
	AssetExtImage = "jpg"
	AssetExtBin   = "bin"
)

// UpstreamAsset 描述任务的一个上游结果资产。
type UpstreamAsset struct {
	// Index 对象序号：决定 GCS 对象名与读取侧重组顺序（index=0 为主文件，
	// 写入 metadata.url）；封面等附属文件也占一个 Index。
	Index int `json:"index"`
	// URL 上游直链；无直链渠道（Sora 经 content 端点、Vertex 重取 base64）留空，
	// 由各自的 FetchResultContent 自行取流。
	URL string `json:"url,omitempty"`
	// Ext 对象扩展名（不含点），暂存时定死、跨重试稳定。
	Ext string `json:"ext"`
}

// MarshalUpstreamAssets 序列化资产清单，结果存入 task.PrivateData.UpstreamAssets。
func MarshalUpstreamAssets(assets []UpstreamAsset) (string, error) {
	if len(assets) == 0 {
		return "", fmt.Errorf("empty upstream assets")
	}
	b, err := common.Marshal(assets)
	if err != nil {
		return "", fmt.Errorf("marshal upstream assets failed: %w", err)
	}
	return string(b), nil
}

// UnmarshalUpstreamAssets 反序列化 task.PrivateData.UpstreamAssets。
func UnmarshalUpstreamAssets(raw string) ([]UpstreamAsset, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, fmt.Errorf("empty upstream assets json")
	}
	var assets []UpstreamAsset
	if err := common.Unmarshal([]byte(raw), &assets); err != nil {
		return nil, fmt.Errorf("unmarshal upstream assets failed: %w", err)
	}
	return assets, nil
}

// ResolveTaskFetchKey 解析转存取流凭证：PrivateData.Key 优先、ch.Key 兜底（单 key 渠道），
// 与轮询（service/task_polling.go）和 video_proxy 口径一致。
// 多 key 渠道的 ch.Key 是换行拼接的全部 key 原始串、直接使用是确定性无效凭证，
// 因此带鉴权取流的渠道（Gemini/Vertex/Pollo/Sora）必须在 InitTask 时快照提交 key
// （见 model/task.go InitTask 的 key 快照分支）。
func ResolveTaskFetchKey(task *model.Task, ch *model.Channel) string {
	if task != nil {
		if key := strings.TrimSpace(task.PrivateData.Key); key != "" {
			return key
		}
	}
	if ch != nil {
		return strings.TrimSpace(ch.Key)
	}
	return ""
}

// ---------------------------------------------------------------------------
// UnsupportedAssets — embeddable no-op implementations for adaptors whose任务
// 不参与 GCS 转存（如 Suno：独立批量轮询路径，非视频任务）。
// ---------------------------------------------------------------------------

type UnsupportedAssets struct{}

// ExtractUpstreamAssets always errors: this platform does not support GCS transfer.
func (UnsupportedAssets) ExtractUpstreamAssets(_ *model.Task, _ *relaycommon.TaskInfo, _ []byte) ([]UpstreamAsset, error) {
	return nil, fmt.Errorf("gcs transfer is not supported for this task platform")
}

// FetchResultContent always errors: this platform does not support GCS transfer.
func (UnsupportedAssets) FetchResultContent(_ context.Context, _ *model.Task, _ *model.Channel, _ UpstreamAsset) (io.ReadCloser, string, error) {
	return nil, "", fmt.Errorf("gcs transfer is not supported for this task platform")
}
