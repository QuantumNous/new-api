package controller

import (
	"bytes"
	"io"
	"mime/multipart"
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

	body := `{"model":"gpt-image-2","group":"vip","prompt":"a clean product photo","n":1}`
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
	if payload["model"] != "gpt-image-2" || payload["prompt"] != "a clean product photo" {
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

func TestStripPlaygroundInternalFieldsRemovesGroupFromMultipartForm(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("model", "gpt-image-2"); err != nil {
		t.Fatalf("WriteField model returned error: %v", err)
	}
	if err := writer.WriteField("group", "vip"); err != nil {
		t.Fatalf("WriteField group returned error: %v", err)
	}
	if err := writer.WriteField("prompt", "make the reference image brighter"); err != nil {
		t.Fatalf("WriteField prompt returned error: %v", err)
	}
	imagePart, err := writer.CreateFormFile("image", "reference.png")
	if err != nil {
		t.Fatalf("CreateFormFile returned error: %v", err)
	}
	if _, err := imagePart.Write([]byte("not-a-real-png")); err != nil {
		t.Fatalf("image write returned error: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close returned error: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	if err := stripPlaygroundInternalFields(c); err != nil {
		t.Fatalf("stripPlaygroundInternalFields returned error: %v", err)
	}

	form := c.Request.MultipartForm
	if form == nil {
		t.Fatal("MultipartForm is nil")
	}
	if _, exists := form.Value["group"]; exists {
		t.Fatalf("multipart form still contains group: %#v", form.Value["group"])
	}
	if values := form.Value["model"]; len(values) != 1 || values[0] != "gpt-image-2" {
		t.Fatalf("model = %#v, want gpt-image-2", values)
	}
	if values := form.Value["prompt"]; len(values) != 1 || values[0] != "make the reference image brighter" {
		t.Fatalf("prompt = %#v, want original prompt", values)
	}
	if files := form.File["image"]; len(files) != 1 || files[0].Filename != "reference.png" {
		t.Fatalf("image files = %#v, want reference.png", files)
	}
}
