package service

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
)

type errReadCloser struct{}

func (errReadCloser) Read([]byte) (int, error) { return 0, errors.New("boom") }
func (errReadCloser) Close() error             { return nil }

func TestRelayErrorHandler_ReadBodyErrorHasMessage(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       errReadCloser{},
	}
	newApiErr := RelayErrorHandler(context.Background(), resp, true)
	if newApiErr == nil {
		t.Fatal("RelayErrorHandler() returned nil")
	}
	if got := newApiErr.Error(); got == "" {
		t.Fatal("RelayErrorHandler() returned empty error message")
	}
	if got := newApiErr.Error(); !strings.Contains(got, "read response body failed") {
		t.Fatalf("RelayErrorHandler() message = %q, want to contain %q", got, "read response body failed")
	}
}

func TestRelayErrorHandler_NilBodyHasMessage(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Body:       nil,
	}
	newApiErr := RelayErrorHandler(context.Background(), resp, true)
	if newApiErr == nil {
		t.Fatal("RelayErrorHandler() returned nil")
	}
	if got := newApiErr.Error(); got == "" {
		t.Fatal("RelayErrorHandler() returned empty error message")
	}
}
