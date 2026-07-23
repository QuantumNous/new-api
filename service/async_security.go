package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

const asyncPayloadVersion byte = 1

func CanonicalAsyncJSON(body []byte) ([]byte, error) {
	var value any
	if err := common.Unmarshal(body, &value); err != nil {
		return nil, err
	}
	return common.Marshal(value)
}

func HashAsyncRequest(body []byte) (string, error) {
	canonical, err := CanonicalAsyncJSON(body)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(canonical)
	return hex.EncodeToString(sum[:]), nil
}

func asyncEncryptionKey() ([]byte, error) {
	if encoded := strings.TrimSpace(os.Getenv("ASYNC_REQUEST_ENCRYPTION_KEY")); encoded != "" {
		if decoded, err := base64.StdEncoding.DecodeString(encoded); err == nil && len(decoded) == 32 {
			return decoded, nil
		}
		if decoded, err := base64.RawStdEncoding.DecodeString(encoded); err == nil && len(decoded) == 32 {
			return decoded, nil
		}
		if decoded, err := hex.DecodeString(encoded); err == nil && len(decoded) == 32 {
			return decoded, nil
		}
		return nil, errors.New("ASYNC_REQUEST_ENCRYPTION_KEY must encode exactly 32 bytes")
	}
	if secret := os.Getenv("CRYPTO_SECRET"); len(secret) >= 32 {
		sum := sha256.Sum256([]byte(secret))
		return sum[:], nil
	}
	return nil, errors.New("ASYNC_REQUEST_ENCRYPTION_KEY or a CRYPTO_SECRET of at least 32 characters is required")
}

func EncryptAsyncPayload(plaintext []byte) ([]byte, error) {
	key, err := asyncEncryptionKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	sealed := gcm.Seal(nil, nonce, plaintext, nil)
	out := make([]byte, 1, 1+len(nonce)+len(sealed))
	out[0] = asyncPayloadVersion
	out = append(out, nonce...)
	out = append(out, sealed...)
	return out, nil
}

func DecryptAsyncPayload(payload []byte) ([]byte, error) {
	if len(payload) < 2 || payload[0] != asyncPayloadVersion {
		return nil, errors.New("unsupported encrypted async payload")
	}
	key, err := asyncEncryptionKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(payload) < 1+gcm.NonceSize()+gcm.Overhead() {
		return nil, errors.New("encrypted async payload is truncated")
	}
	nonce := payload[1 : 1+gcm.NonceSize()]
	return gcm.Open(nil, nonce, payload[1+gcm.NonceSize():], nil)
}

func ValidateAsyncImageRequest(request *dto.ImageRequest, raw []byte) error {
	if request == nil {
		return errors.New("image request is required")
	}
	if strings.TrimSpace(request.Model) == "" {
		return errors.New("model is required")
	}
	if strings.TrimSpace(request.Prompt) == "" {
		return errors.New("prompt is required")
	}
	maxPromptChars := 20000
	if configured, err := strconv.Atoi(os.Getenv("ASYNC_MAX_PROMPT_CHARS")); err == nil && configured > 0 {
		maxPromptChars = configured
	}
	if utf8.RuneCountInString(request.Prompt) > maxPromptChars {
		return fmt.Errorf("prompt exceeds %d characters", maxPromptChars)
	}
	if request.Stream != nil && *request.Stream {
		return errors.New("streaming image responses are not supported by the async wrapper")
	}
	if len(raw) == 0 {
		return errors.New("request body is empty")
	}
	maxRequestKB := 256
	if configured, err := strconv.Atoi(os.Getenv("ASYNC_MAX_REQUEST_BODY_KB")); err == nil && configured > 0 {
		maxRequestKB = configured
	}
	if len(raw) > maxRequestKB*1024 {
		return fmt.Errorf("request body exceeds %d KiB", maxRequestKB)
	}
	maxImages := 8
	if configured, err := strconv.Atoi(os.Getenv("ASYNC_ARTIFACT_MAX_FILES")); err == nil && configured > 0 {
		maxImages = configured
	}
	if request.N != nil && int(*request.N) > maxImages {
		return fmt.Errorf("image count exceeds %d", maxImages)
	}
	if model_setting.IsGeminiModelSupportImagine(request.Model) {
		if request.N != nil && *request.N != 1 {
			return errors.New("yunwu gemini image models support exactly one image per async task")
		}
		if !validAsyncGeminiAspectRatio(request.Size) {
			return errors.New("unsupported yunwu gemini image aspect ratio")
		}
		if !validAsyncGeminiImageSize(request.Quality) {
			return errors.New("unsupported yunwu gemini image quality; use 1K, 2K or 4K")
		}
	}
	maxInputURLs := 8
	if configured, err := strconv.Atoi(os.Getenv("ASYNC_MAX_INPUT_URLS")); err == nil && configured > 0 {
		maxInputURLs = configured
	}
	canonical, err := CanonicalAsyncJSON(raw)
	if err != nil {
		return err
	}
	var value any
	if err := common.Unmarshal(canonical, &value); err != nil {
		return err
	}
	if countHTTPURLs(value) > maxInputURLs {
		return fmt.Errorf("request contains more than %d input URLs", maxInputURLs)
	}
	return nil
}

func ValidateAsyncImageProviderRequest(request *dto.ImageRequest, provider common.AsyncImageProvider) error {
	if request == nil {
		return errors.New("image request is required")
	}
	if provider == common.AsyncImageProviderGRSAI && request.N != nil && *request.N != 1 {
		return errors.New("GRS AI synchronous image generation supports exactly one image per task")
	}
	return nil
}

func validAsyncGeminiAspectRatio(size string) bool {
	switch strings.TrimSpace(size) {
	case "", "1:1", "3:2", "2:3", "9:16", "16:9", "4:3", "3:4", "4:5", "5:4", "21:9",
		"256x256", "512x512", "1024x1024", "1536x1024", "1024x1536", "1024x1792", "1792x1024":
		return true
	default:
		return false
	}
}

func validAsyncGeminiImageSize(quality string) bool {
	switch strings.ToLower(strings.TrimSpace(quality)) {
	case "", "auto", "standard", "medium", "hd", "high", "1k", "2k", "4k":
		return true
	default:
		return false
	}
}

func countHTTPURLs(value any) int {
	switch typed := value.(type) {
	case string:
		parsed, err := url.Parse(typed)
		if err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != "" {
			return 1
		}
	case []any:
		count := 0
		for _, item := range typed {
			count += countHTTPURLs(item)
		}
		return count
	case map[string]any:
		count := 0
		for _, item := range typed {
			count += countHTTPURLs(item)
		}
		return count
	}
	return 0
}

func IsAllowedYunwuBaseURL(raw string) bool {
	return common.IsAllowedYunwuBaseURL(raw)
}

func AsyncImageProviderForBaseURL(raw string) (common.AsyncImageProvider, bool) {
	return common.AsyncImageProviderForBaseURL(raw)
}

func IsAllowedAsyncImageBaseURL(raw string) bool {
	return common.IsAllowedAsyncImageBaseURL(raw)
}
