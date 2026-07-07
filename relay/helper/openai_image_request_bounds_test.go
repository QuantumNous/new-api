package helper

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func TestGetAndValidOpenAIImageRequestRejectsOversizedN(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	body := []byte(`{"model":"gpt-image-1","prompt":"x","n":129}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	_, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations)
	if err == nil {
		t.Fatalf("n above %d should be rejected", dto.MaxImageN)
	}
}
