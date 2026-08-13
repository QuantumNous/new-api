package service

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"unicode"

	"github.com/QuantumNous/new-api/common"
)

const (
	maxProxyNodeInputBytes = 128 * 1024
	maxProxyNodeBatch      = 500
)

type ProxyNodeParsed struct {
	Protocol       string
	OutboundJSON   []byte
	CanonicalInput string
}

func ParseProxyNodeShareLink(raw string) (*ProxyNodeParsed, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, errors.New("proxy node link is empty")
	}
	if len(value) > maxProxyNodeInputBytes || strings.IndexFunc(value, func(r rune) bool { return unicode.IsControl(r) }) >= 0 {
		return nil, errors.New("proxy node link is too long or contains control characters")
	}
	if strings.HasPrefix(value, "{") {
		return parseProxyNodeJSON(value)
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" {
		return nil, errors.New("proxy node link is invalid")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https", "socks5", "socks5h":
		return parseBasicProxyNode(parsed, strings.ToLower(parsed.Scheme))
	case "vless":
		return parseVLESSProxyNode(parsed)
	case "vmess":
		return parseVMessProxyNode(parsed)
	case "trojan":
		return parseTrojanProxyNode(parsed)
	case "ss":
		return parseShadowsocksProxyNode(parsed)
	default:
		return nil, fmt.Errorf("unsupported proxy node scheme %q", parsed.Scheme)
	}
}

func NormalizeProxyNodeLines(text string) ([]string, int, error) {
	if len(text) > maxProxyNodeInputBytes*maxProxyNodeBatch {
		return nil, 0, fmt.Errorf("proxy node batch exceeds %d entries", maxProxyNodeBatch)
	}
	seen := make(map[string]struct{})
	lines := make([]string, 0)
	skipped := 0
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			skipped++
			continue
		}
		if _, ok := seen[line]; ok {
			skipped++
			continue
		}
		if len(lines) >= maxProxyNodeBatch {
			return nil, skipped, fmt.Errorf("proxy node batch exceeds %d entries", maxProxyNodeBatch)
		}
		seen[line] = struct{}{}
		lines = append(lines, line)
	}
	return lines, skipped, nil
}

func parseBasicProxyNode(parsed *url.URL, scheme string) (*ProxyNodeParsed, error) {
	if parsed.Hostname() == "" {
		return nil, errors.New("proxy node link has no server")
	}
	port := parsed.Port()
	if port == "" {
		port = "1080"
		if scheme == "http" || scheme == "https" {
			port = "80"
			if scheme == "https" {
				port = "443"
			}
		}
	}
	serverPort, err := strconv.Atoi(port)
	if err != nil || serverPort < 1 || serverPort > 65535 {
		return nil, errors.New("proxy node link has invalid port")
	}
	outboundType := scheme
	if scheme == "http" || scheme == "https" {
		outboundType = "http"
	} else if scheme == "socks5h" {
		outboundType = "socks5"
	}
	fields := map[string]any{"type": outboundType, "server": parsed.Hostname(), "server_port": serverPort}
	if parsed.User != nil {
		fields["username"] = parsed.User.Username()
		if password, ok := parsed.User.Password(); ok {
			fields["password"] = password
		}
	}
	if scheme == "https" {
		fields["tls_enabled"] = true
	}
	return newParsedProxyNode(scheme, fields, parsed.String())
}

func parseVLESSProxyNode(parsed *url.URL) (*ProxyNodeParsed, error) {
	if parsed.Hostname() == "" || parsed.User == nil || !looksLikeUUID(parsed.User.Username()) {
		return nil, errors.New("vless link must include a valid UUID and host")
	}
	fields := map[string]any{"type": "vless", "server": parsed.Hostname(), "server_port": portNumber(parsed.Port()), "uuid": parsed.User.Username()}
	addV2RayOptions(fields, parsed.Query())
	if parsed.Query().Get("security") == "tls" || parsed.Query().Get("security") == "reality" {
		fields["tls_enabled"] = true
	}
	return newParsedProxyNode("vless", fields, parsed.String())
}

func parseTrojanProxyNode(parsed *url.URL) (*ProxyNodeParsed, error) {
	if parsed.Hostname() == "" || parsed.User == nil || parsed.User.Username() == "" {
		return nil, errors.New("trojan link must include a password and host")
	}
	fields := map[string]any{"type": "trojan", "server": parsed.Hostname(), "server_port": portNumber(parsed.Port()), "password": parsed.User.Username(), "tls_enabled": true}
	addV2RayOptions(fields, parsed.Query())
	return newParsedProxyNode("trojan", fields, parsed.String())
}

func parseVMessProxyNode(parsed *url.URL) (*ProxyNodeParsed, error) {
	encoded := strings.TrimPrefix(parsed.Opaque, "//")
	if encoded == "" {
		encoded = strings.TrimPrefix(parsed.Path, "/")
	}
	if encoded == "" {
		encoded = parsed.Host
	}
	decoded, err := decodeBase64(encoded)
	if err != nil {
		return nil, errors.New("vmess link has invalid base64")
	}
	var value map[string]any
	if err := common.Unmarshal(decoded, &value); err != nil {
		return nil, errors.New("vmess link has invalid JSON")
	}
	server, _ := value["add"].(string)
	uuid, _ := value["id"].(string)
	if server == "" || !looksLikeUUID(uuid) {
		return nil, errors.New("vmess link has invalid server or UUID")
	}
	port, _ := strconv.Atoi(fmt.Sprint(value["port"]))
	fields := map[string]any{"type": "vmess", "server": server, "server_port": port, "uuid": uuid}
	if tlsValue, _ := value["tls"].(string); tlsValue != "" && tlsValue != "none" {
		fields["tls_enabled"] = true
	}
	query := url.Values{}
	for _, key := range []string{"net", "host", "path"} {
		if text, ok := value[key].(string); ok {
			query.Set(map[string]string{"net": "type", "host": "host", "path": "path"}[key], text)
		}
	}
	addV2RayOptions(fields, query)
	return newParsedProxyNode("vmess", fields, parsed.String())
}

func parseShadowsocksProxyNode(parsed *url.URL) (*ProxyNodeParsed, error) {
	if parsed.Hostname() == "" {
		return nil, errors.New("shadowsocks link has no server")
	}
	decoded, err := decodeBase64(parsed.User.Username())
	if err != nil {
		return nil, errors.New("shadowsocks link has invalid credentials")
	}
	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return nil, errors.New("shadowsocks link has invalid credentials")
	}
	port, err := strconv.Atoi(parsed.Port())
	if err != nil || port < 1 || port > 65535 {
		return nil, errors.New("shadowsocks link has invalid port")
	}
	return newParsedProxyNode("ss", map[string]any{"type": "shadowsocks", "server": parsed.Hostname(), "server_port": port, "method": parts[0], "password": parts[1]}, parsed.String())
}

func parseProxyNodeJSON(raw string) (*ProxyNodeParsed, error) {
	var fields map[string]any
	if err := common.Unmarshal([]byte(raw), &fields); err != nil {
		return nil, errors.New("proxy JSON is invalid")
	}
	if outbounds, ok := fields["outbounds"].([]any); ok && len(outbounds) > 0 {
		if outbound, ok := outbounds[0].(map[string]any); ok {
			fields = outbound
		}
	}
	protocol, _ := fields["type"].(string)
	if protocol == "" {
		return nil, errors.New("proxy outbound JSON has no type")
	}
	return newParsedProxyNode("sing-box", fields, raw)
}

func addV2RayOptions(fields map[string]any, query url.Values) {
	if value := query.Get("type"); value != "" {
		fields["transport_type"] = value
	}
	if value := query.Get("path"); value != "" {
		fields["transport_path"] = value
	}
	if value := query.Get("host"); value != "" {
		fields["transport_host"] = value
	}
	if value := query.Get("serviceName"); value != "" {
		fields["transport_service_name"] = value
	}
	if value := query.Get("sni"); value != "" {
		fields["tls_server_name"] = value
	}
}

func newParsedProxyNode(protocol string, fields map[string]any, canonical string) (*ProxyNodeParsed, error) {
	if _, ok := fields["server_port"]; !ok || fields["server_port"] == nil {
		fields["server_port"] = 443
	}
	server, _ := fields["server"].(string)
	if strings.TrimSpace(server) == "" {
		return nil, errors.New("proxy outbound has no server")
	}
	port, ok := fields["server_port"].(int)
	if !ok {
		if number, numberOK := fields["server_port"].(float64); numberOK {
			port = int(number)
			ok = true
		}
	}
	if !ok || port < 1 || port > 65535 {
		return nil, errors.New("proxy outbound has invalid port")
	}
	fields["server_port"] = port
	encoded, err := common.Marshal(fields)
	if err != nil {
		return nil, fmt.Errorf("marshal normalized proxy outbound: %w", err)
	}
	return &ProxyNodeParsed{Protocol: protocol, OutboundJSON: encoded, CanonicalInput: canonical}, nil
}

func portNumber(value string) int {
	if value == "" {
		return 443
	}
	port, _ := strconv.Atoi(value)
	return port
}

func looksLikeUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if character != '-' {
				return false
			}
			continue
		}
		if character < '0' || character > '9' && (character < 'a' || character > 'f') && (character < 'A' || character > 'F') {
			return false
		}
	}
	return true
}

func decodeBase64(value string) ([]byte, error) {
	for _, encoding := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		decoded, err := encoding.DecodeString(value)
		if err == nil {
			return decoded, nil
		}
	}
	return nil, errors.New("invalid base64")
}

func canonicalProxyNodeKey(raw string) string {
	return hex.EncodeToString([]byte(strings.TrimSpace(raw)))
}
