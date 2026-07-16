package main

import (
	"fmt"
	"sort"
	"strings"
)

// reportRouteCoverage cross-checks parsed router declarations against spec
// paths and prints WARN lines for gaps in either direction. Scope is the
// admin API only (/api/*): relay/video/web routes are out of spec by design.
//
// Returns (missingFromSpec, staleInSpec) counts so -check can enforce.
func reportRouteCoverage(paths map[string]interface{}) (int, int) {
	specOps := map[string]bool{}
	for path, v := range paths {
		methods, _ := v.(map[string]interface{})
		for m := range methods {
			switch m {
			case "get", "post", "put", "delete", "patch":
				specOps[strings.ToUpper(m)+" "+path] = true
			}
		}
	}

	routeOps := map[string]bool{}
	for _, r := range routes {
		if !strings.HasPrefix(r.Path, "/api/") {
			continue
		}
		routeOps[r.Method+" "+r.Path] = true
	}

	missing := []string{}
	for op := range routeOps {
		if !specOps[op] {
			missing = append(missing, op)
		}
	}
	stale := []string{}
	for op := range specOps {
		if !routeOps[op] {
			stale = append(stale, op)
		}
	}
	sort.Strings(missing)
	sort.Strings(stale)
	for _, op := range missing {
		fmt.Printf("     [WARN] ROUTE_NOT_IN_SPEC %s\n", op)
	}
	for _, op := range stale {
		fmt.Printf("     [WARN] SPEC_PATH_NOT_ROUTED %s\n", op)
	}
	return len(missing), len(stale)
}
