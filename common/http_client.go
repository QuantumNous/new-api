package common

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"time"
)

type DialContextFunc func(context.Context, string, string) (net.Conn, error)

// NewOutboundHTTPTransport applies the shared connection lifecycle policy.
// ResponseHeaderTimeout bounds an upstream that never responds while leaving
// response-body streaming governed by request context and streaming timeouts.
func NewOutboundHTTPTransport(proxy func(*http.Request) (*url.URL, error), dialContext DialContextFunc) *http.Transport {
	if dialContext == nil {
		dialer := &net.Dialer{
			Timeout:   time.Duration(RelayDialTimeout) * time.Second,
			KeepAlive: 30 * time.Second,
		}
		dialContext = dialer.DialContext
	}
	transport := &http.Transport{
		Proxy:                 proxy,
		DialContext:           dialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          RelayMaxIdleConns,
		MaxIdleConnsPerHost:   RelayMaxIdleConnsPerHost,
		IdleConnTimeout:       time.Duration(RelayIdleConnTimeout) * time.Second,
		TLSHandshakeTimeout:   time.Duration(RelayTLSHandshakeTimeout) * time.Second,
		ResponseHeaderTimeout: time.Duration(RelayResponseHeaderTimeout) * time.Second,
		ExpectContinueTimeout: time.Duration(RelayExpectContinueTimeout) * time.Second,
	}
	if TLSInsecureSkipVerify {
		transport.TLSClientConfig = InsecureTLSConfig.Clone()
	}
	return transport
}
