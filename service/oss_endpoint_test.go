package service

import "testing"

func TestNormalizeOSSEndpointDefaultsToHTTPS(t *testing.T) {
	got := normalizeOSSEndpoint("oss-cn-hangzhou.aliyuncs.com")
	want := "https://oss-cn-hangzhou.aliyuncs.com"
	if got != want {
		t.Fatalf("normalizeOSSEndpoint() = %q, want %q", got, want)
	}
}

func TestNormalizeOSSEndpointPreservesExplicitScheme(t *testing.T) {
	tests := []string{
		"https://oss-cn-hangzhou.aliyuncs.com",
		"http://127.0.0.1:9000",
	}
	for _, value := range tests {
		if got := normalizeOSSEndpoint(value); got != value {
			t.Fatalf("normalizeOSSEndpoint(%q) = %q, want unchanged", value, got)
		}
	}
}
