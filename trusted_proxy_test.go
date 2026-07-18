package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConfigureTrustedProxiesDisablesForwardedHeadersByDefault(t *testing.T) {
	t.Setenv("TRUSTED_PROXY_CIDRS", "")
	engine := gin.New()
	require.NoError(t, configureTrustedProxies(engine))

	require.Equal(t, "203.0.113.10", requestClientIP(engine, "203.0.113.10:4321", "198.51.100.20"))
}

func TestConfigureTrustedProxiesUsesConfiguredCIDRs(t *testing.T) {
	t.Setenv("TRUSTED_PROXY_CIDRS", "127.0.0.1/32, ::1/128")
	engine := gin.New()
	require.NoError(t, configureTrustedProxies(engine))

	require.Equal(t, "198.51.100.20", requestClientIP(engine, "127.0.0.1:4321", "198.51.100.20"))
}

func TestConfigureTrustedProxiesRejectsInvalidCIDR(t *testing.T) {
	t.Setenv("TRUSTED_PROXY_CIDRS", "not-a-cidr")
	require.Error(t, configureTrustedProxies(gin.New()))
}

func requestClientIP(engine *gin.Engine, remoteAddr string, forwardedFor string) string {
	var clientIP string
	engine.GET("/", func(c *gin.Context) {
		clientIP = c.ClientIP()
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = remoteAddr
	request.Header.Set("X-Forwarded-For", forwardedFor)
	engine.ServeHTTP(httptest.NewRecorder(), request)
	return clientIP
}
