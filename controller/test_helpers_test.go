package controller

import (
	"bytes"
	"mime/multipart"
	"testing"
)

func multipartWriter(t *testing.T, body *bytes.Buffer, fieldName string, fileName string, content string) *multipart.Writer {
	t.Helper()
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err = part.Write([]byte(content)); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	return writer
}
