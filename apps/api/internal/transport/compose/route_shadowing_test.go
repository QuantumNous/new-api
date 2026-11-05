package compose

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/stretchr/testify/assert"
)

// TestNoRouteIsShadowedByAnEarlierParameterisedRoute pins route reachability,
// which the snapshot test cannot see: TestRegisteredRoutesMatchSnapshot sorts
// the registered paths and compares them as a set, so a route that is
// registered but can never be matched still satisfies it.
//
// fiber scans its route stack in registration order and serves the first match
// (see fiberadapter/router.go). The previous adapter sorted its tree by
// specificity, so a literal segment beat a parameter no matter which was
// registered first; fiber has no such rule.
// handler's response — GET /api/channel/health used to reach GetChannel and
// report `strconv.Atoi: parsing "health"` instead of the health payload.
//
// The check runs over every registered group rather than just the channel
// routes, because the hazard is a property of the adapter and applies wherever
// a group mixes literals with parameters.
func TestNoRouteIsShadowedByAnEarlierParameterisedRoute(t *testing.T) {
	for _, tc := range []struct {
		group    string
		register func(contract.Engine)
	}{
		{"api", SetApiRouter},
		{"dashboard", SetDashboardRouter},
		{"relay", SetRelayRouter},
		{"video", SetVideoRouter},
	} {
		t.Run(tc.group, func(t *testing.T) {
			engine := newRouteSnapshotEngine()
			tc.register(engine)
			// Registration order is load-bearing here, so the slice is read as
			// registered rather than sorted the way the snapshot test reads it.
			registered := *engine.routes

			for i, later := range registered {
				for _, earlier := range registered[:i] {
					if shadows(earlier, later) {
						assert.Fail(t,
							"route is unreachable",
							"%q is registered after %q, which matches it first, so it can never be served",
							later, earlier)
					}
				}
			}
		})
	}
}

// shadows reports whether the earlier route always matches a request the later
// route was registered to serve, which makes the later one unreachable.
//
// The earlier route must carry a parameter or wildcard. A later parameterised
// route legitimately sits behind the literals it generalises, which is the
// ordering the fix relies on, and two pure literals colliding is a different
// defect with a different fix: fiber's non-strict routing makes "/x" and "/x/"
// one route, so no ordering can make both reachable and the fix has to happen
// in the adapter's fiber.Config. That case is reported separately and would
// only be masked by folding it in here.
func shadows(earlier, later string) bool {
	earlierMethod, earlierPath, ok := splitRoute(earlier)
	if !ok || !isParameterised(earlierPath) {
		return false
	}
	laterMethod, laterPath, ok := splitRoute(later)
	if !ok || earlierMethod != laterMethod {
		return false
	}
	if isParameterised(laterPath) {
		return false
	}
	return patternMatches(earlierPath, laterPath)
}

func isParameterised(path string) bool {
	return strings.Contains(path, ":") || strings.Contains(path, "*")
}

// patternMatches reports whether pattern, read the way fiber matches it, covers
// the concrete path literal.
func patternMatches(pattern, literal string) bool {
	patternSegments := routeSegments(pattern)
	literalSegments := routeSegments(literal)

	for i, segment := range patternSegments {
		// A trailing wildcard swallows every remaining segment, so anything at
		// or past this position matches.
		if strings.HasPrefix(segment, "*") {
			return true
		}
		if i >= len(literalSegments) {
			return false
		}
		if strings.HasPrefix(segment, ":") {
			continue
		}
		if segment != literalSegments[i] {
			return false
		}
	}
	return len(patternSegments) == len(literalSegments)
}

// routeSegments splits a route path into its matchable segments. A trailing
// slash is dropped so "/api/channel/route_unit/" is compared as the two
// segments fiber matches it on, which is what makes it collide with
// "/api/channel/:id".
func routeSegments(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func splitRoute(route string) (method string, path string, ok bool) {
	method, path, found := strings.Cut(route, " ")
	if !found {
		return "", "", false
	}
	return method, path, true
}
