package common

import (
	"fmt"
	"path"
	"strings"
)

var AppBasePath = ""

func NormalizeBasePath(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "/" {
		return "", nil
	}
	if !strings.HasPrefix(trimmed, "/") {
		return "", fmt.Errorf("APP_BASE_PATH must start with '/'")
	}
	if strings.ContainsAny(trimmed, "?#") {
		return "", fmt.Errorf("APP_BASE_PATH must not contain query or fragment")
	}

	normalized := strings.TrimRight(trimmed, "/")
	if normalized == "" {
		return "", nil
	}
	cleaned := path.Clean(normalized)
	if cleaned != normalized {
		return "", fmt.Errorf("APP_BASE_PATH contains invalid path segments")
	}
	return normalized, nil
}

func SessionCookiePath() string {
	if AppBasePath == "" {
		return "/"
	}
	return AppBasePath
}

func WithAppBasePath(routePath string) string {
	if AppBasePath == "" {
		if routePath == "" {
			return "/"
		}
		return routePath
	}

	if routePath == "" || routePath == "/" {
		return AppBasePath
	}

	normalized := routePath
	if !strings.HasPrefix(normalized, "/") {
		normalized = "/" + normalized
	}
	if normalized == AppBasePath || strings.HasPrefix(normalized, AppBasePath+"/") {
		return normalized
	}
	return AppBasePath + normalized
}

func StripAppBasePath(requestPath string) (string, bool) {
	if AppBasePath == "" {
		if requestPath == "" {
			return "/", true
		}
		return requestPath, true
	}

	if requestPath == AppBasePath {
		return "/", true
	}
	if strings.HasPrefix(requestPath, AppBasePath+"/") {
		stripped := strings.TrimPrefix(requestPath, AppBasePath)
		if stripped == "" {
			return "/", true
		}
		return stripped, true
	}
	return "", false
}
