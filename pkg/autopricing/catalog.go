// Package autopricing turns an upstream LiteLLM pricing catalog
// (model_prices_and_context_window.json) into Ren2Hub ratio units and resolves
// a model name against it.
//
// This package is a fallback source only: setting/ratio_setting consults it
// exclusively for models that have no manual ratio and no manual fixed price,
// so administrator-configured pricing always wins. Nothing here writes back
// into the manual ratio maps or Options.
package autopricing

import (
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Entry is the normalized pricing of one model in Ren2Hub ratio units.
//
// The Has* flags distinguish "the catalog states this price" from "the catalog
// is silent". In particular, image-only entries must not look like zero-priced
// token models merely because ModelRatio's zero value is zero.
type Entry struct {
	ModelRatio          float64
	HasModelRatio       bool
	CompletionRatio     float64
	CacheRatio          float64
	HasCacheRatio       bool
	CreateCacheRatio    float64
	HasCreateCacheRatio bool
	PerRequestPrice     float64
	HasPerRequestPrice  bool
	PerImagePrice       float64
	HasPerImagePrice    bool
	// CatalogKey is the catalog entry that produced this pricing. It differs
	// from the requested model name whenever a fuzzy rule matched.
	CatalogKey     string
	Source         SourceID             `json:"source"`
	FieldSources   map[FieldID]SourceID `json:"field_sources,omitempty"`
	BillingExpr    string               `json:"billing_expr,omitempty"`
	HasBillingExpr bool                 `json:"has_billing_expr,omitempty"`
}

// Catalog is an immutable snapshot of one downloaded pricing document.
// It is replaced wholesale on every successful sync and never mutated in place.
type Catalog struct {
	entries map[string]Entry
	// sortedKeys keeps substring scans deterministic. Go map iteration order is
	// random, and family matching returns the first substring hit, so scanning
	// an unordered map would price the same model differently across restarts.
	sortedKeys []string
	// baseIndex maps a date-stripped model name to its canonical catalog key.
	baseIndex map[string]string

	Version    string
	UpdatedAt  time.Time
	ModelCount int
	// SkippedCount counts entries dropped as unusable (unparseable or failing
	// validation).
	SkippedCount   int
	records        map[string]PriceRecord
	SourceVersions map[SourceID]string `json:"source_versions,omitempty"`
}

// CatalogSnapshot is the durable representation of an immutable catalog.
// Runtime indexes are rebuilt on restore instead of being persisted.
type CatalogSnapshot struct {
	Version        string                 `json:"version"`
	UpdatedAt      time.Time              `json:"updated_at"`
	SkippedCount   int                    `json:"skipped_count"`
	Records        map[string]PriceRecord `json:"records"`
	SourceVersions map[SourceID]string    `json:"source_versions,omitempty"`
}

// Snapshot returns an independent copy suitable for JSON persistence.
func (c *Catalog) Snapshot() *CatalogSnapshot {
	if c == nil {
		return nil
	}
	versions := make(map[SourceID]string, len(c.SourceVersions))
	for source, version := range c.SourceVersions {
		versions[source] = version
	}
	return &CatalogSnapshot{
		Version:        c.Version,
		UpdatedAt:      c.UpdatedAt,
		SkippedCount:   c.SkippedCount,
		Records:        cloneRecords(c.records),
		SourceVersions: versions,
	}
}

// RestoreCatalog validates a persisted snapshot and rebuilds runtime indexes.
func RestoreCatalog(snapshot *CatalogSnapshot) (*Catalog, error) {
	if snapshot == nil {
		return nil, nil
	}
	catalog, err := catalogFromRecords(snapshot.Records, snapshot.Version, snapshot.SourceVersions)
	if err != nil {
		return nil, err
	}
	if !snapshot.UpdatedAt.IsZero() {
		catalog.UpdatedAt = snapshot.UpdatedAt
	}
	catalog.SkippedCount = snapshot.SkippedCount
	return catalog, nil
}

// Lookup resolves a single catalog key without any fuzzy rule.
func (c *Catalog) Lookup(key string) (Entry, bool) {
	if c == nil {
		return Entry{}, false
	}
	entry, ok := c.entries[key]
	return entry, ok
}

// Keys returns the catalog keys in sorted order. Test and diagnostic use only.
func (c *Catalog) Keys() []string {
	if c == nil {
		return nil
	}
	return c.sortedKeys
}

func newCatalog(entries map[string]Entry, version string, skipped int) *Catalog {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	baseIndex := make(map[string]string, len(keys))
	for _, key := range keys {
		base := stripDateSegments(key)
		if base == "" {
			continue
		}
		if current, exists := baseIndex[base]; exists && !preferBaseKey(key, current) {
			continue
		}
		baseIndex[base] = key
	}

	return &Catalog{
		entries:      entries,
		sortedKeys:   keys,
		baseIndex:    baseIndex,
		Version:      version,
		UpdatedAt:    time.Now(),
		ModelCount:   len(entries),
		SkippedCount: skipped,
	}
}

// preferBaseKey decides which catalog key represents a shared base name. The
// shortest key is the undated canonical one (claude-opus-4-5 over
// claude-opus-4-5-20251101); length ties fall back to lexicographic order so
// the choice stays stable.
func preferBaseKey(candidate, current string) bool {
	if len(candidate) != len(current) {
		return len(candidate) < len(current)
	}
	return candidate < current
}

// fuzzyMemoLimit bounds the negative/positive fuzzy cache. Model names arrive
// from client request bodies, so an unbounded cache is a memory amplification
// vector. Real deployments serve far fewer distinct names than this.
const fuzzyMemoLimit = 4096

type fuzzyResult struct {
	entry  Entry
	hasHit bool
}

var (
	current   atomic.Pointer[Catalog]
	fuzzyMu   sync.RWMutex
	fuzzyMemo = make(map[string]fuzzyResult)
)

// logFuzzyMatch records the first time a request model resolves through a fuzzy
// rule instead of an exact key, so an operator can audit which models are being
// billed by inference. Memoization keeps this to one line per distinct name.
func logFuzzyMatch(model, catalogKey string) {
	common.SysLog("auto pricing fuzzy matched model " + model + " -> catalog entry " + catalogKey)
}

// SetCatalog publishes a new catalog and drops the fuzzy cache, which is only
// valid for the catalog generation that produced it.
func SetCatalog(c *Catalog) {
	current.Store(c)
	fuzzyMu.Lock()
	fuzzyMemo = make(map[string]fuzzyResult)
	fuzzyMu.Unlock()
}

// CurrentCatalog returns the active catalog, or nil when nothing is loaded.
func CurrentCatalog() *Catalog {
	return current.Load()
}

// Loaded reports whether a catalog with at least one model is available.
func Loaded() bool {
	c := current.Load()
	return c != nil && c.ModelCount > 0
}

// ResolveForRequest prices a client-requested model. Exact keys, explicit
// aliases and deterministic provider/path spelling normalization always run.
// Date/revision compatibility runs only when allowCompatibility is enabled.
func ResolveForRequest(model string, allowCompatibility bool) (Entry, bool) {
	return resolve(model, allowCompatibility)
}

// ResolveIdentified prices a model name identified by an upstream response or
// another trusted protocol field. It permits only exact keys, explicit aliases
// and deterministic path/date/revision normalization. It never performs family
// or nearest-model inference.
func ResolveIdentified(model string) (Entry, bool) {
	return resolve(model, true)
}

// Resolve is retained for callers that have not yet selected an explicit
// lookup track. New request billing code should call ResolveForRequest, while
// upstream-identified models should call ResolveIdentified.
func Resolve(model string, allowFuzzy bool) (Entry, bool) {
	return ResolveForRequest(model, allowFuzzy)
}

func resolve(model string, allowDateNormalization bool) (Entry, bool) {
	c := current.Load()
	if c == nil || len(c.entries) == 0 {
		return Entry{}, false
	}

	name := strings.ToLower(strings.TrimSpace(model))
	if name == "" {
		return Entry{}, false
	}

	// Fast path: the requested name is a catalog key verbatim.
	if entry, ok := c.entries[name]; ok {
		return entry, true
	}

	candidates := buildCandidates(name)
	for _, candidate := range candidates {
		if entry, ok := c.entries[candidate]; ok {
			return entry, true
		}
	}

	if !allowDateNormalization {
		return Entry{}, false
	}

	if cached, ok := loadFuzzyMemo(name); ok {
		return cached.entry, cached.hasHit
	}

	entry, ok := c.resolveFuzzy(candidates)
	storeFuzzyMemo(name, fuzzyResult{entry: entry, hasHit: ok})
	if ok {
		logFuzzyMatch(name, entry.CatalogKey)
	}
	return entry, ok
}

func loadFuzzyMemo(name string) (fuzzyResult, bool) {
	fuzzyMu.RLock()
	defer fuzzyMu.RUnlock()
	result, ok := fuzzyMemo[name]
	return result, ok
}

func storeFuzzyMemo(name string, result fuzzyResult) {
	fuzzyMu.Lock()
	defer fuzzyMu.Unlock()
	if len(fuzzyMemo) >= fuzzyMemoLimit {
		fuzzyMemo = make(map[string]fuzzyResult, fuzzyMemoLimit)
	}
	fuzzyMemo[name] = result
}
