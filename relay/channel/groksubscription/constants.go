package groksubscription

import (
	"os"
	"strconv"
	"strings"
)

// 固定 OAuth 参数（设计 §7）。
const (
	OAuthIssuer      = "https://auth.x.ai"
	OAuthAuthorize   = "https://auth.x.ai/oauth2/authorize"
	OAuthToken       = "https://auth.x.ai/oauth2/token"
	OAuthClientID    = "b1a00492-073a-47ea-816f-4c329264a828"
	OAuthScope       = "openid profile email offline_access grok-cli:access api:access"
	OAuthRedirectURI = "http://127.0.0.1:56121/callback"
	OAuthPlan        = "generic"
	OAuthReferrer    = "sub2api"
)

// 固定上游 host（设计 §8.1）。里程碑 A 只用 CLI proxy 做文本。
const (
	HostAuth      = "auth.x.ai"
	HostAccounts  = "accounts.x.ai"
	HostCLIProxy  = "cli-chat-proxy.grok.com"
	HostAPI       = "api.x.ai"
	HostAPIUSEast = "us-east-1.api.x.ai"
	HostAPIUSWest = "us-west-2.api.x.ai"
	HostAPIEUWest = "eu-west-1.api.x.ai"
)

// CLI proxy base 与 responses 路径。
const (
	CLIProxyBase     = "https://cli-chat-proxy.grok.com"
	CLIResponsesPath = "/v1/responses"
)

// CLI identity headers（设计 §8.2）。仅发往 CLI proxy。
const (
	CLIClientVersionDefault = "0.2.114"
	CLIClientVersionMin     = "0.2.93"
	HeaderXAITokenAuth      = "X-XAI-Token-Auth"
	HeaderXAITokenAuthValue = "xai-grok-cli"
	HeaderGrokClientVersion = "x-grok-client-version"
	HeaderGrokClientID      = "x-grok-client-identifier"
	GrokClientIDValue       = "grok-shell"
	CLIUserAgentPrefix      = "xai-grok-workspace/"
)

// ChannelName 用于 adaptor 标识。
const ChannelName = "grok_subscription"

// DefaultModelList 首次创建渠道时的已知 Grok 默认模型（DB 渠道模型列表仍是最终路由依据，设计 §5.3）。
// 仅预填当前活跃且已配置计费的旗舰模型。原 grok-4 / grok-4-fast / grok-3 / grok-3-mini
// 均在 2026-05-15 被 xAI 退役（仅存重定向），已移除以免预填出无法计费的死模型。
var DefaultModelList = []string{
	"grok-4.6",
}

// CLIClientVersion 读环境变量覆盖，校验 semver 且不低于 CLIClientVersionMin，非法回退默认。
func CLIClientVersion() string {
	v := os.Getenv("GROK_CLI_CLIENT_VERSION")
	if isValidCLIVersion(v) {
		return v
	}
	return CLIClientVersionDefault
}

// isValidCLIVersion 要求 v 是合法三段 semver 且不低于 CLIClientVersionMin。
func isValidCLIVersion(v string) bool {
	return compareSemver(v, CLIClientVersionMin) >= 0
}

// compareSemver 比较两个 MAJOR.MINOR.PATCH 版本。
// 返回 <0 表示 a<b（或 a 非法），0 表示相等，>0 表示 a>b。
func compareSemver(a, b string) int {
	av, aok := parseSemver(a)
	if !aok {
		return -1
	}
	bv, bok := parseSemver(b)
	if !bok {
		return 1
	}
	for i := 0; i < 3; i++ {
		if av[i] != bv[i] {
			if av[i] < bv[i] {
				return -1
			}
			return 1
		}
	}
	return 0
}

// parseSemver 仅接受精确三段非负整数版本 MAJOR.MINOR.PATCH。
func parseSemver(v string) ([3]int, bool) {
	var out [3]int
	parts := strings.Split(v, ".")
	if len(parts) != 3 {
		return out, false
	}
	for i, p := range parts {
		if p == "" {
			return out, false
		}
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}
