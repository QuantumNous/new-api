package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSchedulerCatalogAuthUsesDedicatedConstantTimeToken(t *testing.T) {
	previous := os.Getenv("SCHEDULER_CATALOG_TOKEN")
	defer os.Setenv("SCHEDULER_CATALOG_TOKEN", previous)
	if err := os.Setenv("SCHEDULER_CATALOG_TOKEN", "catalog-secret"); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/catalog", SchedulerCatalogAuth(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	for _, test := range []struct {
		name   string
		header string
		status int
	}{
		{name: "missing", status: http.StatusUnauthorized},
		{name: "wrong", header: "Bearer wrong", status: http.StatusUnauthorized},
		{name: "valid", header: "Bearer catalog-secret", status: http.StatusNoContent},
	} {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/catalog", nil)
			req.Header.Set("Authorization", test.header)
			recorder := httptest.NewRecorder()
			r.ServeHTTP(recorder, req)
			if recorder.Code != test.status {
				t.Fatalf("status=%d want=%d body=%s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestSchedulerCatalogAuthRejectsUnsetToken(t *testing.T) {
	previous := os.Getenv("SCHEDULER_CATALOG_TOKEN")
	defer os.Setenv("SCHEDULER_CATALOG_TOKEN", previous)
	if err := os.Unsetenv("SCHEDULER_CATALOG_TOKEN"); err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.GET("/catalog", SchedulerCatalogAuth(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	req := httptest.NewRequest(http.MethodGet, "/catalog", nil)
	req.Header.Set("Authorization", "Bearer any")
	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unset token status=%d", recorder.Code)
	}
}
