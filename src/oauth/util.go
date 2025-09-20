package oauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

// getFormOrBasicAuth extracts client_id/client_secret from Basic Auth first, then form
func getFormOrBasicAuth(c *gin.Context) (clientID, clientSecret string) {
	id, secret, ok := c.Request.BasicAuth()
	if ok {
		return strings.TrimSpace(id), strings.TrimSpace(secret)
	}
	return strings.TrimSpace(c.PostForm("client_id")), strings.TrimSpace(c.PostForm("client_secret"))
}

// genCode generates URL-safe random string based on nBytes of entropy
func genCode(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// s256Base64URL computes base64url-encoded SHA256 digest
func s256Base64URL(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// writeNoStore sets no-store cache headers for OAuth responses
func writeNoStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
}

// writeOAuthRedirectError builds an error redirect to redirect_uri as RFC6749
func writeOAuthRedirectError(c *gin.Context, redirectURI, errCode, description, state string) {
	writeNoStore(c)
	q := "error=" + url.QueryEscape(errCode)
	if description != "" {
		q += "&error_description=" + url.QueryEscape(description)
	}
	if state != "" {
		q += "&state=" + url.QueryEscape(state)
	}
	sep := "?"
	if strings.Contains(redirectURI, "?") {
		sep = "&"
	}
	c.Redirect(http.StatusFound, redirectURI+sep+q)
}
