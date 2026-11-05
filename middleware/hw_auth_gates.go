package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// The gate hook runs at the end of the success path of TokenAuth and UserAuth,
// so a route does not repeat the free-group limit or the reserve gate in its own
// chain. Which gates a request gets follows from the auth that let it through and
// the route it matched; the maps below are that decision as data.
//
// Both lists are compared against the matched route pattern, never the raw path,
// so a value in the URL cannot move a request in or out of a list.
const (
	hwAuthToken = "token"
	hwAuthUser  = "user"
)

// hwAuthFreeGroupExemptions are the token routes that spend nothing, so they stay
// outside the free-trial request budget: the model catalogues, the billing reads
// and the task and video reads a client polls. Polling a task is a read of work
// that was already paid for when it was submitted, so counting it would exhaust
// the day within a few tasks.
var hwAuthFreeGroupExemptions = map[string]struct{}{
	http.MethodGet + " /v1/models":                         {},
	http.MethodGet + " /v1/models/:model":                  {},
	http.MethodGet + " /v1beta/models":                     {},
	http.MethodGet + " /v1beta/openai/models":              {},
	http.MethodGet + " /dashboard/billing/subscription":    {},
	http.MethodGet + " /dashboard/billing/usage":           {},
	http.MethodGet + " /v1/dashboard/billing/subscription": {},
	http.MethodGet + " /v1/dashboard/billing/usage":        {},
	http.MethodGet + " /v1/tasks/:key":                     {},
	http.MethodGet + " /v1/tasks/:key/artifacts":           {},
	http.MethodGet + " /v1/responses/:response_id":         {},
	http.MethodGet + " /v1/video/generations/:task_id":     {},
	http.MethodGet + " /v1/videos/:task_id":                {},
	http.MethodGet + " /v1/videos/:task_id/content":        {},
	http.MethodHead + " /v1/videos/:task_id/content":       {},
}

// hwAuthReserveRoutes are the token routes that start or resume customer work on
// a channel, which is what the bureau reserve protects: the relay group under
// /v1 and the Gemini generate call. A read, a task submit through the plugin
// surface and the image and video plugin operations are outside it, as they were
// before the gate moved here.
var hwAuthReserveRoutes = map[string]struct{}{
	"DELETE /v1/files/:id":               {},
	"DELETE /v1/models/:model":           {},
	"GET /v1/files":                      {},
	"GET /v1/files/:id/content":          {},
	"GET /v1/fine-tunes":                 {},
	"GET /v1/fine-tunes/:id":             {},
	"GET /v1/fine-tunes/:id/events":      {},
	"GET /v1/realtime":                   {},
	"GET /v1/responses":                  {},
	"POST /v1/alpha/search":              {},
	"POST /v1/audio/speech":              {},
	"POST /v1/audio/transcriptions":      {},
	"POST /v1/audio/translations":        {},
	"POST /v1/chat/completions":          {},
	"POST /v1/completions":               {},
	"POST /v1/edits":                     {},
	"POST /v1/embeddings":                {},
	"POST /v1/engines/:model/embeddings": {},
	"POST /v1/files":                     {},
	"POST /v1/fine-tunes":                {},
	"POST /v1/fine-tunes/:id/cancel":     {},
	"POST /v1/images/variations":         {},
	"POST /v1/messages":                  {},
	"POST /v1/models/*path":              {},
	"POST /v1/moderations":               {},
	"POST /v1/rerank":                    {},
	"POST /v1/responses/compact":         {},
	"POST /v1/tools/fetch":               {},
	"POST /v1/tools/search":              {},
	"POST /v1beta/models/*path":          {},
}

// HwAuthGatesFor reports which gates the request must pass after this auth.
//
// A dashboard login (user) only reaches the playground, which is the single route
// where the browser sends a chat completion through the relay; every other
// dashboard route is a management call that spends no credit and stays outside
// both gates. A token reaches the whole customer surface, so it gets the
// free-trial budget unless the route is listed as spending nothing, and the
// reserve gate only on the routes in the list.
//
// A route that matches neither list keeps the safe pair: the usage limit on, the
// reserve gate off. A new customer route therefore starts inside the trial
// budget without anyone remembering to add it.
func HwAuthGatesFor(auth, method, fullPath string) (freeGroup, reserve bool) {
	key := method + " " + fullPath
	switch auth {
	case hwAuthUser:
		if key == "POST /pg/chat/completions" {
			return true, true
		}
		return false, false
	case hwAuthToken:
		if _, exempt := hwAuthFreeGroupExemptions[key]; exempt {
			return false, false
		}
		_, reserve = hwAuthReserveRoutes[key]
		return true, reserve
	default:
		return false, false
	}
}

// hwAuthKind names the auth function that is about to hand the request on. Only
// the common-user auth reaches a route that spends credit; the admin and root
// auth share authHelper but never gate.
func hwAuthKind(minRole int) string {
	if minRole == common.RoleCommonUser {
		return hwAuthUser
	}
	return ""
}

// hwAfterAuth applies the gates HwAuthGatesFor selects, free-group first, and
// reports whether the request may continue. A gate that refuses has already
// written the refusal, so the caller must return without running the chain.
// TokenAuth and authHelper call it at the end of their success path, so a route
// carries neither gate in its own chain.
func hwAfterAuth(c *gin.Context, auth string) bool {
	freeGroup, reserve := HwAuthGatesFor(auth, c.Request.Method, c.FullPath())
	if freeGroup && !hwFreeGroupGate(c) {
		return false
	}
	if reserve && !hwBureauReserveGate(c) {
		return false
	}
	return true
}

// HwFreeGroupRateLimit exposes hwFreeGroupGate as a middleware. The router no
// longer mounts it, because the gate runs from the auth hook: it stays for the
// route-level tests that build their own chain from customer routes and still
// have to prove what the guard refuses.
func HwFreeGroupRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if hwFreeGroupGate(c) {
			c.Next()
		}
	}
}
