package service

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// tebibyte 1 TB = 1024^4 字节（与前端 formatBytes 的 1024 进制一致）。
const tebibyte = int64(1024) * 1024 * 1024 * 1024

// StartMediaStorageStatsTask 启动桶用量快照 cron（设计 §5.7）。
// 每 StatsSnapshotIntervalMinutes 分钟调一次 StorageInfo 写快照 + 阈值告警。
// 总开关关闭时空转（不建快照），避免对未配置的部署产生任何调用。
func StartMediaStorageStatsTask() {
	gopool.Go(func() {
		for {
			interval := snapshotInterval()
			time.Sleep(interval)
			if !mediastore.Enabled() {
				continue
			}
			if _, err := RunMediaStorageSnapshot(context.Background()); err != nil {
				common.SysError("media storage snapshot failed: " + err.Error())
			}
		}
	})
}

func snapshotInterval() time.Duration {
	m := system_setting.GetMediaStorageSettings().StatsSnapshotIntervalMinutes
	if m <= 0 {
		m = 60
	}
	return time.Duration(m) * time.Minute
}

// RunMediaStorageSnapshot 执行一次桶用量采集：写入 media_storage_stats 一行，
// 计算 24h 增量与告警等级，必要时推送 webhook。返回写入的快照。
// 供 cron 与 admin「立即刷新」端点复用。
func RunMediaStorageSnapshot(ctx context.Context) (*model.MediaStorageStats, error) {
	store, err := mediastore.Get()
	if err != nil {
		return nil, fmt.Errorf("get store: %w", err)
	}
	info, err := store.StorageInfo(ctx)
	if err != nil {
		return nil, fmt.Errorf("storage info: %w", err)
	}

	now := time.Now().Unix()

	// 24h 增量：取 <= now-24h 的最近快照做差；无更早数据则记 0。
	var growth int64
	if prevBytes, ok, gerr := model.GetMediaStorageBytesAt(now - 24*3600); gerr == nil && ok {
		growth = info.TotalBytes - prevBytes
		if growth < 0 {
			growth = 0
		}
	}

	s := system_setting.GetMediaStorageSettings()
	level := classifyAlertLevel(info.TotalBytes, s.BucketWarnThresholdTB, s.BucketCriticalThresholdTB)

	stat := &model.MediaStorageStats{
		SnapshotAt:     now,
		TotalBytes:     info.TotalBytes,
		TotalObjects:   info.TotalObjects,
		Growth24hBytes: growth,
		AlertLevel:     level,
	}
	if err := stat.Insert(); err != nil {
		return nil, fmt.Errorf("insert snapshot: %w", err)
	}

	maybeSendBucketAlert(stat)
	return stat, nil
}

// classifyAlertLevel 按阈值把用量归到 ok / warn / critical。critical 优先。
func classifyAlertLevel(totalBytes int64, warnTB, critTB float64) string {
	if critTB > 0 && float64(totalBytes) >= critTB*float64(tebibyte) {
		return "critical"
	}
	if warnTB > 0 && float64(totalBytes) >= warnTB*float64(tebibyte) {
		return "warn"
	}
	return "ok"
}

// maybeSendBucketAlert 阈值告警去重：ok 不推；非 ok 仅在「同等级上次告警超过去重窗口」时推。
func maybeSendBucketAlert(stat *model.MediaStorageStats) {
	if stat.AlertLevel == "ok" {
		return
	}
	s := system_setting.GetMediaStorageSettings()
	webhook := s.AlertWebhook
	if webhook == "" {
		return
	}
	dedupHours := s.AlertDedupHours
	if dedupHours <= 0 {
		dedupHours = 24
	}
	// 取「当前之前」的同等级告警（排除刚插入的自己）；在去重窗口内则跳过。
	// 首次跨越 last==nil 会放行。
	if last, err := model.GetPreviousMediaStorageAlert(stat.AlertLevel, stat.Id); err == nil && last != nil {
		if stat.SnapshotAt-last.SnapshotAt < int64(dedupHours)*3600 {
			return
		}
	}

	msg := fmt.Sprintf(
		"[%s] OBS 桶 %s 用量已达 %s / 阈值 warn=%.1fTB critical=%.1fTB\n24h 增长 %s，对象数 %d\n建议：admin 后台查看用量趋势，必要时清理 top 用户或关闭媒体存储总开关。",
		stat.AlertLevel,
		s.Bucket,
		HumanizeBytes(stat.TotalBytes),
		s.BucketWarnThresholdTB,
		s.BucketCriticalThresholdTB,
		HumanizeBytes(stat.Growth24hBytes),
		stat.TotalObjects,
	)
	if err := sendBucketAlertWebhook(webhook, msg); err != nil {
		common.SysError("media storage alert webhook failed: " + err.Error())
	}
}

// sendBucketAlertWebhook 发送文本告警到企业微信/钉钉机器人（两者均接受 msgtype=text）。
// 走 fetch 的 SSRF 校验后直接 POST；不复用 SendWebhookNotify（那是站内签名格式）。
func sendBucketAlertWebhook(webhookURL, content string) error {
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(webhookURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("webhook url rejected: %w", err)
	}
	payload := map[string]any{
		"msgtype": "text",
		"text":    map[string]string{"content": content},
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := GetHttpClient()
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook status %d", resp.StatusCode)
	}
	return nil
}

// HumanizeBytes 与前端 formatBytes 同口径（1024 进制），供 controller 复用。
func HumanizeBytes(b int64) string {
	if b <= 0 {
		return "0 B"
	}
	units := []string{"B", "KB", "MB", "GB", "TB", "PB"}
	f := float64(b)
	i := 0
	for f >= 1024 && i < len(units)-1 {
		f /= 1024
		i++
	}
	return fmt.Sprintf("%.2f %s", f, units[i])
}
