package service

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/golang-jwt/jwt/v5"
)

const firebaseCertsURL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

type FirebaseUserInfo struct {
	UID           string
	Email         string
	EmailVerified bool
	Name          string
	Picture       string
	Provider      string
}

type firebaseIDTokenClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Firebase      struct {
		SignInProvider string `json:"sign_in_provider"`
	} `json:"firebase"`
	jwt.RegisteredClaims
}

var firebaseCertCache = struct {
	sync.RWMutex
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
}{
	keys: make(map[string]*rsa.PublicKey),
}

func VerifyFirebaseIDToken(ctx context.Context, idToken string) (*FirebaseUserInfo, error) {
	projectID := strings.TrimSpace(common.GetEnvOrDefaultString("FIREBASE_PROJECT_ID", ""))
	if projectID == "" {
		return nil, errors.New("FIREBASE_PROJECT_ID is not configured")
	}

	claims := &firebaseIDTokenClaims{}
	token, err := jwt.ParseWithClaims(
		idToken,
		claims,
		func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			kid, ok := token.Header["kid"].(string)
			if !ok || strings.TrimSpace(kid) == "" {
				return nil, errors.New("missing token key id")
			}
			return getFirebasePublicKey(ctx, kid)
		},
		jwt.WithAudience(projectID),
		jwt.WithIssuer("https://securetoken.google.com/"+projectID),
		jwt.WithExpirationRequired(),
		jwt.WithValidMethods([]string{"RS256"}),
	)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid firebase id token")
	}
	if claims.Subject == "" {
		return nil, errors.New("firebase token subject is empty")
	}

	return &FirebaseUserInfo{
		UID:           claims.Subject,
		Email:         strings.TrimSpace(claims.Email),
		EmailVerified: claims.EmailVerified,
		Name:          strings.TrimSpace(claims.Name),
		Picture:       strings.TrimSpace(claims.Picture),
		Provider:      strings.TrimSpace(claims.Firebase.SignInProvider),
	}, nil
}

func getFirebasePublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	firebaseCertCache.RLock()
	key, ok := firebaseCertCache.keys[kid]
	cacheFresh := time.Now().Before(firebaseCertCache.expiresAt)
	firebaseCertCache.RUnlock()
	if ok && cacheFresh {
		return key, nil
	}

	if err := refreshFirebasePublicKeys(ctx); err != nil {
		return nil, err
	}

	firebaseCertCache.RLock()
	defer firebaseCertCache.RUnlock()
	key, ok = firebaseCertCache.keys[kid]
	if !ok {
		return nil, errors.New("firebase public key not found")
	}
	return key, nil
}

func refreshFirebasePublicKeys(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, firebaseCertsURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch firebase public keys: %s", res.Status)
	}

	var certs map[string]string
	if err := common.DecodeJson(res.Body, &certs); err != nil {
		return err
	}

	keys := make(map[string]*rsa.PublicKey, len(certs))
	for kid, certPEM := range certs {
		key, err := parseRSAPublicKeyFromCert(certPEM)
		if err != nil {
			return err
		}
		keys[kid] = key
	}
	if len(keys) == 0 {
		return errors.New("firebase public keys response is empty")
	}

	firebaseCertCache.Lock()
	firebaseCertCache.keys = keys
	firebaseCertCache.expiresAt = time.Now().Add(parseCacheMaxAge(res.Header.Get("Cache-Control")))
	firebaseCertCache.Unlock()
	return nil
}

func parseRSAPublicKeyFromCert(certPEM string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(certPEM))
	if block == nil {
		return nil, errors.New("failed to parse firebase public certificate")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}

	publicKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("firebase certificate public key is not RSA")
	}
	return publicKey, nil
}

func parseCacheMaxAge(cacheControl string) time.Duration {
	matches := regexp.MustCompile(`(?:^|,\s*)max-age=(\d+)`).FindStringSubmatch(cacheControl)
	if len(matches) != 2 {
		return time.Hour
	}
	seconds, err := strconv.Atoi(matches[1])
	if err != nil || seconds <= 0 {
		return time.Hour
	}
	return time.Duration(seconds) * time.Second
}
