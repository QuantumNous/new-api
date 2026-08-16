package service

import (
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProxyNodeParserNormalizesSupportedProtocols(t *testing.T) {
	tests := []struct {
		name, raw, protocol string
		fields              map[string]any
	}{
		{"http", "http://user:pass@example.com:8080", "http", map[string]any{"type": "http", "server": "example.com", "server_port": float64(8080), "username": "user", "password": "pass"}},
		{"https", "https://example.com:8443", "https", map[string]any{"type": "http", "server": "example.com", "server_port": float64(8443), "tls_enabled": true}},
		{"socks5", "socks5://user:pass@example.com:1080", "socks5", map[string]any{"type": "socks5", "server": "example.com", "server_port": float64(1080), "username": "user", "password": "pass"}},
		{"socks5h", "socks5h://example.com:1080", "socks5h", map[string]any{"type": "socks5", "server": "example.com", "server_port": float64(1080)}},
		{"vless", "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&sni=edge.example&type=ws&host=cdn.example&path=%2Fws", "vless", map[string]any{"type": "vless", "server": "example.com", "server_port": float64(443), "uuid": "11111111-1111-1111-1111-111111111111", "tls_enabled": true, "tls_server_name": "edge.example", "transport_type": "ws", "transport_host": "cdn.example", "transport_path": "/ws"}},
		{"trojan", "trojan://secret@example.com:443?sni=edge.example&type=grpc&serviceName=proxy", "trojan", map[string]any{"type": "trojan", "server": "example.com", "server_port": float64(443), "password": "secret", "tls_enabled": true, "tls_server_name": "edge.example", "transport_type": "grpc", "transport_service_name": "proxy"}},
		{"vmess", "vmess://eyJhZGQiOiJleGFtcGxlLmNvbSIsInBvcnQiOiI0NDMiLCJpZCI6IjExMTExMTExLTExMTEtMTExMS0xMTExLTExMTExMTExMTExMSIsIm5ldCI6IndzIiwiaG9zdCI6ImNkbi5leGFtcGxlIiwicGF0aCI6Ii93cyIsInRscyI6InRscyJ9", "vmess", map[string]any{"type": "vmess", "server": "example.com", "server_port": float64(443), "uuid": "11111111-1111-1111-1111-111111111111", "tls_enabled": true, "transport_type": "ws", "transport_host": "cdn.example", "transport_path": "/ws"}},
		{"ss", "ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@example.com:8388", "ss", map[string]any{"type": "shadowsocks", "server": "example.com", "server_port": float64(8388), "method": "aes-256-gcm", "password": "password"}},
		{"sing-box", `{"type":"socks","server":"example.com","server_port":1080}`, "sing-box", map[string]any{"type": "socks", "server": "example.com", "server_port": float64(1080)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := ParseProxyNodeShareLink(tt.raw)
			require.NoError(t, err)
			assert.Equal(t, tt.protocol, parsed.Protocol)
			var got map[string]any
			require.NoError(t, common.Unmarshal(parsed.OutboundJSON, &got))
			for key, want := range tt.fields {
				assert.Equal(t, want, got[key], key)
			}
		})
	}
}

func TestProxyNodeParserRejectsUnsafeInput(t *testing.T) {
	for _, raw := range []string{
		"", "file:///tmp/proxy", "vmess://", "http://example.com\r\nX-Leak: yes",
		"vless://not-a-uuid@example.com:443", strings.Repeat("x", maxProxyNodeInputBytes+1),
	} {
		t.Run("invalid", func(t *testing.T) {
			_, err := ParseProxyNodeShareLink(raw)
			require.Error(t, err)
		})
	}
}

func TestProxyNodeBatchNormalizesLines(t *testing.T) {
	lines, skipped, err := NormalizeProxyNodeLines("\n# comment\nhttp://a\nhttp://a\n socks5://b \n")
	require.NoError(t, err)
	assert.Equal(t, []string{"http://a", "socks5://b"}, lines)
	assert.Equal(t, 4, skipped)

	var batch strings.Builder
	for index := 0; index < maxProxyNodeBatch+1; index++ {
		batch.WriteString("http://example.com/")
		batch.WriteString(strconv.Itoa(index))
		batch.WriteByte('\n')
	}
	_, _, err = NormalizeProxyNodeLines(batch.String())
	require.Error(t, err)
	parsed, err := ParseProxyNodeShareLink("http://user:pass@example.com:8080")
	require.NoError(t, err)
	_, err = buildOptionsJSON(parsed.OutboundJSON)
	require.NoError(t, err)
}
