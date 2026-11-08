package compose

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebRouterFallbackDispatch(t *testing.T) {
	const indexMarker = "<!doctype html><title>spa-index</title>"

	for _, tc := range []struct {
		name          string
		target        string
		wantStatus    int
		wantIndexBody bool
	}{
		{name: "unmatched api path returns relay not found", target: "/api/does-not-exist", wantStatus: http.StatusNotFound},
		{name: "unmatched v1 path returns relay not found", target: "/v1/does-not-exist", wantStatus: http.StatusNotFound},
		{name: "unmatched assets path returns relay not found", target: "/assets/missing.js", wantStatus: http.StatusNotFound},
		{name: "spa route serves index", target: "/channels", wantStatus: http.StatusOK, wantIndexBody: true},
		{name: "nested spa route serves index", target: "/settings/models", wantStatus: http.StatusOK, wantIndexBody: true},
		{name: "root serves index", target: "/", wantStatus: http.StatusOK, wantIndexBody: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			engine := newRouteSnapshotEngine()
			SetWebRouter(engine, WebAssets{IndexPage: []byte(indexMarker)})
			require.Len(t, engine.noRoute, 1)

			context, recorder := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodGet, tc.target, nil))
			engine.noRoute[0](context)
			require.Equal(t, tc.wantStatus, recorder.Code)

			if tc.wantIndexBody {
				assert.Equal(t, indexMarker, recorder.Body.String())
				assert.Contains(t, recorder.Header().Get("Content-Type"), "text/html")
				assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
			} else {
				assert.NotContains(t, recorder.Body.String(), indexMarker, "API-shaped paths must not receive the SPA index")
			}
		})
	}
}
