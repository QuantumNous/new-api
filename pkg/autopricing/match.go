package autopricing

import (
	"regexp"
	"strings"
)

var (
	// versionDashPattern rewrites dashed minor versions into the dotted spelling
	// LiteLLM sometimes uses: claude-opus-4-5-20251101 -> claude-opus-4.5-20251101.
	versionDashPattern = regexp.MustCompile(`-(\d)-(\d)(-|$)`)
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
	for _, part := range parts {
		if len(part) == 8 && isAllDigits(part) {
			continue
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

func isAllDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}

// resolveFuzzy runs the inference rules for a model name that is not a catalog
// key under any of its exact spellings.
//
// Only release-date normalization is allowed. Family or nearest-generation
// inference is deliberately excluded because billing unknown models by a
// guessed GPT or Claude price is not fail-closed.
func (c *Catalog) resolveFuzzy(candidates []string) (Entry, bool) {
	return c.matchByBaseName(candidates)
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
