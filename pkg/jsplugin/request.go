package jsplugin

import (
	"fmt"
	"net"
	"net/url"
	"strings"

	"golang.org/x/net/http/httpguts"
)

// ValidateRequestURL prevents plugins from directing a channel credential to
// hosts other than the configured base URL or an administrator-approved host.
func ValidateRequestURL(requestURL, baseURL string, allowedHosts []string) error {
	request, err := url.Parse(requestURL)
	if err != nil || request.Scheme == "" || request.Host == "" {
		return fmt.Errorf("plugin request URL must be absolute")
	}
	base, err := url.Parse(baseURL)
	if err != nil || base.Host == "" {
		return fmt.Errorf("channel base URL is invalid")
	}
	requestHost := canonicalHost(request)
	if requestHost == canonicalHost(base) {
		return nil
	}
	for _, allowed := range allowedHosts {
		// Parse with the request scheme so "host:443" matches an https request
		// the same way an explicit default port on the request URL does.
		allowedURL, parseErr := url.Parse(request.Scheme + "://" + strings.TrimSpace(allowed))
		if parseErr == nil && requestHost == canonicalHost(allowedURL) {
			return nil
		}
	}
	return fmt.Errorf("plugin request host %q is not allowed", request.Host)
}

// ValidateRequestHeaders rejects plugin-chosen headers that the host
// transport owns or that change how a request is framed or proxied, and
// bounds their number and size.
func ValidateRequestHeaders(headers map[string]string) error {
	if len(headers) > 64 {
		return fmt.Errorf("at most 64 request headers are allowed")
	}
	for name, value := range headers {
		name = strings.TrimSpace(name)
		if !httpguts.ValidHeaderFieldName(name) {
			return fmt.Errorf("request header name %q is invalid", name)
		}
		if !httpguts.ValidHeaderFieldValue(value) || len(value) > 8192 {
			return fmt.Errorf("request header %q has an invalid or oversized value", name)
		}
		switch strings.ToLower(name) {
		case "host", "content-length", "accept-encoding", "connection", "proxy-connection", "keep-alive",
			"proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade":
			return fmt.Errorf("request header %q is not allowed", name)
		}
	}
	return nil
}

func canonicalHost(value *url.URL) string {
	host := strings.ToLower(value.Hostname())
	port := value.Port()
	if port == "" || port == "80" && value.Scheme == "http" || port == "443" && value.Scheme == "https" {
		return host
	}
	return net.JoinHostPort(host, port)
}
