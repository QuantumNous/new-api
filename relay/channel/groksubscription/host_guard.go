package groksubscription

// allowedUpstreamHosts 是完整 host allowlist（设计 §8.1）。
// api.yescaptcha.com 仅密码功能开启时用，由 service 层单独校验，不在通用 allowlist。
var allowedUpstreamHosts = map[string]struct{}{
	HostAuth:      {},
	HostAccounts:  {},
	HostCLIProxy:  {},
	HostAPI:       {},
	HostAPIUSEast: {},
	HostAPIUSWest: {},
	HostAPIEUWest: {},
}

// IsAllowedUpstreamHost 精确匹配（含端口视为不同 host，拒绝）。
func IsAllowedUpstreamHost(host string) bool {
	_, ok := allowedUpstreamHosts[host]
	return ok
}

// IsAllowedTextHost 里程碑 A 文本只允许 CLI proxy。
func IsAllowedTextHost(host string) bool {
	return host == HostCLIProxy
}
