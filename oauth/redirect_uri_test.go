package oauth

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestBuildOAuthRedirectURI(t *testing.T) {
	original := system_setting.ServerAddress
	system_setting.ServerAddress = "https://configured.example.com/"
	t.Cleanup(func() { system_setting.ServerAddress = original })

	for _, test := range []struct {
		name    string
		request string
		proto   string
		host    string
		want    string
	}{
		{"forwarded origin", "http://internal:3000/callback", "https", "public.example.com", "https://public.example.com/oauth/custom"},
		{"request origin", "http://local.example.com/callback", "", "", "http://local.example.com/oauth/custom"},
		{"TLS origin", "https://secure.example.com/callback", "", "", "https://secure.example.com/oauth/custom"},
		{"configured fallback", "", "", "", "https://configured.example.com/oauth/custom"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var c *gin.Context
			if test.request != "" {
				c, _ = gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest("GET", test.request, nil)
				c.Request.Header.Set("X-Forwarded-Proto", test.proto)
				c.Request.Header.Set("X-Forwarded-Host", test.host)
			}
			assert.Equal(t, test.want, BuildOAuthRedirectURI(c, "custom"))
		})
	}
}
