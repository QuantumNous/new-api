package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
)

// GCS 视频任务结果转存：读取侧统一收口入口（gcs-video-transfer-design.md 4.5 / PRD 红线 12）。
//
// 三条统一规则：
//  1. 读时现签、不存库——12 小时后再查也能拿到新鲜签名链接；
//  2. 超保留期返回明确的过期错误（ErrGCSResultExpired），不签必 404 的死链；
//  3. 签名失败时无错误通道的 JSON 出口降级为 video_proxy 代理 URL（BuildProxyURL），
//     绝不返回裸 gs://。

// TaskSignedAsset 单个已签名资产，读取侧按 Index 升序重组输出
// （index=0 为主文件，写 metadata.url；其余按 Index 追加）。
type TaskSignedAsset struct {
	Index     int
	SignedURL string
	ExpiresAt int64 // Unix 秒，真实签名过期时刻（不得虚标，设计 4.6）
}

// GetTaskSignedResultURL 统一入口：解析任务主结果 URL 并按需现签。
//   - 非 gs://（旧数据 / 紧急开关降级直链 / 代理 URL）→ 原样返回，expiresAt=0；
//   - gs:// → V4 现签，返回 (signedURL, 真实 expiresAt, nil)；
//   - 超保留期 → ErrGCSResultExpired；
//   - 签名失败 → error（调用方决定降级：JSON 出口 BuildProxyURL，video_proxy 503）。
func GetTaskSignedResultURL(task *model.Task) (string, int64, error) {
	raw := strings.TrimSpace(task.GetResultURL())
	if !IsGCSResultURL(raw) {
		return raw, 0, nil
	}
	_, objectName, err := ParseGCSObjectURL(raw)
	if err != nil {
		return "", 0, err
	}
	return GCSSignResultURL(objectName, task.FinishTime)
}

// GetTaskSignedAssets 多文件重组（设计 4.5 规则 3）：按 PrivateData.UpstreamAssets 的
// Index 升序对任务全部 GCS 对象现签。仅当任务主结果为 gs:// 时调用才有意义；
// 资产清单缺失/损坏（异常旧数据）时退化为仅主文件（从 ResultURL 解析对象名）。
// 任一对象签名失败即整体返回 error（保留期对全部对象一致，过期短路为 ErrGCSResultExpired）。
func GetTaskSignedAssets(task *model.Task) ([]TaskSignedAsset, error) {
	raw := strings.TrimSpace(task.GetResultURL())
	if !IsGCSResultURL(raw) {
		return nil, fmt.Errorf("task %s result is not a gcs object", task.TaskID)
	}
	assets, err := taskcommon.UnmarshalUpstreamAssets(task.PrivateData.UpstreamAssets)
	if err != nil || len(assets) == 0 {
		// 资产清单缺失：退化为主文件单对象
		_, objectName, perr := ParseGCSObjectURL(raw)
		if perr != nil {
			return nil, perr
		}
		signedURL, expiresAt, serr := GCSSignResultURL(objectName, task.FinishTime)
		if serr != nil {
			return nil, serr
		}
		return []TaskSignedAsset{{Index: 0, SignedURL: signedURL, ExpiresAt: expiresAt}}, nil
	}
	sort.Slice(assets, func(i, j int) bool { return assets[i].Index < assets[j].Index })
	out := make([]TaskSignedAsset, 0, len(assets))
	for _, a := range assets {
		signedURL, expiresAt, serr := GCSSignResultURL(GCSObjectName(task.TaskID, a.Index, a.Ext), task.FinishTime)
		if serr != nil {
			return nil, serr
		}
		out = append(out, TaskSignedAsset{Index: a.Index, SignedURL: signedURL, ExpiresAt: expiresAt})
	}
	return out, nil
}

// GetTaskDisplayResultURL 无错误通道的 JSON 出口（TaskModel2Dto / tryRealtimeFetch
// 响应组装）用的降级版本：签名失败或已过期时降级为 video_proxy 代理 URL——访问时
// 由 video_proxy 给出 503 可重试 / 410 过期的明确语义——绝不返回裸 gs://（红线 12）。
// 返回 (displayURL, expiresAt)；非签名 URL（直链/代理降级）时 expiresAt=0。
func GetTaskDisplayResultURL(ctx context.Context, task *model.Task) (string, int64) {
	displayURL, expiresAt, err := GetTaskSignedResultURL(task)
	if err != nil {
		if !errors.Is(err, ErrGCSResultExpired) {
			// 签名失败计数的观测点（4.8，S8 接指标）；过期是预期内契约行为，不计失败
			logger.LogError(ctx, fmt.Sprintf("gcs sign-fail task=%s, degrade to proxy url: %s", task.TaskID, err.Error()))
		}
		return taskcommon.BuildProxyURL(task.TaskID), 0
	}
	return displayURL, expiresAt
}
