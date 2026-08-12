package middleware

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetPlaygroundGroupReadsJSONImageRequest(t *testing.T) {
	t.Helper()
	request := httptest.NewRequest(
		http.MethodPost,
		"/pg/images/generations",
		bytes.NewBufferString(`{"model":"gpt-image-2","group":" image2-test "}`),
	)
	request.Header.Set("Content-Type", "application/json")
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request

	group, err := getPlaygroundGroup(context)
	if err != nil {
		t.Fatalf("getPlaygroundGroup() error = %v", err)
	}
	if group != "image2-test" {
		t.Fatalf("getPlaygroundGroup() = %q, want %q", group, "image2-test")
	}
}

func TestGetPlaygroundGroupReadsMultipartImageEdit(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("model", "gpt-image-2"); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("group", "image2-test"); err != nil {
		t.Fatal(err)
	}
	part, err := writer.CreateFormFile("image", "reference.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("not-a-real-image")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request

	group, err := getPlaygroundGroup(context)
	if err != nil {
		t.Fatalf("getPlaygroundGroup() error = %v", err)
	}
	if group != "image2-test" {
		t.Fatalf("getPlaygroundGroup() = %q, want %q", group, "image2-test")
	}
}

func TestGetModelFromRequestReadsMultipartImageEdit(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("model", "gpt-image-2"); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("group", "image2-test"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request

	modelRequest, err := getModelFromRequest(context)
	if err != nil {
		t.Fatalf("getModelFromRequest() error = %v", err)
	}
	if modelRequest.Model != "gpt-image-2" || modelRequest.Group != "image2-test" {
		t.Fatalf("getModelFromRequest() = %#v, want model and group from multipart body", modelRequest)
	}
}

func TestPlaygroundImage2ChatRequestIsRejected(t *testing.T) {
	for _, testCase := range []struct {
		name  string
		path  string
		model string
		want  bool
	}{
		{name: "image2 chat", path: "/pg/chat/completions", model: "gpt-image-2", want: true},
		{name: "image2 variant chat", path: "/pg/chat/completions", model: " GPT-IMAGE-2-4k ", want: true},
		{name: "image endpoint", path: "/pg/images/generations", model: "gpt-image-2", want: false},
		{name: "text chat", path: "/pg/chat/completions", model: "gpt-5.4", want: false},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			if got := isPlaygroundImage2ChatRequest(testCase.path, testCase.model); got != testCase.want {
				t.Fatalf("isPlaygroundImage2ChatRequest(%q, %q) = %v, want %v", testCase.path, testCase.model, got, testCase.want)
			}
		})
	}
}
