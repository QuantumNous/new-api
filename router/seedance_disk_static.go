package router

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// seedanceDiskFiles maps public URLs to paths under web/{theme}/public/.
// When the file exists on disk (e.g. running from the repo root), it is served
// live so edits take effect without rebuilding the frontend or Go binary.
var seedanceDiskFiles = map[string]string{
	"/seedance-debug.html":      "seedance-debug.html",
	"/docs/seedance-4models.md": "docs/seedance-4models.md",
}

func seedanceDiskOverride() gin.HandlerFunc {
	return func(c *gin.Context) {
		rel, ok := seedanceDiskFiles[c.Request.URL.Path]
		if !ok {
			c.Next()
			return
		}
		data, _ := readSeedancePublicFile(rel)
		if data == nil {
			c.Next()
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, seedanceContentType(rel), data)
		c.Abort()
	}
}

func seedanceContentType(rel string) string {
	switch {
	case strings.HasSuffix(rel, ".html"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(rel, ".md"):
		return "text/markdown; charset=utf-8"
	default:
		return "text/plain; charset=utf-8"
	}
}

func readSeedancePublicFile(rel string) ([]byte, string) {
	theme := common.GetTheme()
	other := "default"
	if theme != "classic" {
		other = "classic"
	}
	candidates := []string{
		filepath.Join("web", theme, "public", filepath.FromSlash(rel)),
		filepath.Join("web", other, "public", filepath.FromSlash(rel)),
	}
	for _, p := range candidates {
		clean := filepath.Clean(p)
		data, err := os.ReadFile(clean)
		if err != nil {
			continue
		}
		return data, clean
	}
	return nil, ""
}
