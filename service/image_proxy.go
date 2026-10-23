package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	imageProxyPurpose        = "new-api:image-proxy:v1"
	imageProxyPath           = "/v1/images/proxy"
	maxImageProxyURLLength   = 64 << 10
	maxImageProxyTokenLength = 128 << 10
)

var ErrImageProxyInvalid = errors.New("image proxy token is invalid")
var ErrImageProxySecretRequired = errors.New("image URL proxy requires a persistent CRYPTO_SECRET or SESSION_SECRET")

type ImageProxyTarget struct {
	URL       string `json:"url"`
	ChannelID int    `json:"channel_id"`
}

// ValidateImageProxySecret requires the effective key to come from deployment configuration.
func ValidateImageProxySecret() error {
	secret := os.Getenv("CRYPTO_SECRET")
	if secret == "" {
		secret = os.Getenv("SESSION_SECRET")
	}
	if secret == "" || secret != common.CryptoSecret {
		return ErrImageProxySecretRequired
	}
	return nil
}

func imageProxyCipher() (cipher.AEAD, error) {
	if common.CryptoSecret == "" {
		return nil, ErrImageProxyInvalid
	}
	key := sha256.Sum256([]byte(imageProxyPurpose + "\x00" + common.CryptoSecret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, ErrImageProxyInvalid
	}
	return cipher.NewGCMWithRandomNonce(block)
}

// ValidateImageProxyTargetURL accepts only absolute HTTP(S) URLs without credentials.
// Network targets are checked separately against the current fetch settings.
func ValidateImageProxyTargetURL(rawURL string) error {
	if rawURL == "" || len(rawURL) > maxImageProxyURLLength || strings.TrimSpace(rawURL) != rawURL {
		return ErrImageProxyInvalid
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed == nil || (parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.Hostname() == "" || parsed.User != nil || parsed.Opaque != "" || strings.Contains(rawURL, "#") {
		return ErrImageProxyInvalid
	}
	if strings.HasSuffix(parsed.Host, ":") {
		return ErrImageProxyInvalid
	}
	if port := parsed.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return ErrImageProxyInvalid
		}
	}
	return nil
}

// BuildImageProxyURL encrypts an upstream image URL for access through this site.
func BuildImageProxyURL(rawURL string, channelID int) (string, error) {
	if err := ValidateImageProxySecret(); err != nil {
		return "", err
	}
	if channelID <= 0 {
		return "", ErrImageProxyInvalid
	}
	if err := ValidateImageProxyTargetURL(rawURL); err != nil {
		return "", err
	}
	baseAddress := strings.TrimSpace(system_setting.TaskPublicAddress)
	if baseAddress == "" {
		baseAddress = strings.TrimSpace(system_setting.ServerAddress)
	}
	if err := ValidateTaskArtifactBaseURL(baseAddress); err != nil {
		return "", errors.New("image proxy base URL is invalid")
	}
	baseURL, err := url.Parse(baseAddress)
	if err != nil || baseURL.Hostname() == "" {
		return "", errors.New("image proxy base URL is invalid")
	}
	plaintext, err := common.Marshal(ImageProxyTarget{
		URL: rawURL, ChannelID: channelID,
	})
	if err != nil {
		return "", ErrImageProxyInvalid
	}
	aead, err := imageProxyCipher()
	if err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(aead.Seal(nil, nil, plaintext, []byte(imageProxyPurpose)))
	if len(token) > maxImageProxyTokenLength {
		return "", ErrImageProxyInvalid
	}
	escapedBasePath := strings.TrimRight(baseURL.EscapedPath(), "/")
	baseURL.Path = strings.TrimRight(baseURL.Path, "/") + imageProxyPath
	baseURL.RawPath = escapedBasePath + imageProxyPath
	baseURL.RawQuery = url.Values{"token": {token}}.Encode()
	return baseURL.String(), nil
}

// ReadImageProxyToken authenticates the target before it is used for a download.
func ReadImageProxyToken(token string) (*ImageProxyTarget, error) {
	if token == "" || len(token) > maxImageProxyTokenLength || strings.ContainsAny(token, "\r\n") {
		return nil, ErrImageProxyInvalid
	}
	ciphertext, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if err != nil {
		return nil, ErrImageProxyInvalid
	}
	aead, err := imageProxyCipher()
	if err != nil {
		return nil, err
	}
	plaintext, err := aead.Open(nil, nil, ciphertext, []byte(imageProxyPurpose))
	if err != nil {
		return nil, ErrImageProxyInvalid
	}
	var target ImageProxyTarget
	if common.Unmarshal(plaintext, &target) != nil || target.ChannelID <= 0 {
		return nil, ErrImageProxyInvalid
	}
	if err := ValidateImageProxyTargetURL(target.URL); err != nil {
		return nil, err
	}
	return &target, nil
}
