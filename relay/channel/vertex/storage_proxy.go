package vertex

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
)

const vertexStorageHost = "storage.googleapis.com"

type StorageOperation uint8

const (
	StorageOperationUpload StorageOperation = iota + 1
	StorageOperationList
	StorageOperationGet
	StorageOperationDelete
)

type StorageProxyRequest struct {
	Operation     StorageOperation
	Method        string
	Bucket        string
	Object        string
	RawQuery      string
	Header        http.Header
	Body          io.Reader
	ContentLength int64
	AccessToken   string
	Proxy         string
}

func buildStorageRequest(ctx context.Context, input StorageProxyRequest) (*http.Request, error) {
	if strings.TrimSpace(input.AccessToken) == "" {
		return nil, errors.New("Vertex storage access token is required")
	}
	bucket, err := relayconstant.NormalizeVertexStorageBucket(input.Bucket)
	if err != nil {
		return nil, err
	}

	escapedBucket := url.PathEscape(bucket)
	var escapedPath string
	switch input.Operation {
	case StorageOperationUpload:
		if input.Method != http.MethodPost && input.Method != http.MethodPut {
			return nil, fmt.Errorf("unsupported Vertex storage upload method %q", input.Method)
		}
		escapedPath = "/upload/storage/v1/b/" + escapedBucket + "/o"
	case StorageOperationList:
		if input.Method != http.MethodGet {
			return nil, fmt.Errorf("unsupported Vertex storage list method %q", input.Method)
		}
		escapedPath = "/storage/v1/b/" + escapedBucket + "/o"
	case StorageOperationGet, StorageOperationDelete:
		expectedMethod := http.MethodGet
		if input.Operation == StorageOperationDelete {
			expectedMethod = http.MethodDelete
		}
		if input.Method != expectedMethod {
			return nil, fmt.Errorf("unsupported Vertex storage object method %q", input.Method)
		}
		if err := relayconstant.ValidateVertexStorageObjectName(input.Object); err != nil {
			return nil, err
		}
		escapedPath = "/storage/v1/b/" + escapedBucket + "/o/" + url.PathEscape(input.Object)
	default:
		return nil, errors.New("unsupported Vertex storage operation")
	}

	path, err := url.PathUnescape(escapedPath)
	if err != nil {
		return nil, fmt.Errorf("build Vertex storage path: %w", err)
	}
	target := &url.URL{
		Scheme:   "https",
		Host:     vertexStorageHost,
		Path:     path,
		RawPath:  escapedPath,
		RawQuery: input.RawQuery,
	}
	request, err := http.NewRequestWithContext(ctx, input.Method, target.String(), input.Body)
	if err != nil {
		return nil, err
	}
	request.Header = sanitizeStorageRequestHeader(input.Header)
	request.Header.Set("Authorization", "Bearer "+strings.TrimSpace(input.AccessToken))
	if input.ContentLength >= 0 {
		request.ContentLength = input.ContentLength
	}
	return request, nil
}

func sanitizeStorageRequestHeader(source http.Header) http.Header {
	return sanitizeStorageHeader(source, true)
}

func SanitizeStorageResponseHeader(source http.Header) http.Header {
	result := sanitizeStorageHeader(source, false)
	result.Set("Cache-Control", "private, no-store")
	result.Del("Expires")
	result.Del("Age")
	return result
}

func sanitizeStorageHeader(source http.Header, request bool) http.Header {
	result := source.Clone()
	if result == nil {
		result = make(http.Header)
	}
	remove := map[string]struct{}{
		"connection":          {},
		"keep-alive":          {},
		"proxy-authenticate":  {},
		"proxy-authorization": {},
		"proxy-connection":    {},
		"te":                  {},
		"trailer":             {},
		"transfer-encoding":   {},
		"upgrade":             {},
	}
	if request {
		remove["authorization"] = struct{}{}
		remove["host"] = struct{}{}
		remove["content-length"] = struct{}{}
		remove["cookie"] = struct{}{}
		remove["x-api-key"] = struct{}{}
		remove["x-goog-api-key"] = struct{}{}
	}
	for name, values := range source {
		if !strings.EqualFold(name, "Connection") {
			continue
		}
		for _, value := range values {
			for _, nominated := range strings.Split(value, ",") {
				if nominated = strings.ToLower(strings.TrimSpace(nominated)); nominated != "" {
					remove[nominated] = struct{}{}
				}
			}
		}
	}
	for name := range result {
		if _, ok := remove[strings.ToLower(name)]; ok {
			delete(result, name)
		}
	}
	return result
}

func RewriteStorageResumableLocation(location, gatewayBaseURL, bucket string) (string, error) {
	normalizedBucket, err := relayconstant.NormalizeVertexStorageBucket(bucket)
	if err != nil {
		return "", err
	}
	upstream, err := url.Parse(location)
	if err != nil || upstream.Scheme != "https" || upstream.Host != vertexStorageHost || upstream.User != nil || upstream.Fragment != "" {
		return "", errors.New("invalid Vertex storage resumable location")
	}
	expectedPath := "/upload/storage/v1/b/" + url.PathEscape(normalizedBucket) + "/o"
	if upstream.EscapedPath() != expectedPath {
		return "", errors.New("Vertex storage resumable location bucket does not match")
	}

	gateway, err := url.Parse(strings.TrimSpace(gatewayBaseURL))
	if err != nil || (gateway.Scheme != "http" && gateway.Scheme != "https") || gateway.Host == "" || gateway.User != nil {
		return "", errors.New("invalid gateway base URL")
	}
	escapedGatewayPath := relayconstant.VertexStorageRoutePrefix + expectedPath
	gatewayPath, err := url.PathUnescape(escapedGatewayPath)
	if err != nil {
		return "", fmt.Errorf("build Vertex storage resumable gateway path: %w", err)
	}
	gateway.Path = gatewayPath
	gateway.RawPath = escapedGatewayPath
	gateway.RawQuery = upstream.RawQuery
	gateway.ForceQuery = upstream.ForceQuery
	gateway.Fragment = ""
	return gateway.String(), nil
}

func DoStorageProxy(ctx context.Context, input StorageProxyRequest) (*http.Response, error) {
	request, err := buildStorageRequest(ctx, input)
	if err != nil {
		return nil, err
	}
	client, err := service.GetHttpClientWithProxy(input.Proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	storageClient := *client
	storageClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	response, err := storageClient.Do(request)
	if err != nil {
		return nil, err
	}
	response.Header = SanitizeStorageResponseHeader(response.Header)
	return response, nil
}
