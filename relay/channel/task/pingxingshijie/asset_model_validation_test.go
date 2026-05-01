package pingxingshijie

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func newAssetUploadContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/assets/upload", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func TestValidateRequestAndSetActionRejectsNonAssetUploadModel(t *testing.T) {
	c := newAssetUploadContext(`{"model":"doubao-seedream-4-5-251128","image_url":"https://example.com/a.jpg","asset_type":"Image"}`)
	info := &relaycommon.RelayInfo{RequestURLPath: "/v1/assets/upload", TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)

	if taskErr == nil {
		t.Fatal("expected non-asset model to be rejected for asset upload")
	}
}

func TestValidateRequestAndSetActionAllowsAssetPlaceholderModel(t *testing.T) {
	c := newAssetUploadContext(`{"model":"pingxingshijie-asset","image_url":"https://example.com/a.jpg","asset_type":"Image"}`)
	info := &relaycommon.RelayInfo{RequestURLPath: "/v1/assets/upload", TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)

	if taskErr != nil {
		t.Fatalf("expected asset model to be accepted, got %#v", taskErr)
	}
	if info.Action != "assetUpload" {
		t.Fatalf("expected asset upload action to avoid generate/image-to-video classification, got %q", info.Action)
	}
}

func TestValidateRequestAndSetActionRejectsBlankAssetUploadModel(t *testing.T) {
	c := newAssetUploadContext(`{"image_url":"https://example.com/a.jpg","asset_type":"Image"}`)
	info := &relaycommon.RelayInfo{RequestURLPath: "/v1/assets/upload", TaskRelayInfo: &relaycommon.TaskRelayInfo{}}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)

	if taskErr == nil {
		t.Fatal("expected blank model to be rejected for asset upload")
	}
}
