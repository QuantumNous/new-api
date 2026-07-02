package service

import "testing"

func TestGetHttpClientWithProxyEmptyRequiresInitializedClient(t *testing.T) {
	original := httpClient
	t.Cleanup(func() { httpClient = original })
	httpClient = nil

	client, err := GetHttpClientWithProxy("")
	if err == nil {
		t.Fatalf("expected uninitialized http client error, got client=%v", client)
	}
	if client != nil {
		t.Fatalf("client = %v, want nil on uninitialized http client", client)
	}
}

func TestNewProxyHttpClientEmptyRequiresInitializedClient(t *testing.T) {
	original := httpClient
	t.Cleanup(func() { httpClient = original })
	httpClient = nil

	client, err := NewProxyHttpClient("")
	if err == nil {
		t.Fatalf("expected uninitialized http client error, got client=%v", client)
	}
	if client != nil {
		t.Fatalf("client = %v, want nil on uninitialized http client", client)
	}
}
