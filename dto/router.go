package dto

import (
	"net/http"
	"reflect"
	"runtime"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/extra/fuegogin"
	"github.com/go-fuego/fuego/option"
)

// usedOperationIDs tracks operationIds to prevent collisions.
var usedOperationIDs sync.Map

// noopEngine is used when OpenAPI is disabled. fuegogin still needs a non-nil
// engine to register the gin handler, but no spec metadata is collected.
var noopEngine = fuego.NewEngine()

// Router captures shared route registration parameters (engine, group, tag,
// security) so individual route calls don't need to repeat them.
type Router struct {
	engine   *fuego.Engine
	group    gin.IRouter
	tag      string
	basePath string
	security []func(*fuego.BaseRoute)
}

// NewRouter creates a Router with shared defaults for a group of routes.
func NewRouter(engine *fuego.Engine, group gin.IRouter, tag string, security ...func(*fuego.BaseRoute)) *Router {
	base := ""
	if rg, ok := group.(*gin.RouterGroup); ok {
		base = rg.BasePath()
	}
	return &Router{engine: engine, group: group, tag: tag, basePath: base, security: security}
}

// WithTag creates a Router copy with a different OpenAPI tag.
func (r *Router) WithTag(tag string) *Router {
	return &Router{engine: r.engine, group: r.group, tag: tag, basePath: r.basePath, security: r.security}
}

// coreOpts prepends tag, security, summary, and operationId to user-provided options.
// Falls back to a path-derived operationId when the handler name is already claimed.
func (r *Router) coreOpts(method string, path string, handler any, extra []func(*fuego.BaseRoute)) []func(*fuego.BaseRoute) {
	id := claimID(handlerID(handler))
	if id == "" {
		id = claimID(pathToOperationID(method, r.basePath+path))
	}
	opts := make([]func(*fuego.BaseRoute), 0, 3+len(r.security)+len(extra))
	opts = append(opts, option.Tags(r.tag))
	if id != "" {
		opts = append(opts, option.Summary(handlerSummary(id)), option.OperationID(id))
	}
	opts = append(opts, r.security...)
	opts = append(opts, extra...)
	return opts
}

// claimID stores id in usedOperationIDs and returns it. If already taken or empty, returns empty string.
func claimID(id string) string {
	if id == "" {
		return ""
	}
	if _, loaded := usedOperationIDs.LoadOrStore(id, true); loaded {
		return ""
	}
	return id
}

// handlerID extracts the raw function name for use as an operationId.
// e.g. controller.GetAllTokens → "getAllTokens"
// Returns empty string for anonymous functions (func1, func2, etc.)
func handlerID(f any) string {
	full := strings.TrimSuffix(runtime.FuncForPC(reflect.ValueOf(f).Pointer()).Name(), "-fm")
	if idx := strings.LastIndex(full, "."); idx >= 0 {
		full = full[idx+1:]
	}
	// Skip anonymous closures like func1, func2 — let path-based ID take over
	if strings.HasPrefix(full, "func") {
		return ""
	}
	if len(full) > 0 {
		full = strings.ToLower(full[:1]) + full[1:]
	}
	return full
}

// pathToOperationID converts an HTTP method and path to a camelCase operationId.
// e.g. "GET", "/messages" → "getMessages"
// e.g. "POST", "/submit/imagine" → "postSubmitImagine"
// e.g. "POST", "/:mode/mj/submit/action" → "postModeModeMjSubmitAction"
// Wildcard params (*path) are skipped, named params (:id) are included.
func pathToOperationID(method, path string) string {
	method = strings.ToLower(method)
	path = strings.TrimPrefix(path, "/")
	parts := strings.Split(path, "/")
	var b strings.Builder
	b.WriteString(method)
	for _, p := range parts {
		if p == "" || p[0] == '*' {
			continue
		}
		// Include named params: ":mode" → "Mode"
		if p[0] == ':' {
			p = p[1:]
		}
		for _, seg := range strings.Split(p, "-") {
			if seg == "" {
				continue
			}
			b.WriteString(strings.ToUpper(seg[:1]))
			b.WriteString(seg[1:])
		}
	}
	return b.String()
}

// handlerSummary converts a function name into a human-readable summary.
// e.g. "getAllTokens" → "Get All Tokens"
func handlerSummary(id string) string {
	if len(id) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteRune(rune(strings.ToUpper(id[:1])[0]))
	for _, r := range id[1:] {
		if 'A' <= r && r <= 'Z' {
			b.WriteRune(' ')
		}
		b.WriteRune(r)
	}
	return b.String()
}

// withJSONBody prepends option.RequestContentType("application/json") so that
// the OpenAPI spec uses "application/json" instead of the default "*/*" for
// body-accepting routes.
func withJSONBody(opts []func(*fuego.BaseRoute)) []func(*fuego.BaseRoute) {
	return append([]func(*fuego.BaseRoute){option.RequestContentType("application/json")}, opts...)
}

// --- Native fuego typed route registration ---
// Fuego's fuegogin adapter infers the response schema from the handler's return
// type parameter T via RegisterOpenAPIOperation, so no explicit response option
// is needed here. Extra opts (e.g. dto.Resp[T]() for ApiResponse overrides) are
// appended and take precedence when present.

// Get registers a native fuego GET route (no body).
func Get[T any](r *Router, path string, handler func(c fuego.ContextNoBody) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Get(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Get(r.engine, r.group, path, handler, r.coreOpts("GET", path, handler, opts)...)
}

// Post registers a native fuego POST route (no body type).
func Post[T any](r *Router, path string, handler func(c fuego.ContextNoBody) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Post(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Post(r.engine, r.group, path, handler, r.coreOpts("POST", path, handler, opts)...)
}

// PostB registers a native fuego POST route with typed body.
func PostB[T, B any](r *Router, path string, handler func(c fuego.ContextWithBody[B]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Post(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Post(r.engine, r.group, path, handler, r.coreOpts("POST", path, handler, withJSONBody(opts))...)
}

// Put registers a native fuego PUT route (no body type).
func Put[T any](r *Router, path string, handler func(c fuego.ContextNoBody) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Put(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Put(r.engine, r.group, path, handler, r.coreOpts("PUT", path, handler, opts)...)
}

// PutB registers a native fuego PUT route with typed body.
func PutB[T, B any](r *Router, path string, handler func(c fuego.ContextWithBody[B]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Put(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Put(r.engine, r.group, path, handler, r.coreOpts("PUT", path, handler, withJSONBody(opts))...)
}

// Delete registers a native fuego DELETE route (no body).
func Delete[T any](r *Router, path string, handler func(c fuego.ContextNoBody) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Delete(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Delete(r.engine, r.group, path, handler, r.coreOpts("DELETE", path, handler, opts)...)
}

// DeleteB registers a native fuego DELETE route with typed body.
func DeleteB[T, B any](r *Router, path string, handler func(c fuego.ContextWithBody[B]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Delete(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Delete(r.engine, r.group, path, handler, r.coreOpts("DELETE", path, handler, withJSONBody(opts))...)
}

// PatchB registers a native fuego PATCH route with typed body.
func PatchB[T, B any](r *Router, path string, handler func(c fuego.ContextWithBody[B]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Patch(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Patch(r.engine, r.group, path, handler, r.coreOpts("PATCH", path, handler, withJSONBody(opts))...)
}

// --- Typed params route registration ---
// These variants accept ContextWithParams[P] handlers. fuego's RegisterParams()
// auto-generates OpenAPI query/header parameter docs from the P struct's tags,
// so no option.Query() annotations are needed.

// GetP registers a native fuego GET route with typed params (no body).
func GetP[T, P any](r *Router, path string, handler func(c fuego.ContextWithParams[P]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Get(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Get(r.engine, r.group, path, handler, r.coreOpts("GET", path, handler, opts)...)
}

// PostP registers a native fuego POST route with typed params (no body).
func PostP[T, P any](r *Router, path string, handler func(c fuego.ContextWithParams[P]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Post(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Post(r.engine, r.group, path, handler, r.coreOpts("POST", path, handler, opts)...)
}

// DeleteP registers a native fuego DELETE route with typed params (no body).
func DeleteP[T, P any](r *Router, path string, handler func(c fuego.ContextWithParams[P]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Delete(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Delete(r.engine, r.group, path, handler, r.coreOpts("DELETE", path, handler, opts)...)
}

// PutBP registers a native fuego PUT route with typed body AND typed params.
func PutBP[T, B, P any](r *Router, path string, handler func(c fuego.Context[B, P]) (T, error), opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.Put(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.Put(r.engine, r.group, path, handler, r.coreOpts("PUT", path, handler, withJSONBody(opts))...)
}

// --- Gin handler route registration ---

// ginOpts builds options for raw gin handlers. Since gin handlers are registered
// as Route[any,any,any], fuego cannot infer the response type. A default
// ApiResponse schema is prepended; callers override it with GinResp[T]().
func (r *Router) ginOpts(method, path string, handler gin.HandlerFunc, extra []func(*fuego.BaseRoute)) []func(*fuego.BaseRoute) {
	core := r.coreOpts(method, path, handler, extra)
	opts := make([]func(*fuego.BaseRoute), 0, 1+len(core))
	opts = append(opts, fuego.OptionAddResponse(http.StatusOK, "OK", fuego.Response{Type: ApiResponse{}}))
	opts = append(opts, core...)
	return opts
}

// GinResp overrides the default ApiResponse schema for Gin* routes with a typed response.
func GinResp[T any]() func(*fuego.BaseRoute) {
	return fuego.OptionAddResponse(http.StatusOK, "OK", fuego.Response{Type: *new(T)})
}

// GinBody annotates a Gin handler route with a typed JSON request body in the OpenAPI spec.
func GinBody[T any]() func(*fuego.BaseRoute) {
	return fuego.OptionRequestBody(fuego.RequestBody{Type: *new(T), ContentTypes: []string{"application/json"}})
}

// GinGet registers a raw gin handler GET route.
func (r *Router) GinGet(path string, handler gin.HandlerFunc, opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.GetGin(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.GetGin(r.engine, r.group, path, handler, r.ginOpts("GET", path, handler, opts)...)
}

// GinPost registers a raw gin handler POST route.
func (r *Router) GinPost(path string, handler gin.HandlerFunc, opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.PostGin(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.PostGin(r.engine, r.group, path, handler, r.ginOpts("POST", path, handler, opts)...)
}

// GinDelete registers a raw gin handler DELETE route.
func (r *Router) GinDelete(path string, handler gin.HandlerFunc, opts ...func(*fuego.BaseRoute)) {
	if r.engine == nil {
		fuegogin.DeleteGin(noopEngine, r.group, path, handler)
		return
	}
	fuegogin.DeleteGin(r.engine, r.group, path, handler, r.ginOpts("DELETE", path, handler, opts)...)
}
