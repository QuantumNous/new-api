package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"html"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var ErrRecallEmailOpenInvalid = errors.New("recall email open token is invalid")

const (
	recallEmailOpenVersion = 1
	recallEmailOpenAAD     = "recall-email-open:v1"
	recallEmailOpenMaxLen  = 512
)

type recallEmailOpenPayload struct {
	Version     int   `json:"v"`
	RecipientID int64 `json:"r"`
}

func CreateRecallEmailOpenToken(recipientID int64) (string, error) {
	if recipientID <= 0 {
		return "", ErrRecallEmailOpenInvalid
	}
	aead, err := newRecallEmailOpenAEAD()
	if err != nil {
		return "", err
	}
	payload, err := common.Marshal(recallEmailOpenPayload{
		Version:     recallEmailOpenVersion,
		RecipientID: recipientID,
	})
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := aead.Seal(nonce, nonce, payload, []byte(recallEmailOpenAAD))
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func recallEmailOpenBaseOrigin() string {
	return strings.TrimSpace(os.Getenv("APP_CONSOLE_ORIGIN"))
}

func appendRecallEmailOpenPixel(htmlBody string, baseOrigin string, token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return htmlBody
	}
	origin, err := url.Parse(strings.TrimSpace(baseOrigin))
	if err != nil {
		return htmlBody
	}
	scheme := strings.ToLower(origin.Scheme)
	if (scheme != "http" && scheme != "https") || origin.Host == "" || origin.User != nil {
		return htmlBody
	}
	if origin.Path != "" && origin.Path != "/" {
		return htmlBody
	}
	if origin.RawQuery != "" || origin.Fragment != "" {
		return htmlBody
	}
	if !recallEmailOpenHostHasValidPort(origin.Host) {
		return htmlBody
	}
	tracking := url.URL{
		Scheme: scheme,
		Host:   origin.Host,
		Path:   "/api/recall/open.gif",
	}
	query := tracking.Query()
	query.Set("token", token)
	tracking.RawQuery = query.Encode()
	pixel := `<img src="` + html.EscapeString(tracking.String()) + `" width="1" height="1" alt="" style="display:none!important" aria-hidden="true">`
	index := lastRecallEmailClosingBodyIndex(htmlBody)
	tracked := htmlBody + pixel
	if index >= 0 {
		tracked = htmlBody[:index] + pixel + htmlBody[index:]
	}
	if len([]byte(tracked)) > recallEmailHTMLMaxBytes {
		return htmlBody
	}
	return tracked
}

func recallEmailOpenHostHasValidPort(host string) bool {
	if strings.HasPrefix(host, "[") {
		closeBracket := strings.LastIndex(host, "]")
		if closeBracket < 0 {
			return false
		}
		if len(host) == closeBracket+1 {
			return true
		}
		if len(host) <= closeBracket+2 || host[closeBracket+1] != ':' {
			return false
		}
		return recallEmailOpenPortIsDigits(host[closeBracket+2:])
	}
	colon := strings.LastIndex(host, ":")
	if colon < 0 {
		return true
	}
	return colon < len(host)-1 && recallEmailOpenPortIsDigits(host[colon+1:])
}

func recallEmailOpenPortIsDigits(port string) bool {
	if port == "" {
		return false
	}
	for index := 0; index < len(port); index++ {
		if port[index] < '0' || port[index] > '9' {
			return false
		}
	}
	return true
}

func lastRecallEmailClosingBodyIndex(source string) int {
	const closingBody = "</body>"
	for index := len(source) - len(closingBody); index >= 0; index-- {
		if recallEmailASCIIFoldEqual(source[index:index+len(closingBody)], closingBody) {
			return index
		}
	}
	return -1
}

func recallEmailASCIIFoldEqual(value string, pattern string) bool {
	if len(value) != len(pattern) {
		return false
	}
	for index := 0; index < len(pattern); index++ {
		left := value[index]
		if left >= 'A' && left <= 'Z' {
			left += 'a' - 'A'
		}
		if left != pattern[index] {
			return false
		}
	}
	return true
}

func RecordRecallEmailOpen(ctx context.Context, token string, openedAt time.Time) error {
	recipientID, err := parseRecallEmailOpenToken(token)
	if err != nil {
		return err
	}
	_, err = model.RecordRecallEmailOpenWithContext(ctx, recipientID, openedAt.Unix())
	return err
}

func parseRecallEmailOpenToken(token string) (int64, error) {
	if token == "" || len(token) > recallEmailOpenMaxLen {
		return 0, ErrRecallEmailOpenInvalid
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return 0, ErrRecallEmailOpenInvalid
	}
	aead, err := newRecallEmailOpenAEAD()
	if err != nil {
		return 0, err
	}
	nonceSize := aead.NonceSize()
	if len(raw) <= nonceSize {
		return 0, ErrRecallEmailOpenInvalid
	}
	payloadJSON, err := aead.Open(nil, raw[:nonceSize], raw[nonceSize:], []byte(recallEmailOpenAAD))
	if err != nil {
		return 0, ErrRecallEmailOpenInvalid
	}
	payload := recallEmailOpenPayload{}
	if err := common.Unmarshal(payloadJSON, &payload); err != nil {
		return 0, ErrRecallEmailOpenInvalid
	}
	if payload.Version != recallEmailOpenVersion || payload.RecipientID <= 0 {
		return 0, ErrRecallEmailOpenInvalid
	}
	return payload.RecipientID, nil
}

func newRecallEmailOpenAEAD() (cipher.AEAD, error) {
	key := sha256.Sum256([]byte(recallEmailOpenAAD + ":" + common.CryptoSecret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
