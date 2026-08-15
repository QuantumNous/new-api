package autopricing

import (
	"regexp"
	"strings"
)

var (
	// versionDashPattern rewrites dashed minor versions into the dotted spelling
	// LiteLLM sometimes uses: claude-opus-4-5-20251101 -> claude-opus-4.5-20251101.
	versionDashPattern = regexp.MustCompile(`-(\d)-(\d)(-|$)`)
	// openAIDateSuffixPattern matches continuous and segmented release dates.
	// Both gpt-5.2-20251222 and gpt-4o-2024-08-06 are common upstream forms.
	openAIDateSuffixPattern = regexp.MustCompile(`-(?:\d{8}|\d{4}-\d{2}-\d{2})$`)
	// openAIBaseVersionPattern extracts the numeric base version so suffixed
	// variants (gpt-5.2-codex) can fall back to their base model. It
	// deliberately requires a numeric version so gpt-4o is not reduced to gpt-4.
	openAIBaseVersionPattern = regexp.MustCompile(`^(gpt-\d+(?:\.\d+)?)(?:-|$)`)
)

func normalizeKey(model string) string {
	return strings.ToLower(strings.TrimSpace(model))
}

// buildCandidates lists the spellings of a model name that may appear verbatim
// as a catalog key: the name itself, provider-prefixed forms (models/gemini-x,
// Vertex resource paths) reduced to the bare model, and the dotted-version
// variant of each.
func buildCandidates(name string) []string {
	raw := []string{
		name,
		strings.TrimPrefix(name, "models/"),
		lastPathSegment(name),
	}
	if name == "gpt-5.6" {
		raw = append(raw, "gpt-5.6-sol")
	}
	if alias := normalizeGeminiThinkingTierAlias(lastPathSegment(name)); alias != lastPathSegment(name) {
		raw = append(raw, alias)
	}

	candidates := make([]string, 0, len(raw)*2)
	seen := make(map[string]struct{}, len(raw)*2)
	add := func(candidate string) {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			return
		}
		if _, exists := seen[candidate]; exists {
			return
		}
		seen[candidate] = struct{}{}
		candidates = append(candidates, candidate)
	}

	for _, candidate := range raw {
		add(candidate)
		add(versionDashPattern.ReplaceAllString(candidate, "-$1.$2$3"))
	}
	return candidates
}

func normalizeGeminiThinkingTierAlias(model string) string {
	if !strings.HasPrefix(model, "gemini-") {
		return model
	}
	for _, suffix := range []string{"-thinking-high", "-thinking-low", "-thinking-medium", "-thinking", "-high", "-low", "-medium", "-tiered"} {
		if strings.HasSuffix(model, suffix) && len(model) > len(suffix) {
			return strings.TrimSuffix(model, suffix)
		}
	}
	return model
}

func lastPathSegment(model string) string {
	if index := strings.LastIndex(model, "/"); index != -1 {
		return model[index+1:]
	}
	return model
}

// stripDateSegments removes release-date and revision segments so dated and
// undated spellings of the same model share a base name:
// claude-opus-4-5-20251101 -> claude-opus-4-5, anthropic.claude-v2:1 -> anthropic.claude-v2.
func stripDateSegments(model string) string {
	parts := strings.Split(model, "-")
	kept := make([]string, 0, len(parts))
	for i := 0; i < len(parts); i++ {
		part := parts[i]
		if len(part) == 8 && isAllDigits(part) {
			continue
		}
		if i+2 < len(parts) && len(part) == 4 && isAllDigits(part) &&
			len(parts[i+1]) == 2 && isAllDigits(parts[i+1]) &&
			len(parts[i+2]) == 2 && isAllDigits(parts[i+2]) {
			month, day := atoiSmall(parts[i+1]), atoiSmall(parts[i+2])
			if month >= 1 && month <= 12 && day >= 1 && day <= 31 {
				i += 2
				continue
			}
		}
		// Bedrock-style revisions are a suffix of the version segment (v2:1).
		// Only the revision is dropped; discarding the whole segment would
		// collapse claude-v2 and claude-v3 into one base name.
		if index := strings.Index(part, ":"); index != -1 {
			part = part[:index]
			if part == "" {
				continue
			}
		}
		kept = append(kept, part)
	}
	return strings.Join(kept, "-")
}

func atoiSmall(value string) int {
	result := 0
	for _, r := range value {
		result = result*10 + int(r-'0')
	}
	return result
}

func isAllDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}

// modelFamily groups model names that share a published rate.
//
// match holds the patterns that classify a request model into the family;
// pricing holds the catalog patterns to price it with, in order. A family whose
// own rate is not published yet falls back to the closest previous generation,
// which is deliberate: without it, substring classification would drop
// claude-opus-5 into the much pricier legacy "claude-opus-4" family.
type modelFamily struct {
	name    string
	match   []string
	pricing []string
}

// claudeFamilies is ordered most specific first. Order is load-bearing:
// "claude-opus-4" is a substring of "claude-opus-4-7", so a less specific entry
// placed earlier would capture newer models at the wrong rate.
var claudeFamilies = []modelFamily{
	{name: "opus-5", match: []string{"claude-opus-5"}, pricing: []string{"claude-opus-5", "claude-opus-4-8"}},
	{name: "opus-4.8", match: []string{"claude-opus-4-8", "claude-opus-4.8"}, pricing: []string{"claude-opus-4-8", "claude-opus-4.8", "claude-opus-4-7"}},
	{name: "opus-4.7", match: []string{"claude-opus-4-7", "claude-opus-4.7"}, pricing: []string{"claude-opus-4-7", "claude-opus-4.7", "claude-opus-4-6"}},
	{name: "opus-4.6", match: []string{"claude-opus-4-6", "claude-opus-4.6"}, pricing: []string{"claude-opus-4-6", "claude-opus-4.6", "claude-opus-4-5"}},
	{name: "opus-4.5", match: []string{"claude-opus-4-5", "claude-opus-4.5"}},
	{name: "opus-4.1", match: []string{"claude-opus-4-1", "claude-opus-4.1"}},
	{name: "opus-4", match: []string{"claude-opus-4"}},
	{name: "haiku-4.5", match: []string{"claude-haiku-4-5", "claude-haiku-4.5"}},
	{name: "sonnet-4.5", match: []string{"claude-sonnet-4-5", "claude-sonnet-4.5"}},
	{name: "sonnet-4", match: []string{"claude-sonnet-4"}},
	{name: "sonnet-3.7", match: []string{"claude-3-7-sonnet"}},
	{name: "sonnet-3.5", match: []string{"claude-3-5-sonnet"}},
	{name: "haiku-3.5", match: []string{"claude-3-5-haiku"}},
	{name: "opus-3", match: []string{"claude-3-opus"}},
	{name: "sonnet-3", match: []string{"claude-3-sonnet"}},
	{name: "haiku-3", match: []string{"claude-3-haiku"}},
}

// resolveFuzzy runs the inference rules for a model name that is not a catalog
// key under any of its exact spellings.
//
// Unlike the upstream reference implementation this chain has no final
// catch-all: a name that matches nothing returns a miss so the caller falls back
// to "price not configured" rather than billing at an unrelated model's rate.
func (c *Catalog) resolveFuzzy(candidates []string) (Entry, bool) {
	if entry, ok := c.matchByBaseName(candidates); ok {
		return entry, true
	}
	for _, candidate := range candidates {
		if entry, ok := c.matchClaudeFamily(candidate); ok {
			return entry, true
		}
	}
	for _, candidate := range candidates {
		if entry, ok := c.matchOpenAIVariant(candidate); ok {
			return entry, true
		}
	}
	return Entry{}, false
}

// matchByBaseName pairs a dated request model with an undated catalog entry, or
// the reverse, using the precomputed base-name index.
func (c *Catalog) matchByBaseName(candidates []string) (Entry, bool) {
	for _, candidate := range candidates {
		base := stripDateSegments(candidate)
		if base == "" || base == candidate {
			continue
		}
		if key, ok := c.baseIndex[base]; ok {
			return c.entries[key], true
		}
	}
	// A dated catalog entry can also answer an undated request.
	for _, candidate := range candidates {
		if key, ok := c.baseIndex[candidate]; ok {
			return c.entries[key], true
		}
	}
	return Entry{}, false
}

func (c *Catalog) matchClaudeFamily(model string) (Entry, bool) {
	if !strings.Contains(model, "claude") {
		return Entry{}, false
	}

	var matched *modelFamily
	for i := range claudeFamilies {
		for _, pattern := range claudeFamilies[i].match {
			if strings.Contains(model, pattern) {
				matched = &claudeFamilies[i]
				break
			}
		}
		if matched != nil {
			break
		}
	}
	if matched == nil {
		return Entry{}, false
	}

	lookups := matched.pricing
	if lookups == nil {
		lookups = matched.match
	}
	for _, pattern := range lookups {
		if entry, ok := c.findByKeyPrefixOrSubstring(pattern); ok {
			return entry, true
		}
	}
	return Entry{}, false
}

// matchOpenAIVariant reduces a suffixed or dated OpenAI model to its base
// version: gpt-5.2-codex and gpt-5.2-20251222 both fall back to gpt-5.2.
func (c *Catalog) matchOpenAIVariant(model string) (Entry, bool) {
	if !strings.HasPrefix(model, "gpt-") {
		return Entry{}, false
	}
	if model == "gpt-5.6" {
		if entry, ok := c.entries["gpt-5.6-sol"]; ok {
			return entry, true
		}
	}

	// These aliases are business-defined billing identities from Sub2API. They
	// are checked before generic base extraction so a codex variant cannot be
	// priced by an unrelated plain GPT entry when its codex rate is available.
	if strings.HasPrefix(model, "gpt-5.3-codex-spark") {
		if entry, ok := c.lookupFirst("gpt-5.1-codex", "gpt-5.2-codex", "gpt-5.3-codex"); ok {
			return entry, true
		}
	}
	if strings.HasPrefix(model, "gpt-5.3-codex") {
		if entry, ok := c.lookupFirst("gpt-5.2-codex", "gpt-5.1-codex", "gpt-5.3-codex"); ok {
			return entry, true
		}
	}

	variants := make([]string, 0, 3)
	withoutDate := openAIDateSuffixPattern.ReplaceAllString(model, "")
	if withoutDate != model {
		variants = append(variants, withoutDate)
	}
	if matches := openAIBaseVersionPattern.FindStringSubmatch(model); len(matches) > 1 {
		variants = append(variants, matches[1])
	}
	if withoutDate != model {
		if matches := openAIBaseVersionPattern.FindStringSubmatch(withoutDate); len(matches) > 1 {
			variants = append(variants, matches[1])
		}
	}

	if strings.Contains(model, "-codex") {
		if matches := openAIBaseVersionPattern.FindStringSubmatch(model); len(matches) > 1 {
			variants = append([]string{matches[1] + "-codex"}, variants...)
		}
	}
	for _, variant := range variants {
		if variant == model {
			continue
		}
		if entry, ok := c.entries[variant]; ok {
			return entry, true
		}
	}
	return Entry{}, false
}

func (c *Catalog) lookupFirst(keys ...string) (Entry, bool) {
	for _, key := range keys {
		if entry, ok := c.entries[key]; ok {
			return entry, true
		}
	}
	return Entry{}, false
}

// findByKeyPrefixOrSubstring scans catalog keys in sorted order so a family
// pattern resolves to the same entry on every process.
func (c *Catalog) findByKeyPrefixOrSubstring(pattern string) (Entry, bool) {
	for _, key := range c.sortedKeys {
		if strings.Contains(key, pattern) {
			return c.entries[key], true
		}
	}
	return Entry{}, false
}
