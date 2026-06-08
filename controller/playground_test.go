package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestStripPlaygroundInternalFieldsRemovesGroupFromReusableBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"model":"gpt-image-1","group":"vip","prompt":"a clean product photo","n":1}`
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	if err := stripPlaygroundInternalFields(c); err != nil {
		t.Fatalf("stripPlaygroundInternalFields returned error: %v", err)
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		t.Fatalf("GetBodyStorage returned error: %v", err)
	}
	sanitized, err := storage.Bytes()
	if err != nil {
		t.Fatalf("storage.Bytes returned error: %v", err)
	}

	var payload map[string]any
	if err := common.Unmarshal(sanitized, &payload); err != nil {
		t.Fatalf("sanitized body is not valid JSON: %v", err)
	}
	if _, exists := payload["group"]; exists {
		t.Fatalf("sanitized body still contains group: %s", sanitized)
	}
	if payload["model"] != "gpt-image-1" || payload["prompt"] != "a clean product photo" {
		t.Fatalf("sanitized body lost required fields: %s", sanitized)
	}
	if !reflect.DeepEqual(payload["n"], float64(1)) {
		t.Fatalf("sanitized body lost n: %s", sanitized)
	}

	fromRequest, err := io.ReadAll(c.Request.Body)
	if err != nil {
		t.Fatalf("ReadAll request body returned error: %v", err)
	}
	if strings.Contains(string(fromRequest), `"group"`) {
		t.Fatalf("request body still contains group: %s", fromRequest)
	}
}
