package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	taskpxsj "github.com/QuantumNous/new-api/relay/channel/task/pingxingshijie"
	"github.com/gin-gonic/gin"
)

func newJSONContext(method, path, body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func TestGetModelRequestAssetUploadRejectsNonAssetModel(t *testing.T) {
	c := newJSONContext(http.MethodPost, "/v1/assets/upload", `{"model":"doubao-seedream-4-5-251128"}`)

	_, _, err := getModelRequest(c)

	if err == nil {
		t.Fatal("expected non-asset model to be rejected for /v1/assets/upload")
	}
}

func TestGetModelRequestAssetUploadRejectsBlankModel(t *testing.T) {
	c := newJSONContext(http.MethodPost, "/v1/assets/upload", `{"image_url":"https://example.com/a.jpg","asset_type":"Image"}`)

	_, _, err := getModelRequest(c)

	if err == nil {
		t.Fatalf("expected blank model to be rejected for /v1/assets/upload; required model is %q", taskpxsj.AssetPlaceholderModel)
	}
}

func TestGetModelRequestAssetUploadAllowsAssetModel(t *testing.T) {
	c := newJSONContext(http.MethodPost, "/v1/assets/upload", `{"model":"pingxingshijie-asset","image_url":"https://example.com/a.jpg","asset_type":"Image"}`)

	req, shouldSelectChannel, err := getModelRequest(c)

	if err != nil {
		t.Fatal(err)
	}
	if !shouldSelectChannel {
		t.Fatal("asset upload should select a channel")
	}
	if req.Model != taskpxsj.AssetPlaceholderModel {
		t.Fatalf("model = %q, want %q", req.Model, taskpxsj.AssetPlaceholderModel)
	}
}
