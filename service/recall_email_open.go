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
	tracking := url.URL{
		Scheme: scheme,
		Host:   origin.Host,
		Path:   "/api/recall/open.gif",
	}
	query := tracking.Query()
	query.Set("token", token)
	tracking.RawQuery = query.Encode()
	pixel := `<img src="` + html.EscapeString(tracking.String()) + `" width="1" height="1" alt="" style="display:none!important" aria-hidden="true">`
	index := strings.LastIndex(strings.ToLower(htmlBody), "</body>")
	tracked := htmlBody + pixel
	if index >= 0 {
		tracked = htmlBody[:index] + pixel + htmlBody[index:]
	}
	if len([]byte(tracked)) > recallEmailHTMLMaxBytes {
		return htmlBody
	}
	return tracked
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
