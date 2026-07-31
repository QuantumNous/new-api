package common

import (
	"net/url"
	"strings"
)

// IsSafeRedirect 校验重定向目标是否安全，防止开放重定向（Open Redirect）。
// 允许：空串（无重定向）、同源相对路径（以 / 开头且非协议相对 //host）、指向已知官方域名。
func IsSafeRedirect(u string) bool {
	u = strings.TrimSpace(u)
	if u == "" {
		return true
	}
	// 相对路径，但排除协议相对地址（//evil.com）
	if strings.HasPrefix(u, "/") {
		return !strings.HasPrefix(u, "//")
	}
	parsed, err := url.Parse(u)
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	host := parsed.Host
	return host == "91flow.com" || strings.HasSuffix(host, ".91flow.com")
}
