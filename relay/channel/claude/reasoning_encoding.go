package claude

import (
	"encoding/base64"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	reasoningEncodingVersion = 1
	reasoningEnvelopePrefix  = "na1."
	reasoningMaxRawBytes     = 64 * 1024

	ReasoningKindThinking = "thinking"
	ReasoningKindRedacted = "redacted"
)

type reasoningPayload struct {
	Version   int    `json:"v"`
	Kind      string `json:"t"`
	Signature string `json:"s,omitempty"`
	Data      string `json:"d,omitempty"`
}

func EncodeThinkingSignature(signature string) string {
	if signature == "" {
		return ""
	}
	return encodeReasoning(reasoningPayload{
		Version:   reasoningEncodingVersion,
		Kind:      ReasoningKindThinking,
		Signature: signature,
	})
}

func EncodeRedactedThinking(data string) string {
	if data == "" {
		return ""
	}
	return encodeReasoning(reasoningPayload{
		Version: reasoningEncodingVersion,
		Kind:    ReasoningKindRedacted,
		Data:    data,
	})
}

// 带 na1. 前缀的 envelope 走严格解码失败必返错；不带前缀的字符串视为 legacy 裸 Anthropic signature，
// 让那些直接拼 signature 字符串作为 encrypted_content 上送的客户端能复用上一轮签名。
func DecodeReasoningEncryptedContent(encrypted string) (kind, signature, data string, err error) {
	if encrypted == "" {
		return "", "", "", nil
	}
	if !strings.HasPrefix(encrypted, reasoningEnvelopePrefix) {
		return ReasoningKindThinking, encrypted, "", nil
	}
	body := strings.TrimPrefix(encrypted, reasoningEnvelopePrefix)
	raw, decErr := base64.RawURLEncoding.DecodeString(body)
	if decErr != nil {
		return "", "", "", errors.New("invalid reasoning envelope: base64 decode: " + decErr.Error())
	}
	if len(raw) > reasoningMaxRawBytes {
		return "", "", "", errors.New("invalid reasoning envelope: payload too large")
	}
	var p reasoningPayload
	if err := common.Unmarshal(raw, &p); err != nil {
		return "", "", "", errors.New("invalid reasoning envelope: json: " + err.Error())
	}
	if p.Version != reasoningEncodingVersion {
		return "", "", "", errors.New("invalid reasoning envelope: unsupported version")
	}
	switch p.Kind {
	case ReasoningKindThinking:
		if p.Signature == "" {
			return "", "", "", errors.New("invalid reasoning envelope: thinking envelope missing signature")
		}
		return ReasoningKindThinking, p.Signature, "", nil
	case ReasoningKindRedacted:
		if p.Data == "" {
			return "", "", "", errors.New("invalid reasoning envelope: redacted envelope missing data")
		}
		return ReasoningKindRedacted, "", p.Data, nil
	}
	return "", "", "", errors.New("invalid reasoning envelope: unknown kind " + p.Kind)
}

func encodeReasoning(p reasoningPayload) string {
	raw, err := common.Marshal(p)
	if err != nil {
		return ""
	}
	return reasoningEnvelopePrefix + base64.RawURLEncoding.EncodeToString(raw)
}
