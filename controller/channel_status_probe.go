package controller

import (
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// recordChannelStatusProbe 在渠道测试完成后追加一条 probe log。
//
// 该函数保持异步、幂等：任何错误不影响原有测试流程。仅当该渠道所属分组在
// status_page.groups 且 enabled=true 时写入，避免无谓 IO。
func recordChannelStatusProbe(channel *model.Channel, success bool, latencyMs int64, errMessage string) {
	if channel == nil {
		return
	}
	groups := channel.GetGroups()
	if !anyStatusPageGroupEnabled(groups) {
		return
	}

	setting := operation_setting.GetStatusPageSetting()
	level := model.ChannelStatusProbeLevelFail
	if success {
		if setting.DegradedLatencyMs > 0 && latencyMs >= int64(setting.DegradedLatencyMs) {
			level = model.ChannelStatusProbeLevelDegraded
		} else {
			level = model.ChannelStatusProbeLevelOK
		}
	}

	pingMs := 0
	if setting.EnablePingProbe {
		if ms, ok := probeBaseURLPing(channel.GetBaseURL(), setting.PingProbeTimeoutMs); ok {
			pingMs = ms
		}
	}

	// 明确不写入密钥、上游错误详情等敏感数据；仅保留一个短提示
	safeMessage := sanitizeProbeMessage(errMessage)

	go model.AppendChannelStatusProbeLog(
		channel.Id,
		success,
		level,
		int(latencyMs),
		pingMs,
		safeMessage,
	)
}

func anyStatusPageGroupEnabled(groups []string) bool {
	for _, g := range groups {
		if operation_setting.IsStatusPageGroupEnabled(g) {
			return true
		}
	}
	return false
}

// probeBaseURLPing 对 base URL 的 host:port 做一次短超时 TCP 拨号，作为连通延迟。
//
// 不发起 HEAD 请求以避免命中鉴权/CDN 逻辑；仅测试 TCP 连接握手时间。
// 返回值单位为毫秒，最小 1（避免与「无数据」的 0 语义冲突）。
func probeBaseURLPing(baseURL string, timeoutMs int) (int, bool) {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return 0, false
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Host == "" {
		return 0, false
	}
	host := parsed.Host
	if !strings.Contains(host, ":") {
		if parsed.Scheme == "http" {
			host = host + ":80"
		} else {
			host = host + ":443"
		}
	}
	if timeoutMs <= 0 {
		timeoutMs = operation_setting.StatusPageDefaultPingProbeTimeoutMs
	}
	dialer := net.Dialer{Timeout: time.Duration(timeoutMs) * time.Millisecond}
	start := time.Now()
	conn, err := dialer.Dial("tcp", host)
	if err != nil {
		return 0, false
	}
	_ = conn.Close()
	elapsed := int(time.Since(start).Milliseconds())
	if elapsed <= 0 {
		elapsed = 1
	}
	return elapsed, true
}

// sanitizeProbeMessage 只保留错误类型的短描述，禁止携带密钥/URL 参数
func sanitizeProbeMessage(msg string) string {
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return ""
	}
	// 单行化，去掉可能包含的敏感 header/URL
	msg = strings.ReplaceAll(msg, "\n", " ")
	msg = strings.ReplaceAll(msg, "\r", " ")
	if len(msg) > 200 {
		runes := []rune(msg)
		if len(runes) > 200 {
			msg = string(runes[:200])
		}
	}
	return msg
}

