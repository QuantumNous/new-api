package modellab

import (
	"regexp"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"golang.org/x/text/unicode/norm"
)

const (
	GroupMixed   = "mixed"
	GroupUnknown = "unknown"
)

type ModelMatch struct {
	InputModel  string  `json:"input_model"`
	RealModel   string  `json:"real_model"`
	CanonicalID string  `json:"canonical_id,omitempty"`
	LabSlug     string  `json:"lab_slug,omitempty"`
	Confidence  float64 `json:"confidence"`
	Source      string  `json:"source"`
}

type LabMatch struct {
	Slug       string  `json:"slug"`
	Name       string  `json:"name"`
	Confidence float64 `json:"confidence"`
	Source     string  `json:"source"`
}

type Resolution struct {
	GroupSlug       string       `json:"group_slug"`
	Labs            []LabMatch   `json:"labs"`
	Models          []ModelMatch `json:"models"`
	UnresolvedCount int          `json:"unresolved_count"`
	CatalogVersion  string       `json:"catalog_version"`
}

type hint struct {
	lab        string
	confidence float64
	patterns   []*regexp.Regexp
}

var hints = []hint{
	{lab: "deepseek", confidence: 0.98, patterns: regexps(`deepseek`)},
	{lab: "anthropic", confidence: 0.98, patterns: regexps(`claude`)},
	{lab: "xai", confidence: 0.98, patterns: regexps(`grok`)},
	{lab: "nvidia", confidence: 0.97, patterns: regexps(`nemotron`)},
	{lab: "zhipuai", confidence: 0.96, patterns: regexps(`(?:^|[-_.:/])glm(?:[-_.:/]|$)`, `chatglm`)},
	{lab: "google", confidence: 0.95, patterns: regexps(`gemini`, `gemma`, `imagen`, `veo`)},
	{lab: "openai", confidence: 0.94, patterns: regexps(`(?:^|[-_.:/])gpt(?:[-_.:/]|$)`, `(?:^|[-_.:/])o[134](?:[-_.:/]|$)`, `whisper`, `dall[-_.]?e`, `text[-_.]?embedding`, `codex`)},
	{lab: "alibaba", confidence: 0.93, patterns: regexps(`qwen`, `qwq`, `(?:^|[-_.:/])wan(?:[-_.:/]|$)`)},
	{lab: "moonshotai", confidence: 0.93, patterns: regexps(`kimi`, `moonshot`)},
	{lab: "mistral", confidence: 0.92, patterns: regexps(`mistral`, `mixtral`, `codestral`, `pixtral`, `magistral`, `devstral`, `ministral`, `voxtral`)},
	{lab: "cohere", confidence: 0.91, patterns: regexps(`command`, `c4ai`, `(?:^|[-_.:/])aya(?:[-_.:/]|$)`)},
	{lab: "minimax", confidence: 0.91, patterns: regexps(`minimax`)},
	{lab: "perplexity", confidence: 0.91, patterns: regexps(`sonar`)},
	{lab: "bytedance-seed", confidence: 0.90, patterns: regexps(`doubao`, `seed[-_.:/]`)},
	{lab: "tencent", confidence: 0.90, patterns: regexps(`hunyuan`, `(?:^|[-_.:/])hy3(?:[-_.:/]|$)`)},
	{lab: "xiaomi", confidence: 0.90, patterns: regexps(`mimo`)},
	{lab: "stepfun", confidence: 0.90, patterns: regexps(`(?:^|[-_.:/])step(?:[-_.:/]|$)`)},
	{lab: "upstage", confidence: 0.90, patterns: regexps(`solar`)},
	{lab: "poolside", confidence: 0.90, patterns: regexps(`laguna`)},
	{lab: "meta", confidence: 0.82, patterns: regexps(`llama`, `muse[-_.]`)},
}

var routerPattern = regexp.MustCompile(`(?:^|[/_.:-])(?:auto|router|ensemble)(?:$|[/_.:-])`)

func regexps(values ...string) []*regexp.Regexp {
	result := make([]*regexp.Regexp, 0, len(values))
	for _, value := range values {
		result = append(result, regexp.MustCompile("(?i)"+value))
	}
	return result
}

func Resolve(models, modelMapping string) Resolution {
	return ResolveWithCatalog(DefaultCatalog(), models, modelMapping)
}

func ResolveWithCatalog(catalog *Catalog, models, modelMapping string) Resolution {
	actualModels := actualModels(models, modelMapping)
	result := Resolution{GroupSlug: GroupUnknown, CatalogVersion: catalog.Version}
	for _, actual := range actualModels {
		result.Models = append(result.Models, matchModel(catalog, actual.input, actual.real))
	}
	byLab := make(map[string]LabMatch)
	for _, match := range result.Models {
		if match.LabSlug == "" {
			result.UnresolvedCount++
			continue
		}
		lab, ok := catalog.Lab(match.LabSlug)
		if !ok {
			result.UnresolvedCount++
			continue
		}
		candidate := LabMatch{Slug: lab.Slug, Name: lab.Name, Confidence: match.Confidence, Source: match.Source}
		if previous, exists := byLab[lab.Slug]; !exists || candidate.Confidence > previous.Confidence {
			byLab[lab.Slug] = candidate
		}
	}
	result.Labs = make([]LabMatch, 0, len(byLab))
	for _, lab := range byLab {
		result.Labs = append(result.Labs, lab)
	}
	sort.Slice(result.Labs, func(i, j int) bool { return result.Labs[i].Slug < result.Labs[j].Slug })
	switch len(result.Labs) {
	case 0:
		result.GroupSlug = GroupUnknown
	case 1:
		result.GroupSlug = result.Labs[0].Slug
	default:
		result.GroupSlug = GroupMixed
	}
	return result
}

type actualModel struct{ input, real string }

func actualModels(models, modelMapping string) []actualModel {
	mapping := map[string]string{}
	if strings.TrimSpace(modelMapping) != "" {
		_ = common.UnmarshalJsonStr(modelMapping, &mapping)
	}
	values := splitModels(models)
	result := make([]actualModel, 0, len(values))
	seenInputs := make(map[string]struct{}, len(values))
	for _, value := range values {
		realModel := value
		mapped, ok := mapping[value]
		if !ok {
			mapped, ok = mapping[normalize(value)]
		}
		if ok && strings.TrimSpace(mapped) != "" {
			realModel = strings.TrimSpace(mapped)
		}
		result = append(result, actualModel{input: value, real: realModel})
		seenInputs[value] = struct{}{}
		seenInputs[normalize(value)] = struct{}{}
	}
	for input, realModel := range mapping {
		if _, exists := seenInputs[input]; exists {
			continue
		}
		if _, exists := seenInputs[normalize(input)]; exists || strings.TrimSpace(realModel) == "" {
			continue
		}
		result = append(result, actualModel{input: input, real: strings.TrimSpace(realModel)})
	}
	sort.SliceStable(result, func(i, j int) bool { return result[i].input < result[j].input })
	return result
}

func splitModels(models string) []string {
	parts := strings.FieldsFunc(models, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	})
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part); value != "" {
			result = append(result, value)
		}
	}
	return result
}

func matchModel(catalog *Catalog, input, realModel string) ModelMatch {
	normalized := normalize(realModel)
	match := ModelMatch{InputModel: input, RealModel: realModel, Source: "unknown"}
	if normalized == "" || strings.HasPrefix(normalized, "~") || routerPattern.MatchString(normalized) {
		return match
	}
	if lab, canonical, source := canonicalMatch(catalog, normalized); lab != "" {
		match.LabSlug = lab
		match.CanonicalID = canonical
		match.Confidence = 1
		match.Source = source
		return match
	}
	candidates := map[string]float64{}
	for _, item := range hints {
		if !aliasAllowed(item.lab, normalized) {
			continue
		}
		for _, pattern := range item.patterns {
			if pattern.MatchString(normalized) {
				if item.confidence > candidates[item.lab] {
					candidates[item.lab] = item.confidence
				}
				break
			}
		}
	}
	type candidate struct {
		lab        string
		confidence float64
	}
	ranked := make([]candidate, 0, len(candidates))
	for lab, confidence := range candidates {
		ranked = append(ranked, candidate{lab: lab, confidence: confidence})
	}
	sort.Slice(ranked, func(i, j int) bool { return ranked[i].confidence > ranked[j].confidence })
	if len(ranked) == 0 || ranked[0].confidence < 0.9 || (len(ranked) > 1 && ranked[0].confidence-ranked[1].confidence < 0.1) {
		return match
	}
	match.LabSlug = ranked[0].lab
	match.Confidence = ranked[0].confidence
	match.Source = "alias"
	return match
}

func aliasAllowed(lab, normalized string) bool {
	if lab != "meta" && lab != "alibaba" {
		return true
	}
	parts := strings.SplitN(normalized, "/", 2)
	if len(parts) == 1 {
		return true
	}
	switch parts[0] {
	case "alibaba", "meta", "nvidia", "deepseek", "openrouter", "azure", "bedrock", "vertex", "vertexai":
		return true
	default:
		// Llama/Qwen tokens in arbitrary provider-specific IDs are only
		// candidates; without canonical evidence they remain Unknown.
		return false
	}
}

func canonicalMatch(catalog *Catalog, normalized string) (string, string, string) {
	if lab, ok := catalog.Models[normalized]; ok {
		return lab, normalized, "canonical"
	}
	if canonical, ok := lookupAlias(catalog.Aliases, normalized); ok {
		if lab := strings.SplitN(canonical, "/", 2)[0]; lab != "" {
			return lab, canonical, "provider"
		}
	}
	segments := strings.Split(normalized, "/")
	for index := 0; index < len(segments) && index < 3; index++ {
		for _, lab := range catalog.Labs {
			if segments[index] != lab.Slug || index == len(segments)-1 {
				continue
			}
			candidate := strings.Join(segments[index:], "/")
			if _, ok := catalog.Models[candidate]; ok {
				return lab.Slug, candidate, "canonical"
			}
		}
	}
	return "", "", ""
}

func lookupAlias(aliases map[string]string, normalized string) (string, bool) {
	if canonical, ok := aliases[normalized]; ok {
		return canonical, true
	}
	keys := make([]string, 0, len(aliases))
	for key := range aliases {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		canonical := aliases[key]
		if normalize(key) == normalized {
			return canonical, true
		}
	}
	return "", false
}

func normalize(value string) string {
	value = norm.NFKC.String(strings.ToLower(strings.TrimSpace(value)))
	for {
		previous := value
		value = strings.TrimSuffix(value, "@default")
		for _, suffix := range []string{":free", ":thinking", ":low", ":medium", ":high"} {
			value = strings.TrimSuffix(value, suffix)
		}
		if value == previous {
			break
		}
	}
	return value
}
