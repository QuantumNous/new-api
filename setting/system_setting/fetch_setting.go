package system_setting

import (
	"slices"
	"sync/atomic"

	"github.com/QuantumNous/new-api/setting/config"
)

type FetchSetting struct {
	EnableSSRFProtection   bool     `json:"enable_ssrf_protection"` // 是否启用SSRF防护
	AllowPrivateIp         bool     `json:"allow_private_ip"`
	DomainFilterMode       bool     `json:"domain_filter_mode"`         // 域名过滤模式，true: 白名单模式，false: 黑名单模式
	IpFilterMode           bool     `json:"ip_filter_mode"`             // IP过滤模式，true: 白名单模式，false: 黑名单模式
	DomainList             []string `json:"domain_list"`                // domain format, e.g. example.com, *.example.com
	IpList                 []string `json:"ip_list"`                    // CIDR format
	AllowedPorts           []string `json:"allowed_ports"`              // port range format, e.g. 80, 443, 8000-9000
	ApplyIPFilterForDomain bool     `json:"apply_ip_filter_for_domain"` // 对域名启用IP过滤（实验性）
}

// defaultFetchSetting 是注册给 ConfigManager 的写入目标。配置热更新会用反射原地改写它，
// 其中切片字段是被 encoding/json 复用底层数组、原地重填的，因此它随时可能处于中间状态。
//
// 读路径一律不得读取该变量，必须走 GetFetchSetting() 返回的快照，见 fetchSnapshot。
var defaultFetchSetting = FetchSetting{
	EnableSSRFProtection:   true, // 默认开启SSRF防护
	AllowPrivateIp:         false,
	DomainFilterMode:       false,
	IpFilterMode:           false,
	DomainList:             []string{},
	IpList:                 []string{},
	AllowedPorts:           []string{"80", "443", "8080", "8443"},
	ApplyIPFilterForDomain: true,
}

// fetchSnapshot 持有一份对读者不可变的副本。SSRF 名单是安全控制，读者在遍历它的同时若被
// 原地改写，可能放行本应拒绝的目标，因此这里以整体替换的方式发布，读者始终看到自洽的一份。
var fetchSnapshot atomic.Pointer[FetchSetting]

func init() {
	config.GlobalConfig.Register("fetch_setting", &defaultFetchSetting)
	publishFetchSnapshot()
}

// AfterConfigUpdate 实现 config.PostUpdater，在热更新写完字段后重新发布快照。
func (s *FetchSetting) AfterConfigUpdate() {
	publishFetchSnapshot()
}

func publishFetchSnapshot() {
	snapshot := defaultFetchSetting
	snapshot.DomainList = slices.Clone(defaultFetchSetting.DomainList)
	snapshot.IpList = slices.Clone(defaultFetchSetting.IpList)
	snapshot.AllowedPorts = slices.Clone(defaultFetchSetting.AllowedPorts)
	fetchSnapshot.Store(&snapshot)
}

// GetFetchSetting 返回当前配置的只读快照。返回值不得被调用方修改。
func GetFetchSetting() *FetchSetting {
	return fetchSnapshot.Load()
}
