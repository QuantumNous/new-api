package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ProxyConfig holds the sing-box global proxy configuration stored in the
// Option table under the "proxy_config" key.
type ProxyConfig struct {
	Outbound       OutboundConfig `json:"outbound"`
	GlobalProxyURL string         `json:"global_proxy_url"`
	Enabled        bool           `json:"enabled"`
}

// OutboundConfig describes the sing-box outbound parameters entered on the
// admin proxy page. It is stored as JSON and rendered into singbox-config.json.
type OutboundConfig struct {
	Type           string            `json:"type"`
	Server         string            `json:"server"`
	ServerPort     int               `json:"server_port"`
	UUID           string            `json:"uuid,omitempty"`
	Password       string            `json:"password,omitempty"`
	Flow           string            `json:"flow,omitempty"`
	Encryption     string            `json:"encryption,omitempty"`
	Method         string            `json:"method,omitempty"`
	Network        string            `json:"network,omitempty"`
	PacketEncoding string            `json:"packet_encoding,omitempty"`
	Masquerade     string            `json:"masquerade,omitempty"`
	Obfs           string            `json:"obfs,omitempty"`
	ObfsPassword   string            `json:"obfs_password,omitempty"`
	HopPorts       string            `json:"hop_ports,omitempty"`
	TLSEnabled     bool              `json:"tls_enabled,omitempty"`
	TLSServerName  string            `json:"tls_server_name,omitempty"`
	Transport      *transportOptions `json:"transport,omitempty"`
}

type transportOptions struct {
	Type        string `json:"type,omitempty"`
	Path        string `json:"path,omitempty"`
	Host        string `json:"host,omitempty"`
	ServiceName string `json:"service_name,omitempty"`
	Security    string `json:"security,omitempty"`
	Key         string `json:"key,omitempty"`
}

// getGlobalProxyURL returns the global proxy URL from the database, or "" when
// global proxying is not configured or disabled. It reads the Option table
// directly (bypassing the in-memory OptionMap cache) so every new-api instance
// observes configuration changes on the next request.
func getGlobalProxyURL() string {
	var option model.Option
	if err := model.DB.Where("key = ?", "proxy_config").First(&option).Error; err != nil {
		return ""
	}
	var cfg ProxyConfig
	if err := common.Unmarshal([]byte(option.Value), &cfg); err != nil {
		return ""
	}
	if !cfg.Enabled {
		return ""
	}
	return cfg.GlobalProxyURL
}
