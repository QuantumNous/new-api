package middleware

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const (
	OriginalRequestPathKey = "original_request_path"
	OriginalRequestURIKey  = "original_request_uri"
)

func StripAppBasePath() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.AppBasePath == "" || c.Request == nil || c.Request.URL == nil {
			c.Next()
			return
		}

		originalPath := c.Request.URL.Path
		strippedPath, ok := common.StripAppBasePath(originalPath)
		if !ok {
			c.Next()
			return
		}

		c.Set(OriginalRequestPathKey, originalPath)
		c.Set(OriginalRequestURIKey, c.Request.RequestURI)

		c.Request.URL.Path = strippedPath
		if c.Request.URL.RawPath != "" {
			if strippedRawPath, ok := common.StripAppBasePath(c.Request.URL.RawPath); ok {
				c.Request.URL.RawPath = strippedRawPath
			} else {
				c.Request.URL.RawPath = ""
			}
		}
		c.Request.RequestURI = stripRequestURIBasePath(c.Request.RequestURI)

		c.Next()
	}
}

func stripRequestURIBasePath(requestURI string) string {
	if requestURI == "" || common.AppBasePath == "" {
		return requestURI
	}

	pathPart := requestURI
	queryPart := ""
	if idx := strings.IndexByte(requestURI, '?'); idx >= 0 {
		pathPart = requestURI[:idx]
		queryPart = requestURI[idx:]
	}

	strippedPath, ok := common.StripAppBasePath(pathPart)
	if !ok {
		return requestURI
	}
	return strippedPath + queryPart
}
