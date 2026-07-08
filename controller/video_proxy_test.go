package controller

import "testing"

func TestShouldProxyVideoHeaderKeepsOnlyClientSafeHeaders(t *testing.T) {
	allowed := []string{
		"Accept-Ranges",
		"Content-Disposition",
		"Content-Length",
		"Content-Range",
		"Content-Type",
		"ETag",
		"Last-Modified",
	}
	for _, header := range allowed {
		if !shouldProxyVideoHeader(header) {
			t.Fatalf("expected %s to be forwarded", header)
		}
	}

	blocked := []string{
		"Set-Cookie",
		"Server",
		"X-Tos-Request-Id",
		"X-Tos-Server-Time",
		"X-Tos-Storage-Class",
		"X-Amz-Request-Id",
		"Cf-Ray",
		"Report-To",
		"Nel",
		"Alt-Svc",
	}
	for _, header := range blocked {
		if shouldProxyVideoHeader(header) {
			t.Fatalf("expected %s to be filtered", header)
		}
	}
}
