// gen-admin-openapi reads the existing docs/openapi/api.json admin spec,
// parses Go struct types from model/* via AST, and rewrites every operation's
// responses["200"] with a typed ApiResponseOf<X> wrapper based on the manifest
// in this package. Untouched: top-level info/tags/security/servers, per-op
// summary/description/tags/parameters/security.
//
// requestBody policy:
//   - placeholder bodies from the legacy spec template are wiped (clearPlaceholderBodies)
//   - controller AST analysis is authoritative (enrichFromHandlers)
//   - manifest.Body provides a fallback $ref when AST yields nothing
//
// Pass -check to validate without writing the file (CI hook).
//
// Usage:
//
//	go run ./cmd/gen-admin-openapi/         (regenerate + write)
//	go run ./cmd/gen-admin-openapi/ -check  (validate only, exit 1 on errors)
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

var (
	checkOnly  = flag.Bool("check", false, "validate without writing api.json (CI mode)")
	localeFlag = flag.String("locale", "", "single locale to generate (en|zh|ru); empty = all")
)

func main() {
	flag.Parse()
	locales := supportedLocales
	if *localeFlag != "" {
		if !localeOK(*localeFlag) {
			fmt.Fprintln(os.Stderr, "error: unknown locale:", *localeFlag)
			os.Exit(1)
		}
		locales = []string{*localeFlag}
	}
	// Parse model/dto/controller/router ONCE (independent of locale).
	if err := bootstrap(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	for _, loc := range locales {
		currentLocale = loc
		if err := run(loc); err != nil {
			fmt.Fprintln(os.Stderr, "error (", loc, "):", err)
			os.Exit(1)
		}
	}
}

// bootstrap performs the one-time AST parsing that's independent of locale.
// Splitting this out lets the locale loop reuse the parsed handlers/routes/
// schemas without re-walking the source on every iteration.
func bootstrap() error {
	if err := parseModels("./model"); err != nil {
		return fmt.Errorf("parse models: %w", err)
	}
	for _, dir := range []string{"./dto", "./pkg/ionet"} {
		if err := parseModels(dir); err != nil {
			return fmt.Errorf("parse %s: %w", dir, err)
		}
	}
	for _, dir := range []string{
		"./common",
		"./setting",
		"./setting/system_setting",
		"./setting/operation_setting",
		"./setting/console_setting",
		"./setting/ratio_setting",
		"./setting/billing_setting",
		"./setting/performance_setting",
		"./constant",
		"./service",
	} {
		scanPackageVars(dir)
	}
	if err := parseControllers("./controller"); err != nil {
		return fmt.Errorf("parse controllers: %w", err)
	}
	if err := parseRoutes("./router"); err != nil {
		return fmt.Errorf("parse routes: %w", err)
	}
	dedupeRoutes()
	return nil
}

func run(locale string) error {
	// Re-read the base spec from disk per locale so each invocation starts
	// fresh (avoid carrying mutations between locales).
	rawSpec, err := os.ReadFile("./docs/openapi/api.json")
	if err != nil {
		return fmt.Errorf("read spec: %w", err)
	}
	var spec map[string]interface{}
	if err := json.Unmarshal(rawSpec, &spec); err != nil {
		return fmt.Errorf("parse spec: %w", err)
	}

	// Apply locale-aware top-level metadata.
	info, _ := spec["info"].(map[string]interface{})
	if info == nil {
		info = map[string]interface{}{}
		spec["info"] = info
	}
	info["title"] = translate(locale, "info.title")
	info["description"] = translate(locale, "info.description")

	paths, _ := spec["paths"].(map[string]interface{})
	if paths == nil {
		return fmt.Errorf("spec has no paths")
	}

	// Reset per-run mutation state. referencedTypes accumulates across the
	// pipeline; each locale needs a fresh count so schema sweep is correct.
	referencedTypes = map[string]bool{}

	// Apply spec mutations:
	//   1. removeFakePaths         — drop paths that don't exist in the router
	//   2. clearPlaceholderBodies  — wipe legacy template bodies
	//   3. applyManifest           — set responses + register manifest body refs
	//   4. enrichFromHandlers      — AST-derived bodies/responses/summaries
	//   5. enrichErrorResponses    — per-endpoint x-error-codes + examples
	//   6. applyManifestBodies     — manifest-declared body fallback
	//   7. defaultUntypedResponses — ensure every operation has 200 + default 4xx/5xx
	removeFakePaths(paths)
	clearPlaceholderBodies(paths)
	applyManifest(paths)
	enrichFromHandlers(paths)
	applyManifestBodies(paths)
	defaultUntypedResponses(paths)
	enrichErrorResponses(paths)

	schemas := buildSchemas()

	components, _ := spec["components"].(map[string]interface{})
	if components == nil {
		components = map[string]interface{}{}
		spec["components"] = components
	}
	existingSchemas, _ := components["schemas"].(map[string]interface{})
	if existingSchemas == nil {
		existingSchemas = map[string]interface{}{}
	}
	for name, sch := range schemas {
		existingSchemas[name] = sch
	}
	components["schemas"] = existingSchemas

	// Sweep unreferenced schemas. The generator merges new schemas into the
	// existing map without removing stale entries — without this pass, schemas
	// from previous manifest versions persist as dead code in the spec and
	// surface in regenerated SDKs.
	swept := sweepUnreferencedSchemas(spec, existingSchemas)
	if swept > 0 {
		fmt.Printf("    swept:      %d unreferenced schema(s)\n", swept)
	}

	out, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')
	outPath := "./docs/openapi/api." + locale + ".json"
	if !*checkOnly {
		if err := os.WriteFile(outPath, out, 0644); err != nil {
			return err
		}
		// en is also written to api.json as the default-locale alias (existing
		// tooling/SDK consumers read api.json without specifying a locale).
		if locale == "en" {
			if err := os.WriteFile("./docs/openapi/api.json", out, 0644); err != nil {
				return err
			}
		}
		fmt.Printf("ok: %s updated\n", outPath)
	} else {
		fmt.Printf("check (%s): skipping write (--check mode)\n", locale)
	}
	fmt.Printf("    schemas:    %d\n", len(existingSchemas))
	fmt.Printf("    paths:      %d\n", len(paths))
	fmt.Printf("    routes:     %d\n", len(routes))
	// Surface dangling refs — useful for catching name drift after refactors.
	specJSON, _ := json.Marshal(spec)
	missing := []string{}
	for ref := range collectRefs(string(specJSON)) {
		if _, ok := existingSchemas[ref]; !ok {
			missing = append(missing, ref)
		}
	}
	if len(missing) > 0 {
		fmt.Printf("    WARN: %d dangling $refs:\n", len(missing))
		for _, m := range missing {
			fmt.Println("     -", m)
		}
	}

	// Run schema validation. Errors fail the build; warnings are surfaced.
	issues, _ := validateSpec(paths, components)
	errCount := printIssues(issues)
	if errCount > 0 {
		return fmt.Errorf("spec validation failed: %d errors", errCount)
	}
	// Route↔spec coverage. Gaps fail the run: a route absent from the spec is
	// an undocumented endpoint, a spec path absent from the router is a 404.
	missingRoutes, stalePaths := reportRouteCoverage(paths)
	if missingRoutes > 0 || stalePaths > 0 {
		return fmt.Errorf("route coverage failed: %d routes not in spec, %d spec paths not routed", missingRoutes, stalePaths)
	}
	return nil
}

// sweepUnreferencedSchemas removes components.schemas entries that are not
// reachable from paths via $ref, including transitive dependencies. Returns
// the count of removed schemas.
//
// Roots: every $ref appearing in spec.paths.
// Reachable: roots ∪ all $refs found inside reachable schemas (BFS).
// Removed: schemas not in reachable set.
func sweepUnreferencedSchemas(spec map[string]interface{}, schemas map[string]interface{}) int {
	paths, _ := spec["paths"].(map[string]interface{})
	if paths == nil {
		return 0
	}

	pathsJSON, _ := json.Marshal(paths)
	reachable := map[string]bool{}
	queue := []string{}
	for ref := range collectRefs(string(pathsJSON)) {
		if _, ok := schemas[ref]; ok && !reachable[ref] {
			reachable[ref] = true
			queue = append(queue, ref)
		}
	}

	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]
		schemaJSON, err := json.Marshal(schemas[name])
		if err != nil {
			continue
		}
		for ref := range collectRefs(string(schemaJSON)) {
			if _, ok := schemas[ref]; ok && !reachable[ref] {
				reachable[ref] = true
				queue = append(queue, ref)
			}
		}
	}

	removed := 0
	for name := range schemas {
		if !reachable[name] {
			delete(schemas, name)
			removed++
		}
	}
	return removed
}

func collectRefs(text string) map[string]bool {
	out := map[string]bool{}
	const pre = `"$ref":"#/components/schemas/`
	i := 0
	for {
		j := indexFrom(text, pre, i)
		if j < 0 {
			return out
		}
		j += len(pre)
		k := indexFrom(text, `"`, j)
		if k < 0 {
			return out
		}
		out[text[j:k]] = true
		i = k
	}
}

func indexFrom(s, sub string, from int) int {
	if from >= len(s) {
		return -1
	}
	idx := 0
	for idx < len(s)-from {
		if from+idx+len(sub) > len(s) {
			return -1
		}
		if s[from+idx:from+idx+len(sub)] == sub {
			return from + idx
		}
		idx++
	}
	return -1
}
