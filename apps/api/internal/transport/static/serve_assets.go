package static

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	handler "github.com/QuantumNous/new-api/internal/transport/handler"
	"github.com/QuantumNous/new-api/internal/transport/middleware"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

// ServeStatic registers static file serving and SPA fallback for the dashboard.
// The middleware chain (gzip, rate limit, cache) should be applied by the caller.
func ServeStatic(router contract.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	router.ServeAssets("/", frontendFS)
	router.NoRoute(func(cc contract.Context) {
		cc.Set(middleware.RouteTagKey, "web")
		uri := cc.RequestURI()
		if strings.HasPrefix(uri, "/v1") || strings.HasPrefix(uri, "/api") || strings.HasPrefix(uri, "/assets") {
			handler.RelayNotFound(cc)
			return
		}
		// no-store, not no-cache: no-cache still lets a browser (or an
		// intermediary) keep the document and reuse it after a 304, which
		// pairs a stale index.html with a chunk set that no longer exists.
		cc.SetHeader("Cache-Control", "no-store")
		_ = cc.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}
