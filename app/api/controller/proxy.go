package controller

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
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
	Type          string `json:"type"`
	Tag           string `json:"tag"`
	ListenOptions `json:",inline"`
}

type ListenOptions struct {
	Listen     string `json:"listen"`
	ListenPort int    `json:"listen_port"`
}

type outboundCfg struct {
	Type    string `json:"type"`
	Tag     string `json:"tag"`
	Options `json:",inline,omitempty"`
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

type proxyNodeRequest struct {
	Name       string `json:"name"`
	Enabled    bool   `json:"enabled"`
	Proxy      string `json:"proxy"`
	ScopeType  string `json:"scope_type"`
	ScopeValue string `json:"scope_value"`
}

type proxyNodeUpdateRequest struct {
	Name       string  `json:"name"`
	Enabled    bool    `json:"enabled"`
	Proxy      *string `json:"proxy"`
	ScopeType  string  `json:"scope_type"`
	ScopeValue string  `json:"scope_value"`
}

type proxyNodeBatchRequest struct {
	NamePrefix string   `json:"name_prefix"`
	Enabled    bool     `json:"enabled"`
	ProxyText  string   `json:"proxy_text"`
	ProxyURLs  []string `json:"proxy_urls"`
	ScopeType  string   `json:"scope_type"`
	ScopeValue string   `json:"scope_value"`
}

type proxyNodeBatchEnabledRequest struct {
	IDs     []uint `json:"ids"`
	Enabled bool   `json:"enabled"`
}

type proxyNodeBatchClearErrorsRequest struct {
	IDs []uint `json:"ids"`
}

func ListProxyNodes(c *gin.Context) {
	var nodes []model.ProxyNode
	query := model.DB
	if scopeType := c.Query("scope_type"); scopeType != "" {
		query = query.Where("scope_type = ?", scopeType)
	}
	if scopeValue := c.Query("scope_value"); scopeValue != "" {
		query = query.Where("scope_value = ?", scopeValue)
	}
	if protocol := c.Query("protocol"); protocol != "" {
		query = query.Where("protocol = ?", protocol)
	}
	order := proxyNodeOrder(c.Query("sort_by"), c.Query("sort_order"))
	if err := query.Order(order).Find(&nodes).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	channelNames := make(map[int]string)
	channelIDs := make([]int, 0)
	for _, node := range nodes {
		if node.ScopeType == model.ProxyNodeScopeChannel {
			if id, parseErr := strconv.Atoi(node.ScopeValue); parseErr == nil {
				channelIDs = append(channelIDs, id)
			}
		}
	}
	if len(channelIDs) > 0 {
		var channels []model.Channel
		if err := model.DB.Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		for _, channel := range channels {
			channelNames[channel.Id] = channel.Name
		}
	}
	items := make([]model.ProxyNodePublic, 0, len(nodes))
	for _, node := range nodes {
		public := node.Public()
		if node.ScopeType == model.ProxyNodeScopeChannel {
			if id, parseErr := strconv.Atoi(node.ScopeValue); parseErr == nil {
				public.ScopeName = channelNames[id]
			}
		}
		probeStats := service.GetProxyNodeProbeStatsFor(node.ID)
		public.ProbeTotal = probeStats.Total
		public.ProbeSuccess = probeStats.Success
		items = append(items, public)
	}
	field := c.Query("sort_by")
	if field == "probe_success_rate" || field == "probe_failure_rate" || field == "probe_count" {
		descending := strings.EqualFold(c.Query("sort_order"), "desc")
		sort.SliceStable(items, func(i, j int) bool {
			left, right := items[i], items[j]
			var leftValue, rightValue float64
			switch field {
			case "probe_count":
				leftValue, rightValue = float64(left.ProbeTotal), float64(right.ProbeTotal)
			case "probe_success_rate":
				leftValue, rightValue = probeRate(left.ProbeSuccess, left.ProbeTotal), probeRate(right.ProbeSuccess, right.ProbeTotal)
			default:
				leftValue, rightValue = probeRate(left.ProbeTotal-left.ProbeSuccess, left.ProbeTotal), probeRate(right.ProbeTotal-right.ProbeSuccess, right.ProbeTotal)
			}
			if leftValue == rightValue {
				if descending {
					return left.ID > right.ID
				}
				return left.ID < right.ID
			}
			if descending {
				return leftValue > rightValue
			}
			return leftValue < rightValue
		})
	}
	common.ApiSuccess(c, items)
}

func BatchCreateProxyNodes(c *gin.Context) {
	var req proxyNodeBatchRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	result, err := service.CreateProxyNodesBatch(service.ProxyNodeInput{
		Enabled: req.Enabled, ScopeType: req.ScopeType, ScopeValue: req.ScopeValue,
	}, req.NamePrefix, req.ProxyText, req.ProxyURLs)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, result)
}

func BatchSetProxyNodesEnabled(c *gin.Context) {
	var req proxyNodeBatchEnabledRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	updated, err := service.SetProxyNodesEnabled(req.IDs, req.Enabled)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"updated": updated})
}

func BatchClearProxyNodeErrors(c *gin.Context) {
	var req proxyNodeBatchClearErrorsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	cleared, err := service.ClearProxyNodeErrors(req.IDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"cleared": cleared})
}

func GetProxyNodeReport(c *gin.Context) {
	var total, enabled, healthy int64
	base := model.DB.Model(&model.ProxyNode{})
	if err := base.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	// Each metric runs on its own fresh query. Reusing one query would
	// accumulate predicates (enabled leaking into the healthy count), same
	// class of bug as GetProxyNodesForChannel — see proxy_node_test.go.
	if err := model.DB.Model(&model.ProxyNode{}).Where("enabled = ?", true).Count(&enabled).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Model(&model.ProxyNode{}).Where("health >= ?", service.ProxyNodeHealthyThreshold).Count(&healthy).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	stats := service.GetProxyNodeProbeStats()
	failed := stats.Total - stats.Success
	common.ApiSuccess(c, gin.H{
		"total":         total,
		"enabled":       enabled,
		"healthy":       healthy,
		"probe_total":   stats.Total,
		"probe_success": stats.Success,
		"probe_failed":  max(int64(0), failed),
		"probe_active":  stats.Active,
		"success_rate":  ratioPercent(stats.Success, stats.Total),
		"failure_rate":  ratioPercent(failed, stats.Total),
	})
}

func GetProxyNode(c *gin.Context) {
	id, err := parseProxyNodeID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid proxy node id")
		return
	}
	var node model.ProxyNode
	if err := model.DB.First(&node, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	parsed, err := service.DecryptProxyNodeConfig(&node)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"node":  node.Public(),
		"proxy": parsed.CanonicalInput,
	})
}
func CreateProxyNode(c *gin.Context) {
	var req proxyNodeRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	node, err := service.CreateProxyNode(service.ProxyNodeInput{
		Name: req.Name, Enabled: req.Enabled, Proxy: req.Proxy, ScopeType: req.ScopeType, ScopeValue: req.ScopeValue,
	})
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, node.Public())
}

func UpdateProxyNode(c *gin.Context) {
	id, err := parseProxyNodeID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid proxy node id")
		return
	}
	var req proxyNodeUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	var node model.ProxyNode
	if err := model.DB.First(&node, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	scopeType, scopeValue, err := model.NormalizeProxyNodeScope(req.ScopeType, req.ScopeValue)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	node.Name, node.Enabled, node.ScopeType, node.ScopeValue = strings.TrimSpace(req.Name), req.Enabled, scopeType, scopeValue
	if req.Proxy != nil && strings.TrimSpace(*req.Proxy) != "" {
		parsed, parseErr := service.ParseProxyNodeShareLink(*req.Proxy)
		if parseErr != nil {
			common.ApiErrorMsg(c, parseErr.Error())
			return
		}
		encrypted, encryptErr := service.EncryptProxyNodeConfigForUpdate(parsed.CanonicalInput)
		if encryptErr != nil {
			common.ApiErrorMsg(c, encryptErr.Error())
			return
		}
		node.Protocol = parsed.Protocol
		node.EncryptedProxyConfig = encrypted
	}
	if node.Name == "" {
		common.ApiErrorMsg(c, "proxy node name must not be empty")
		return
	}
	if err := model.DB.Save(&node).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, node.Public())
}

func DeleteProxyNode(c *gin.Context) {
	id, err := parseProxyNodeID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid proxy node id")
		return
	}
	if err := model.DB.Delete(&model.ProxyNode{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	service.ResetProxyNodeProbeStatsFor(id)
	common.ApiSuccess(c, nil)
}

func TestProxyNode(c *gin.Context) {
	id, err := parseProxyNodeID(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid proxy node id")
		return
	}
	var node model.ProxyNode
	if err := model.DB.First(&node, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	result, probeErr := service.ProbeProxyNode(c.Request.Context(), &node)
	if probeErr != nil {
		common.ApiError(c, probeErr)
		return
	}
	common.ApiSuccess(c, result)
}

func TestAllProxyNodes(c *gin.Context) {
	var nodes []model.ProxyNode
	if err := model.DB.Where("enabled = ?", true).Find(&nodes).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	passed := 0
	for index := range nodes {
		result, err := service.ProbeProxyNode(c.Request.Context(), &nodes[index])
		if err == nil && result.Success {
			passed++
		}
	}
	common.ApiSuccess(c, gin.H{"passed": passed, "failed": len(nodes) - passed, "total": len(nodes)})
}

func parseProxyNodeID(c *gin.Context) (uint, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	return uint(id), err
}

func proxyNodeOrder(field, direction string) string {
	columns := map[string]string{
		"name": "name", "scope": "scope_type", "protocol": "protocol", "health": "health",
	}
	column, ok := columns[field]
	if !ok {
		column = "id"
	}
	if strings.EqualFold(direction, "desc") {
		return column + " DESC, id DESC"
	}
	return column + " ASC, id ASC"
}

func probeRate(value, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return float64(value) / float64(total)
}

func ratioPercent(value, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return float64(value) / float64(total) * 100
}
