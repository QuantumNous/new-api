package groksubscription

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"strings"
)

// ComputeCacheIdentity 用 HMAC-SHA256 对 (channel, user, token, clientKey) 命名空间化。
// 客户端未提供 cache key 时返回空串，调用方据此不发 cache 字段（不凭空造身份）。
func ComputeCacheIdentity(secret []byte, channelID int, userIdentity, tokenIdentity, clientCacheKey string) string {
	if strings.TrimSpace(clientCacheKey) == "" {
		return ""
	}
	mac := hmac.New(sha256.New, secret)
	// 用长度前缀分隔，避免字段拼接歧义
	writeField(mac, "grok-cache:v1")
	writeField(mac, strconv.Itoa(channelID))
	writeField(mac, userIdentity)
	writeField(mac, tokenIdentity)
	writeField(mac, clientCacheKey)
	sum := mac.Sum(nil)
	return "grok_" + base64.RawURLEncoding.EncodeToString(sum)
}

func writeField(mac interface{ Write([]byte) (int, error) }, s string) {
	var lenBuf [4]byte
	n := len(s)
	lenBuf[0] = byte(n >> 24)
	lenBuf[1] = byte(n >> 16)
	lenBuf[2] = byte(n >> 8)
	lenBuf[3] = byte(n)
	_, _ = mac.Write(lenBuf[:])
	_, _ = mac.Write([]byte(s))
}
