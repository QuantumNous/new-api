package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type ProxyNodeInput struct {
	Name       string
	Enabled    bool
	Proxy      string
	ScopeType  string
	ScopeValue string
}

func CreateProxyNode(input ProxyNodeInput) (*model.ProxyNode, error) {
	parsed, err := ParseProxyNodeShareLink(input.Proxy)
	if err != nil {
		return nil, err
	}
	scopeType, scopeValue, err := model.NormalizeProxyNodeScope(input.ScopeType, input.ScopeValue)
	if err != nil {
		return nil, err
	}
	encrypted, err := encryptProxyNodeConfig(parsed.CanonicalInput)
	if err != nil {
		return nil, err
	}
	node := &model.ProxyNode{
		Name:                 strings.TrimSpace(input.Name),
		Enabled:              input.Enabled,
		EncryptedProxyConfig: encrypted,
		Protocol:             parsed.Protocol,
		ScopeType:            scopeType,
		ScopeValue:           scopeValue,
		Health:               1,
	}
	if node.Name == "" {
		return nil, fmt.Errorf("proxy node name must not be empty")
	}
	if err := model.DB.Create(node).Error; err != nil {
		return nil, err
	}
	return node, nil
}

func DecryptProxyNodeConfig(node *model.ProxyNode) (*ProxyNodeParsed, error) {
	if node == nil {
		return nil, fmt.Errorf("proxy node is nil")
	}
	raw, err := decryptProxyNodeConfig(node.EncryptedProxyConfig)
	if err != nil {
		return nil, err
	}
	return ParseProxyNodeShareLink(raw)
}

func encryptProxyNodeConfig(value string) (string, error) {
	block, err := aes.NewCipher(proxyNodeEncryptionKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(value), nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func decryptProxyNodeConfig(value string) (string, error) {
	encoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return "", fmt.Errorf("decode proxy node configuration: %w", err)
	}
	block, err := aes.NewCipher(proxyNodeEncryptionKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(encoded) < gcm.NonceSize() {
		return "", fmt.Errorf("proxy node configuration is truncated")
	}
	plain, err := gcm.Open(nil, encoded[:gcm.NonceSize()], encoded[gcm.NonceSize():], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt proxy node configuration: %w", err)
	}
	return string(plain), nil
}

func proxyNodeEncryptionKey() []byte {
	sum := sha256.Sum256([]byte("proxy-node:" + common.CryptoSecret))
	return sum[:]
}

func ProxyNodeChannelScopeValue(channelID int) string {
	return strconv.Itoa(channelID)
}

func EncryptProxyNodeConfigForUpdate(value string) (string, error) {
	return encryptProxyNodeConfig(value)
}

type ProxyNodeBatchResult struct {
	Created int                     `json:"created"`
	Failed  int                     `json:"failed"`
	Skipped int                     `json:"skipped"`
	Errors  []string                `json:"errors"`
	Items   []model.ProxyNodePublic `json:"items"`
}

func CreateProxyNodesBatch(input ProxyNodeInput, namePrefix, proxyText string, proxyURLs []string) (*ProxyNodeBatchResult, error) {
	lines := append([]string{}, proxyURLs...)
	if strings.TrimSpace(proxyText) != "" {
		lines = append(lines, strings.Split(proxyText, "\n")...)
	}
	normalized, skipped, err := NormalizeProxyNodeLines(strings.Join(lines, "\n"))
	if err != nil {
		return nil, err
	}
	result := &ProxyNodeBatchResult{Skipped: skipped, Errors: []string{}, Items: []model.ProxyNodePublic{}}
	namePrefix = strings.TrimSpace(namePrefix)
	if namePrefix == "" {
		namePrefix = "Proxy Node"
	}
	for index, proxy := range normalized {
		node, createErr := CreateProxyNode(ProxyNodeInput{
			Name: fmt.Sprintf("%s#%d", namePrefix, index+1), Enabled: input.Enabled,
			Proxy: proxy, ScopeType: input.ScopeType, ScopeValue: input.ScopeValue,
		})
		if createErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: %s", index+1, createErr.Error()))
			continue
		}
		result.Created++
		result.Items = append(result.Items, node.Public())
	}
	return result, nil
}

func SetProxyNodesEnabled(ids []uint, enabled bool) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := model.DB.Model(&model.ProxyNode{}).Where("id IN ?", ids).Update("enabled", enabled)
	return result.RowsAffected, result.Error
}

func ClearProxyNodeErrors(ids []uint) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result := model.DB.Model(&model.ProxyNode{}).Where("id IN ?", ids).Updates(map[string]any{"last_error": "", "failure_count": 0, "cooldown_until": nil})
	return result.RowsAffected, result.Error
}
