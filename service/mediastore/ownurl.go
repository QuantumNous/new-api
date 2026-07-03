package mediastore

import (
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/setting/system_setting"
)

// OwnOBSHost 返回我方 OBS 对象的 virtual-hosted 主机名 <bucket>.<endpointHost>；
// 仅当媒体存储已启用且 endpoint / bucket 均已配置时返回，否则返回 ""。
//
// 用于 SSRF 校验的私网放行：只放松「该 host 解析到私网」这一条（scheme/端口仍强制），
// 且严格绑定我方桶的 virtual-hosted host（obs_store 用 UsePathStyle=false，签名 URL 即此形态）——
// 不放行裸 endpoint（避免放行该 endpoint 上的其它桶/列举），并随媒体存储关闭而失效
// （Endpoint 残留也不再授信）。
func OwnOBSHost() string {
	if !Enabled() {
		return ""
	}
	s := system_setting.GetMediaStorageSettings()
	epHost := normalizeHost(s.Endpoint)
	if epHost == "" || s.Bucket == "" {
		return ""
	}
	return s.Bucket + "." + epHost
}

// IsOwnOBSURL 判断 url 是否指向我方 OBS（endpoint 或 <bucket>.<endpoint>，精确 host 匹配，
// 不做子串匹配）。用于第三方图片改写时跳过已是我方 OBS 的项（调用方已在 Enabled 分支内，
// 该场景只影响是否重复搬运，故放宽到也匹配裸 endpoint 无安全影响）。
func IsOwnOBSURL(rawURL string) bool {
	s := system_setting.GetMediaStorageSettings()
	host := normalizeHost(rawURL)
	epHost := normalizeHost(s.Endpoint)
	if host == "" || epHost == "" {
		return false
	}
	if strings.EqualFold(host, epHost) {
		return true
	}
	return s.Bucket != "" && strings.EqualFold(host, s.Bucket+"."+epHost)
}

// normalizeHost 从 endpoint / URL 中健壮地取出纯主机名：补 scheme 以兼容无 scheme 的
// host、host:port、host/path 等配置形态，返回去掉 scheme、端口、路径后的 host。
func normalizeHost(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return u.Hostname()
}
