package controller

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// ProxyConfigRequest is the JSON shape for saving proxy configuration.
type ProxyConfigRequest struct {
	Outbound       OutboundConfig `json:"outbound"`
	GlobalProxyURL string         `json:"global_proxy_url"`
	Enabled        bool           `json:"enabled"`
}

// OutboundConfig mirrors service.OutboundConfig so the controller can
// accept and marshal proxy configuration without importing service.
type OutboundConfig struct {
	Type           string `json:"type"`
	Server         string `json:"server"`
	ServerPort     int    `json:"server_port"`
	UUID           string `json:"uuid,omitempty"`
	Password       string `json:"password,omitempty"`
	Flow           string `json:"flow,omitempty"`
	Encryption     string `json:"encryption,omitempty"`
	Method         string `json:"method,omitempty"`
	Network        string `json:"network,omitempty"`
	PacketEncoding string `json:"packet_encoding,omitempty"`
	Masquerade     string `json:"masquerade,omitempty"`
	Obfs           string `json:"obfs,omitempty"`
	ObfsPassword   string `json:"obfs_password,omitempty"`
	HopPorts       string `json:"hop_ports,omitempty"`
	TLSEnabled     bool   `json:"tls_enabled,omitempty"`
	TLSServerName  string `json:"tls_server_name,omitempty"`
	// Flat transport fields (frontend form) mapped to the nested Transport
	// struct on save.
	TransportType    string            `json:"transport_type,omitempty"`
	TransportPath    string            `json:"transport_path,omitempty"`
	TransportHost    string            `json:"transport_host,omitempty"`
	TransportService string            `json:"transport_service_name,omitempty"`
	Transport        *transportOptions `json:"transport,omitempty"`
}

// singBoxConfig is the complete sing-box JSON configuration structure.
type singBoxConfig struct {
	Log       logConfig       `json:"log"`
	Inbounds  []inboundConfig `json:"inbounds"`
	Outbounds []outboundCfg   `json:"outbounds"`
	Route     routeConfig     `json:"route"`
}

type logConfig struct {
	Level string `json:"level"`
}

type inboundConfig struct {
	Type string       `json:"type"`
	Tag  string       `json:"tag"`
	ListenOptions     `json:",inline"`
}

type ListenOptions struct {
	Listen     string `json:"listen"`
	ListenPort int    `json:"listen_port"`
}

type outboundCfg struct {
	Type string      `json:"type"`
	Tag  string      `json:"tag"`
	Options          `json:",inline,omitempty"`
}

type Options struct {
	Server         string            `json:"server,omitempty"`
	ServerPort     int               `json:"server_port,omitempty"`
	UUID           string            `json:"uuid,omitempty"`
	Password       string            `json:"password,omitempty"`
	Flow           string            `json:"flow,omitempty"`
	Encryption     string            `json:"encryption,omitempty"`
	Method         string            `json:"method,omitempty"`          // Shadowsocks 专用
	Network        string            `json:"network,omitempty"`         // tcp/udp
	PacketEncoding string            `json:"packet_encoding,omitempty"` // VLESS 专用
	Masquerade     string            `json:"masquerade,omitempty"`      // Hysteria2 专用
	Obfs           string            `json:"obfs,omitempty"`            // Hysteria2 专用
	ObfsPassword   string            `json:"obfs_password,omitempty"`
	HopPorts       string            `json:"hop_ports,omitempty"` // Hysteria2 专用
	TLS            *tlsCfg           `json:"tls,omitempty"`
	Transport      *transportOptions `json:"transport,omitempty"` // V2Ray 传输层
}

type transportOptions struct {
	Type        string            `json:"type,omitempty"`         // ws/kcp/quic/grpc
	Path        string            `json:"path,omitempty"`         // WebSocket path
	Headers     map[string]string `json:"headers,omitempty"`      // WebSocket headers (Host)
	ServiceName string            `json:"service_name,omitempty"` // gRPC service name
	Security    string            `json:"security,omitempty"`     // quic security
	Key         string            `json:"key,omitempty"`
}

type tlsCfg struct {
	Enabled    bool   `json:"enabled"`
	ServerName string `json:"server_name,omitempty"`
}

type routeConfig struct {
	Final string `json:"final"`
}

// GetProxyConfig returns the current proxy configuration and global proxy URL.
func GetProxyConfig(c *gin.Context) {
	var opt model.Option
	if err := model.DB.Where("key = ?", "proxy_config").First(&opt).Error; err != nil {
		common.ApiSuccess(c, gin.H{
			"enabled":          false,
			"outbound":         nil,
			"global_proxy_url": "",
		})
		return
	}
	var cfg ProxyConfigRequest
	if err := common.Unmarshal([]byte(opt.Value), &cfg); err != nil {
		common.ApiErrorMsg(c, "invalid proxy config in database")
		return
	}
	common.ApiSuccess(c, cfg)
}

// UpdateProxyConfig saves the proxy configuration to the Option table.
func UpdateProxyConfig(c *gin.Context) {
	var req ProxyConfigRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	// Map flat transport fields to the nested Transport struct.
	if t := req.Outbound.TransportType; t != "" {
		headers := map[string]string{}
		if req.Outbound.TransportHost != "" {
			headers["Host"] = req.Outbound.TransportHost
		}
		req.Outbound.Transport = &transportOptions{
			Type:        t,
			Path:        req.Outbound.TransportPath,
			Headers:     headers,
			ServiceName: req.Outbound.TransportService,
		}
	}
	// Validate the outbound against an in-process sing-box build before
	// persisting. A failed validation prevents the Option update.
	if req.Enabled {
		outboundJSON, err := common.Marshal(req.Outbound)
		if err != nil {
			common.ApiErrorMsg(c, "failed to marshal outbound config")
			return
		}
		validationDialer, err := service.BuildSingBoxDialer(outboundJSON)
		if err != nil {
			common.ApiErrorMsg(c, "invalid sing-box outbound configuration: "+err.Error())
			return
		}
		_ = validationDialer.Close()
	}

	jsonBytes, err := common.Marshal(req)
	if err != nil {
		common.ApiErrorMsg(c, "failed to marshal config")
		return
	}
	if err := model.UpdateOption("proxy_config", string(jsonBytes)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// GenerateProxyConfig returns a complete sing-box config.json for the current
// proxy configuration. It uses encoding/json directly (no sing-box dependency).
func GenerateProxyConfig(c *gin.Context) {
	var opt model.Option
	if err := model.DB.Where("key = ?", "proxy_config").First(&opt).Error; err != nil {
		common.ApiErrorMsg(c, "proxy not configured")
		return
	}
	var cfg ProxyConfigRequest
	if err := common.Unmarshal([]byte(opt.Value), &cfg); err != nil {
		common.ApiErrorMsg(c, "invalid proxy config")
		return
	}
	if !cfg.Enabled {
		common.ApiErrorMsg(c, "proxy is disabled")
		return
	}

	// Determine network (tcp/udp) and transport config.
	net := cfg.Outbound.Network
	if net == "" || net == "ws" || net == "kcp" || net == "quic" || net == "grpc" {
		net = "tcp" // transport type goes into Transport.Type, not Network
	}

	tlsEnabled := cfg.Outbound.TLSEnabled

	// Build transport options if transport type is set.
	var transport *transportOptions
	if cfg.Outbound.Transport != nil && cfg.Outbound.Transport.Type != "" {
		transport = cfg.Outbound.Transport
	}

	// Build base options shared by most protocols.
	baseOpts := Options{
		Server:     cfg.Outbound.Server,
		ServerPort: cfg.Outbound.ServerPort,
		Network:    net,
		Transport:  transport,
	}
	if tlsEnabled {
		baseOpts.TLS = &tlsCfg{
			Enabled:    true,
			ServerName: cfg.Outbound.TLSServerName,
		}
	}

	var outbound outboundCfg
	switch cfg.Outbound.Type {
	case "vless":
		outbound = outboundCfg{Type: "vless", Tag: "proxy", Options: Options{
			UUID:           cfg.Outbound.UUID,
			Flow:           cfg.Outbound.Flow,
			PacketEncoding: cfg.Outbound.PacketEncoding,
			Server:         baseOpts.Server,
			ServerPort:     baseOpts.ServerPort,
			Network:        baseOpts.Network,
			Transport:      baseOpts.Transport,
			TLS:            baseOpts.TLS,
		}}
	case "vmess":
		outbound = outboundCfg{Type: "vmess", Tag: "proxy", Options: Options{
			UUID:       cfg.Outbound.UUID,
			Server:     baseOpts.Server,
			ServerPort: baseOpts.ServerPort,
			Network:    baseOpts.Network,
			Transport:  baseOpts.Transport,
			TLS:        baseOpts.TLS,
		}}
	case "trojan":
		outbound = outboundCfg{Type: "trojan", Tag: "proxy", Options: Options{
			Password:   cfg.Outbound.Password,
			Server:     baseOpts.Server,
			ServerPort: baseOpts.ServerPort,
			Network:    baseOpts.Network,
			Transport:  baseOpts.Transport,
			TLS:        baseOpts.TLS,
		}}
	case "shadowsocks":
		method := cfg.Outbound.Method
		if method == "" {
			method = cfg.Outbound.Encryption
		}
		outbound = outboundCfg{Type: "shadowsocks", Tag: "proxy", Options: Options{
			Method:     method,
			Password:   cfg.Outbound.Password,
			Server:     baseOpts.Server,
			ServerPort: baseOpts.ServerPort,
			Transport:  baseOpts.Transport,
		}}
	case "hysteria2":
		outbound = outboundCfg{Type: "hysteria2", Tag: "proxy", Options: Options{
			Password:     cfg.Outbound.Password,
			Masquerade:   cfg.Outbound.Masquerade,
			Obfs:         cfg.Outbound.Obfs,
			ObfsPassword: cfg.Outbound.ObfsPassword,
			HopPorts:     cfg.Outbound.HopPorts,
			Server:       baseOpts.Server,
			ServerPort:   baseOpts.ServerPort,
			Transport:    baseOpts.Transport,
			TLS:          baseOpts.TLS,
		}}
	case "tuic":
		outbound = outboundCfg{Type: "tuic", Tag: "proxy", Options: Options{
			UUID:       cfg.Outbound.UUID,
			Password:   cfg.Outbound.Password,
			Server:     baseOpts.Server,
			ServerPort: baseOpts.ServerPort,
			Transport:  baseOpts.Transport,
			TLS:        baseOpts.TLS,
		}}
	case "socks5", "http":
		outbound = outboundCfg{Type: cfg.Outbound.Type, Tag: "proxy", Options: Options{
			Server:     baseOpts.Server,
			ServerPort: baseOpts.ServerPort,
			Password:   cfg.Outbound.Password,
		}}
	default:
		outbound = outboundCfg{Type: cfg.Outbound.Type, Tag: "proxy", Options: Options{
			Server:     baseOpts.Server,
			ServerPort: baseOpts.ServerPort,
		}}
	}

	config := singBoxConfig{
		Log: logConfig{Level: "info"},
		Inbounds: []inboundConfig{{
			Type: "socks",
			Tag:  "socks-in",
			ListenOptions: ListenOptions{
				Listen:     "0.0.0.0",
				ListenPort: 1080,
			},
		}},
		Outbounds: []outboundCfg{
			outbound,
			{Type: "direct", Tag: "direct"},
		},
		Route: routeConfig{Final: "proxy"},
	}

	jsonBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		common.ApiErrorMsg(c, "failed to generate config")
		return
	}
	common.ApiSuccess(c, gin.H{
		"config_json": string(jsonBytes),
	})
}

// GetProxyStatus checks whether the local proxy port (127.0.0.1:1080) is reachable.
func GetProxyStatus(c *gin.Context) {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:1080", 3*time.Second)
	if err != nil {
		common.ApiSuccess(c, gin.H{
			"running": false,
			"error":   err.Error(),
		})
		return
	}
	conn.Close()
	common.ApiSuccess(c, gin.H{
		"running": true,
	})
}

// ReloadProxy sends SIGHUP to the sing-box container for hot reload.
func ReloadProxy(c *gin.Context) {
	containerName := os.Getenv("SINGBOX_CONTAINER_NAME")
	if containerName == "" {
		containerName = "sing-box-new-api"
	}
	cmd := exec.Command("docker", "kill", "-s", "HUP", containerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		common.ApiSuccess(c, gin.H{
			"success": false,
			"message": fmt.Sprintf("热加载失败（%v），请手动执行：docker kill -s HUP %s", err, containerName),
			"output":  string(output),
		})
		return
	}
	common.ApiSuccess(c, gin.H{
		"success": true,
		"message": "热加载成功",
	})
}
