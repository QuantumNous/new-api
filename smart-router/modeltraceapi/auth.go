package modeltraceapi

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"
)

var ErrUnauthorized = errors.New("modeltrace: unauthorized")
var noncePattern = regexp.MustCompile(`^[0-9a-f]{32}$`)
var signaturePattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type Auth struct {
	key      []byte
	now      func() time.Time
	capacity int
	mu       sync.Mutex
	latest   time.Time
	nonces   map[string]time.Time
}

func NewAuth(key []byte, now func() time.Time, capacity int) (*Auth, error) {
	if len(key) < 32 || capacity < 1 || capacity > 65536 {
		return nil, ErrUnauthorized
	}
	if now == nil {
		now = time.Now
	}
	return &Auth{key: append([]byte(nil), key...), now: now, capacity: capacity, nonces: make(map[string]time.Time)}, nil
}

func (a *Auth) Authenticate(request *http.Request, body []byte) error {
	if request == nil || len(body) > 256<<10 {
		return ErrUnauthorized
	}
	for _, name := range []string{"X-ModelTrace-Signature", "X-ModelTrace-Timestamp", "X-ModelTrace-Nonce"} {
		if len(request.Header.Values(name)) != 1 {
			return ErrUnauthorized
		}
	}
	stamp := request.Header.Get("X-ModelTrace-Timestamp")
	nonce := request.Header.Get("X-ModelTrace-Nonce")
	signature := request.Header.Get("X-ModelTrace-Signature")
	if len(stamp) < 1 || len(stamp) > 12 || !noncePattern.MatchString(nonce) || !signaturePattern.MatchString(signature) {
		return ErrUnauthorized
	}
	seconds, err := strconv.ParseInt(stamp, 10, 64)
	if err != nil || seconds < 1 || strconv.FormatInt(seconds, 10) != stamp {
		return ErrUnauthorized
	}
	expected := requestMAC(request, body, a.key, stamp, nonce)
	supplied, err := hex.DecodeString(signature)
	if err != nil || !hmac.Equal(expected, supplied) {
		return ErrUnauthorized
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	now := a.now()
	if now.Before(a.latest) {
		return ErrUnauthorized
	}
	a.latest = now
	if seconds < now.Unix()-60 || seconds > now.Unix()+60 {
		return ErrUnauthorized
	}
	// Expiry is inclusive; pruning uses the same whole-second clock as admission.
	current := time.Unix(now.Unix(), 0)
	for used, expiry := range a.nonces {
		if expiry.Before(current) {
			delete(a.nonces, used)
		}
	}
	if _, exists := a.nonces[nonce]; exists || len(a.nonces) >= a.capacity {
		return ErrUnauthorized
	}
	a.nonces[nonce] = time.Unix(seconds+60, 0)
	return nil
}

func Sign(request *http.Request, body, key []byte, at time.Time, nonce string) error {
	if request == nil || len(key) < 32 || len(body) > 256<<10 || at.Unix() < 1 {
		return ErrUnauthorized
	}
	if nonce == "" {
		var data [16]byte
		if _, err := rand.Read(data[:]); err != nil {
			return ErrUnauthorized
		}
		nonce = hex.EncodeToString(data[:])
	}
	if !noncePattern.MatchString(nonce) {
		return ErrUnauthorized
	}
	stamp := strconv.FormatInt(at.Unix(), 10)
	request.Header.Set("X-ModelTrace-Timestamp", stamp)
	request.Header.Set("X-ModelTrace-Nonce", nonce)
	request.Header.Set("X-ModelTrace-Signature", hex.EncodeToString(requestMAC(request, body, key, stamp, nonce)))
	return nil
}

func requestMAC(request *http.Request, body, key []byte, stamp, nonce string) []byte {
	target := request.URL.RequestURI()
	if request.RequestURI != "" {
		target = request.RequestURI
	}
	sum := sha256.Sum256(body)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(request.Method + "\n" + target + "\n" + stamp + "\n" + nonce + "\n" + hex.EncodeToString(sum[:])))
	return mac.Sum(nil)
}
