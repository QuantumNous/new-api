package groksubscription

import "testing"

func TestIsAllowedTextHost(t *testing.T) {
	if !IsAllowedTextHost(HostCLIProxy) {
		t.Fatalf("cli proxy host must be allowed for text")
	}
	for _, bad := range []string{"evil.com", "cli-chat-proxy.grok.com.evil.com", "api.x.ai.attacker.net", ""} {
		if IsAllowedTextHost(bad) {
			t.Fatalf("host %q must not be allowed", bad)
		}
	}
	// 里程碑 A 文本只走 CLI proxy：其它上游 allowlist host（OAuth/API 主机）
	// 对文本必须被拒，防止把 Bearer/CLI identity 发到非 CLI proxy 端点。
	for _, notText := range []string{HostAuth, HostAccounts, HostAPI, HostAPIUSEast, HostAPIUSWest, HostAPIEUWest} {
		if IsAllowedTextHost(notText) {
			t.Fatalf("upstream host %q must NOT be allowed for text (only CLI proxy)", notText)
		}
	}
}

func TestIsAllowedUpstreamHost(t *testing.T) {
	for _, ok := range []string{HostAuth, HostAccounts, HostCLIProxy, HostAPI, HostAPIUSEast, HostAPIUSWest, HostAPIEUWest} {
		if !IsAllowedUpstreamHost(ok) {
			t.Fatalf("host %q must be allowed", ok)
		}
	}
	for _, bad := range []string{"grok.com", "x.ai", "notapi.x.ai", "api.x.ai:8080"} {
		if IsAllowedUpstreamHost(bad) {
			t.Fatalf("host %q must not be allowed", bad)
		}
	}
}
