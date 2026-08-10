package service

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"

	box "github.com/sagernet/sing-box"
	"github.com/sagernet/sing-box/option"
	singJson "github.com/sagernet/sing/common/json"
	M "github.com/sagernet/sing/common/metadata"
	singNet "github.com/sagernet/sing/common/network"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

type SingBoxDialer struct {
	box     *box.Box
	dialer  func(context.Context, string, M.Socksaddr) (net.Conn, error)
	closeMu sync.Once
}

func BuildSingBoxDialer(outboundJSON json.RawMessage) (*SingBoxDialer, error) {
	optsJSON, err := buildOptionsJSON(outboundJSON)
	if err != nil {
		return nil, fmt.Errorf("build options: %w", err)
	}

	ctx := newProxyBoxContext(context.Background())
	var opts option.Options
	if err := singJson.UnmarshalContext(ctx, optsJSON, &opts); err != nil {
		return nil, fmt.Errorf("parse options: %w", err)
	}

	instance, err := box.New(box.Options{
		Context: ctx,
		Options: opts,
	})
	if err != nil {
		return nil, fmt.Errorf("new box: %w", err)
	}
	if err := instance.Start(); err != nil {
		instance.Close()
		return nil, fmt.Errorf("start box: %w", err)
	}

	defaultOut := instance.Outbound().Default()
	if defaultOut == nil {
		instance.Close()
		return nil, fmt.Errorf("no default outbound")
	}

	dialer, ok := defaultOut.(singNet.Dialer)
	if !ok {
		instance.Close()
		return nil, fmt.Errorf("outbound %T does not implement singNet.Dialer", defaultOut)
	}

	return &SingBoxDialer{
		box:    instance,
		dialer: dialer.DialContext,
	}, nil
}

// DialContext implements the http.Transport.DialContext signature by
// wrapping the sing-box dialer's Socksaddr-based interface.
func (d *SingBoxDialer) DialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	socksaddr := M.ParseSocksaddr(addr)
	return d.dialer(ctx, network, socksaddr)
}

func (d *SingBoxDialer) Close() error {
	var err error
	d.closeMu.Do(func() {
		done := make(chan struct{})
		go func() {
			err = d.box.Close()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(10 * time.Second):
			err = fmt.Errorf("sing-box close timed out")
		}
	})
	return err
}

type outboundConfigFields struct {
	Type             string `json:"type"`
	Server           string `json:"server"`
	ServerPort       int    `json:"server_port"`
	UUID             string `json:"uuid,omitempty"`
	Password         string `json:"password,omitempty"`
	Flow             string `json:"flow,omitempty"`
	Encryption       string `json:"encryption,omitempty"`
	Method           string `json:"method,omitempty"`
	Network          string `json:"network,omitempty"`
	PacketEncoding   string `json:"packet_encoding,omitempty"`
	Masquerade       string `json:"masquerade,omitempty"`
	Obfs             string `json:"obfs,omitempty"`
	ObfsPassword     string `json:"obfs_password,omitempty"`
	HopPorts         string `json:"hop_ports,omitempty"`
	TLSEnabled       bool   `json:"tls_enabled,omitempty"`
	TLSServerName    string `json:"tls_server_name,omitempty"`
	TransportType    string `json:"transport_type,omitempty"`
	TransportPath    string `json:"transport_path,omitempty"`
	TransportHost    string `json:"transport_host,omitempty"`
	TransportService string `json:"transport_service_name,omitempty"`
	Transport        *struct {
		Type        string            `json:"type,omitempty"`
		Path        string            `json:"path,omitempty"`
		Headers     map[string]string `json:"headers,omitempty"`
		ServiceName string            `json:"service_name,omitempty"`
	} `json:"transport,omitempty"`
}

func buildOptionsJSON(outboundJSON json.RawMessage) ([]byte, error) {
	var cfg outboundConfigFields
	if err := common.Unmarshal(outboundJSON, &cfg); err != nil {
		return nil, err
	}

	if cfg.TransportType == "" && cfg.Transport != nil {
		cfg.TransportType = cfg.Transport.Type
		cfg.TransportPath = cfg.Transport.Path
		cfg.TransportService = cfg.Transport.ServiceName
		if cfg.Transport.Headers != nil {
			if host, ok := cfg.Transport.Headers["Host"]; ok {
				cfg.TransportHost = host
			}
		}
	}

	outbound := map[string]interface{}{
		"type": cfg.Type,
		"tag":  "proxy",
	}

	if cfg.Server != "" {
		outbound["server"] = cfg.Server
	}
	if cfg.ServerPort > 0 {
		outbound["server_port"] = cfg.ServerPort
	}

	switch cfg.Type {
	case "vless":
		outbound["uuid"] = cfg.UUID
		if cfg.Flow != "" {
			outbound["flow"] = cfg.Flow
		}
		if cfg.PacketEncoding != "" {
			outbound["packet_encoding"] = cfg.PacketEncoding
		}
		setNetwork(outbound, cfg.Network)
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
		setV2RayTransport(outbound, cfg.TransportType, cfg.TransportPath, cfg.TransportHost, cfg.TransportService)
	case "vmess":
		outbound["uuid"] = cfg.UUID
		setNetwork(outbound, cfg.Network)
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
		setV2RayTransport(outbound, cfg.TransportType, cfg.TransportPath, cfg.TransportHost, cfg.TransportService)
	case "trojan":
		outbound["password"] = cfg.Password
		setNetwork(outbound, cfg.Network)
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
		setV2RayTransport(outbound, cfg.TransportType, cfg.TransportPath, cfg.TransportHost, cfg.TransportService)
	case "shadowsocks":
		method := cfg.Method
		if method == "" {
			method = cfg.Encryption
		}
		outbound["method"] = method
		outbound["password"] = cfg.Password
	case "socks5", "socks":
		outbound["type"] = "socks"
		if cfg.Password != "" {
			outbound["password"] = cfg.Password
		}
	case "http":
		if cfg.Password != "" {
			outbound["password"] = cfg.Password
		}
	case "ssh":
		if cfg.Password != "" {
			outbound["private_key"] = cfg.Password
		}
	case "hysteria2":
		if cfg.Password != "" {
			outbound["password"] = cfg.Password
		}
		if cfg.Masquerade != "" {
			outbound["masquerade"] = cfg.Masquerade
		}
		if cfg.Obfs != "" {
			outbound["obfs"] = cfg.Obfs
		}
		if cfg.ObfsPassword != "" {
			outbound["obfs_password"] = cfg.ObfsPassword
		}
		if cfg.HopPorts != "" {
			outbound["hop_ports"] = cfg.HopPorts
		}
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
	case "tuic":
		outbound["uuid"] = cfg.UUID
		if cfg.Password != "" {
			outbound["password"] = cfg.Password
		}
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
	case "shadowtls":
		outbound["password"] = cfg.Password
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
	case "anytls":
		outbound["password"] = cfg.Password
		setTLS(outbound, cfg.TLSEnabled, cfg.TLSServerName)
	}

	opts := map[string]interface{}{
		"outbounds": []interface{}{outbound},
		"route":     map[string]interface{}{"final": "proxy"},
		"dns":       map[string]interface{}{},
	}
	return common.Marshal(opts)
}

func setNetwork(outbound map[string]interface{}, network string) {
	switch network {
	case "tcp", "udp":
		outbound["network"] = network
	}
}

func setTLS(outbound map[string]interface{}, enabled bool, serverName string) {
	if !enabled {
		return
	}
	tls := map[string]interface{}{"enabled": true}
	if serverName != "" {
		tls["server_name"] = serverName
	}
	outbound["tls"] = tls
}

func setV2RayTransport(outbound map[string]interface{}, transType, path, host, serviceName string) {
	if transType == "" {
		return
	}
	var transport map[string]interface{}
	switch transType {
	case "ws":
		transport = map[string]interface{}{
			"type": "ws",
			"path": path,
		}
		if host != "" {
			transport["headers"] = map[string]interface{}{"Host": host}
		}
	case "grpc":
		transport = map[string]interface{}{
			"type":         "grpc",
			"service_name": serviceName,
		}
	case "quic":
		transport = map[string]interface{}{"type": "quic"}
	case "http":
		transport = map[string]interface{}{
			"type": "http",
			"path": path,
		}
		if host != "" {
			transport["host"] = []string{host}
		}
	case "httpupgrade":
		transport = map[string]interface{}{
			"type": "httpupgrade",
			"path": path,
		}
		if host != "" {
			transport["host"] = host
		}
	}
	if transport != nil {
		outbound["transport"] = transport
	}
}

func outboundFingerprint() (string, json.RawMessage) {
	if model.DB == nil {
		return "", nil
	}
	var opt model.Option
	if err := model.DB.Where("key = ?", "proxy_config").First(&opt).Error; err != nil {
		return "", nil
	}
	// Extract the outbound field as raw JSON directly from the persisted
	// Option value. The controller stores transport headers under
	// "transport.headers"; round-tripping through the service's OutboundConfig
	// struct would drop them (it only models a flat Host), silently losing
	// WebSocket/gRPC transport settings when the dialer rebuilds.
	var enabled bool
	var outboundRaw json.RawMessage
	if err := common.Unmarshal([]byte(opt.Value), &struct {
		Enabled  bool            `json:"enabled"`
		Outbound json.RawMessage `json:"outbound"`
	}{Enabled: enabled, Outbound: outboundRaw}); err != nil {
		return "", nil
	}
	if !enabled {
		return "", nil
	}
	h := sha256.Sum256(outboundRaw)
	return fmt.Sprintf("%x", h[:16]), outboundRaw
}

type singBoxDialerCache struct {
	mu          sync.RWMutex
	fingerprint string
	dialer      *SingBoxDialer
}

var globalSingBoxDialer singBoxDialerCache

func getSingBoxDialer() (*SingBoxDialer, error) {
	fp, raw := outboundFingerprint()
	if fp == "" || raw == nil {
		return nil, nil
	}

	globalSingBoxDialer.mu.RLock()
	if globalSingBoxDialer.fingerprint == fp && globalSingBoxDialer.dialer != nil {
		d := globalSingBoxDialer.dialer
		globalSingBoxDialer.mu.RUnlock()
		return d, nil
	}
	globalSingBoxDialer.mu.RUnlock()

	newDialer, err := BuildSingBoxDialer(raw)
	if err != nil {
		logger.LogError(context.Background(), "sing-box dialer rebuild failed: "+err.Error())
		globalSingBoxDialer.mu.RLock()
		d := globalSingBoxDialer.dialer
		globalSingBoxDialer.mu.RUnlock()
		if d != nil {
			return d, fmt.Errorf("sing-box dialer rebuild failed, using previous: %w", err)
		}
		return nil, err
	}

	globalSingBoxDialer.mu.Lock()
	old := globalSingBoxDialer.dialer
	globalSingBoxDialer.fingerprint = fp
	globalSingBoxDialer.dialer = newDialer
	globalSingBoxDialer.mu.Unlock()

	if old != nil {
		old.Close()
	}
	return newDialer, nil
}

func CloseSingBoxDialer() {
	globalSingBoxDialer.mu.Lock()
	d := globalSingBoxDialer.dialer
	globalSingBoxDialer.dialer = nil
	globalSingBoxDialer.fingerprint = ""
	globalSingBoxDialer.mu.Unlock()
	if d != nil {
		d.Close()
	}
}

func resetSingBoxDialerForTest() {
	globalSingBoxDialer.mu.Lock()
	globalSingBoxDialer.fingerprint = ""
	globalSingBoxDialer.dialer = nil
	globalSingBoxDialer.mu.Unlock()
}
