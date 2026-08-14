package autopricing

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
)

type SourceID string

const (
	SourceOverride  SourceID = "override"
	SourceMirror    SourceID = "wei-shaw"
	SourceModelsDev SourceID = "models.dev"
	SourceLiteLLM   SourceID = "litellm"
	SourceNewAPI    SourceID = "new-api"
)

type FieldID string

const (
	FieldInput                FieldID = "input"
	FieldOutput               FieldID = "output"
	FieldCacheRead            FieldID = "cache_read"
	FieldCacheWrite5m         FieldID = "cache_write_5m"
	FieldCacheWrite1h         FieldID = "cache_write_1h"
	FieldImageInput           FieldID = "image_input"
	FieldImageOutput          FieldID = "image_output"
	FieldAudioInput           FieldID = "audio_input"
	FieldAudioOutput          FieldID = "audio_output"
	FieldPriorityInput        FieldID = "priority.input"
	FieldPriorityOutput       FieldID = "priority.output"
	FieldPriorityCacheRead    FieldID = "priority.cache_read"
	FieldPriorityCacheWrite5m FieldID = "priority.cache_write_5m"
	FieldPriorityCacheWrite1h FieldID = "priority.cache_write_1h"
	FieldPriorityImageInput   FieldID = "priority.image_input"
	FieldPriorityImageOutput  FieldID = "priority.image_output"
	FieldPriorityAudioInput   FieldID = "priority.audio_input"
	FieldPriorityAudioOutput  FieldID = "priority.audio_output"
	FieldFlexInput            FieldID = "flex.input"
	FieldFlexOutput           FieldID = "flex.output"
	FieldFlexCacheRead        FieldID = "flex.cache_read"
	FieldFlexCacheWrite5m     FieldID = "flex.cache_write_5m"
	FieldFlexCacheWrite1h     FieldID = "flex.cache_write_1h"
	FieldFlexImageInput       FieldID = "flex.image_input"
	FieldFlexImageOutput      FieldID = "flex.image_output"
	FieldFlexAudioInput       FieldID = "flex.audio_input"
	FieldFlexAudioOutput      FieldID = "flex.audio_output"
	FieldPerRequest           FieldID = "per_request"
	FieldBillingExpr          FieldID = "billing_expr"
)

type CostSet struct {
	Input        *float64 `json:"input,omitempty"`
	Output       *float64 `json:"output,omitempty"`
	CacheRead    *float64 `json:"cache_read,omitempty"`
	CacheWrite5m *float64 `json:"cache_write_5m,omitempty"`
	CacheWrite1h *float64 `json:"cache_write_1h,omitempty"`
	ImageInput   *float64 `json:"image_input,omitempty"`
	ImageOutput  *float64 `json:"image_output,omitempty"`
	AudioInput   *float64 `json:"audio_input,omitempty"`
	AudioOutput  *float64 `json:"audio_output,omitempty"`
}

type PriceTier struct {
	Name           string  `json:"name"`
	MaxInputTokens int     `json:"max_input_tokens,omitempty"`
	Costs          CostSet `json:"costs"`
}

type PriceRecord struct {
	Model         string               `json:"model"`
	Provider      string               `json:"provider,omitempty"`
	PrimarySource SourceID             `json:"primary_source"`
	SourceVersion string               `json:"source_version,omitempty"`
	SourceURL     string               `json:"source_url,omitempty"`
	Reason        string               `json:"reason,omitempty"`
	ValidUntil    time.Time            `json:"valid_until,omitempty"`
	Standard      CostSet              `json:"standard"`
	Priority      CostSet              `json:"priority,omitempty"`
	Flex          CostSet              `json:"flex,omitempty"`
	PerRequest    *float64             `json:"per_request,omitempty"`
	Tiers         []PriceTier          `json:"tiers,omitempty"`
	Aliases       []string             `json:"aliases,omitempty"`
	BillingMode   string               `json:"billing_mode,omitempty"`
	BillingExpr   string               `json:"billing_expr,omitempty"`
	FieldSources  map[FieldID]SourceID `json:"field_sources,omitempty"`
}

type SourceCatalog struct {
	Source       SourceID               `json:"source"`
	Version      string                 `json:"version"`
	Records      map[string]PriceRecord `json:"records"`
	SkippedCount int                    `json:"skipped_count,omitempty"`
}

func newSourceCatalog(source SourceID, version string) *SourceCatalog {
	return &SourceCatalog{Source: source, Version: version, Records: map[string]PriceRecord{}}
}

func pricePtr(v float64) *float64 { return &v }
func hasCosts(c CostSet) bool {
	return c.Input != nil || c.Output != nil || c.CacheRead != nil || c.CacheWrite5m != nil || c.CacheWrite1h != nil || c.ImageInput != nil || c.ImageOutput != nil || c.AudioInput != nil || c.AudioOutput != nil
}

func sourcePriority(source SourceID) int {
	switch source {
	case SourceOverride:
		return 0
	case SourceMirror:
		return 1
	case SourceModelsDev:
		return 2
	case SourceLiteLLM:
		return 3
	case SourceNewAPI:
		return 4
	default:
		return 100
	}
}

func MergeSources(sources ...*SourceCatalog) (*Catalog, error) {
	filtered := make([]*SourceCatalog, 0, len(sources))
	for _, source := range sources {
		if source != nil {
			filtered = append(filtered, source)
		}
	}
	sort.SliceStable(filtered, func(i, j int) bool { return sourcePriority(filtered[i].Source) < sourcePriority(filtered[j].Source) })

	records := map[string]PriceRecord{}
	skipped := 0
	versions := make([]string, 0, len(filtered))
	for _, source := range filtered {
		skipped += source.SkippedCount
		versions = append(versions, string(source.Source)+":"+source.Version)
		keys := make([]string, 0, len(source.Records))
		for key := range source.Records {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			incoming := source.Records[key]
			key = normalizeKey(key)
			if incoming.Model == "" {
				incoming.Model = key
			}
			if incoming.PrimarySource == "" {
				incoming.PrimarySource = source.Source
			}
			if incoming.SourceVersion == "" {
				incoming.SourceVersion = source.Version
			}
			if incoming.FieldSources == nil {
				incoming.FieldSources = map[FieldID]SourceID{}
			}
			current, exists := records[key]
			if !exists {
				setRecordFieldSources(&incoming, incoming.PrimarySource)
				records[key] = incoming
				continue
			}
			// Merge every field strictly by source precedence. A lower-priority
			// expression may fill an absent expression, but it must never replace
			// higher-priority base costs as a second pricing contract.
			mergeMissingRecord(&current, incoming)
			records[key] = current
		}
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("pricing catalog has no usable entries")
	}

	version := strings.Join(versions, "|")
	sourceVersions := map[SourceID]string{}
	for _, source := range filtered {
		sourceVersions[source.Source] = source.Version
	}
	catalog, err := catalogFromRecords(records, version, sourceVersions)
	if err != nil {
		return nil, err
	}
	catalog.SkippedCount += skipped
	return catalog, nil
}

func setRecordFieldSources(r *PriceRecord, source SourceID) {
	if r.FieldSources == nil {
		r.FieldSources = map[FieldID]SourceID{}
	}
	pairs := []struct {
		id    FieldID
		value *float64
	}{{FieldInput, r.Standard.Input}, {FieldOutput, r.Standard.Output}, {FieldCacheRead, r.Standard.CacheRead}, {FieldCacheWrite5m, r.Standard.CacheWrite5m}, {FieldCacheWrite1h, r.Standard.CacheWrite1h}, {FieldImageInput, r.Standard.ImageInput}, {FieldImageOutput, r.Standard.ImageOutput}, {FieldAudioInput, r.Standard.AudioInput}, {FieldAudioOutput, r.Standard.AudioOutput}, {FieldPerRequest, r.PerRequest}}
	for _, pair := range pairs {
		if pair.value != nil {
			if _, ok := r.FieldSources[pair.id]; !ok {
				r.FieldSources[pair.id] = source
			}
		}
	}
	setCostSetFieldSources(r.FieldSources, r.Priority, source, "priority.")
	setCostSetFieldSources(r.FieldSources, r.Flex, source, "flex.")
	for index, tier := range r.Tiers {
		setCostSetFieldSources(r.FieldSources, tier.Costs, source, fmt.Sprintf("tier.%d.", index))
	}
	if r.BillingExpr != "" {
		r.FieldSources[FieldBillingExpr] = source
	}
}

func setCostSetFieldSources(target map[FieldID]SourceID, costs CostSet, source SourceID, prefix string) {
	pairs := []struct {
		name  string
		value *float64
	}{
		{"input", costs.Input},
		{"output", costs.Output},
		{"cache_read", costs.CacheRead},
		{"cache_write_5m", costs.CacheWrite5m},
		{"cache_write_1h", costs.CacheWrite1h},
		{"image_input", costs.ImageInput},
		{"image_output", costs.ImageOutput},
		{"audio_input", costs.AudioInput},
		{"audio_output", costs.AudioOutput},
	}
	for _, pair := range pairs {
		if pair.value == nil {
			continue
		}
		id := FieldID(prefix + pair.name)
		if _, exists := target[id]; !exists {
			target[id] = source
		}
	}
}

func mergeMissingRecord(dst *PriceRecord, src PriceRecord) {
	if dst.FieldSources == nil {
		dst.FieldSources = map[FieldID]SourceID{}
	}
	setRecordFieldSources(&src, src.PrimarySource)
	copyCostMissing := func(d *CostSet, s CostSet, prefix string) {
		fields := []struct {
			id FieldID
			d  **float64
			s  *float64
		}{{FieldInput, &d.Input, s.Input}, {FieldOutput, &d.Output, s.Output}, {FieldCacheRead, &d.CacheRead, s.CacheRead}, {FieldCacheWrite5m, &d.CacheWrite5m, s.CacheWrite5m}, {FieldCacheWrite1h, &d.CacheWrite1h, s.CacheWrite1h}, {FieldImageInput, &d.ImageInput, s.ImageInput}, {FieldImageOutput, &d.ImageOutput, s.ImageOutput}, {FieldAudioInput, &d.AudioInput, s.AudioInput}, {FieldAudioOutput, &d.AudioOutput, s.AudioOutput}}
		for _, f := range fields {
			if *f.d == nil && f.s != nil {
				*f.d = pricePtr(*f.s)
				id := FieldID(prefix + string(f.id))
				if source, ok := src.FieldSources[id]; ok {
					dst.FieldSources[id] = source
				} else {
					dst.FieldSources[id] = src.PrimarySource
				}
			}
		}
	}
	copyCostMissing(&dst.Standard, src.Standard, "")
	copyCostMissing(&dst.Priority, src.Priority, "priority.")
	copyCostMissing(&dst.Flex, src.Flex, "flex.")
	if dst.PerRequest == nil && src.PerRequest != nil {
		dst.PerRequest = pricePtr(*src.PerRequest)
		dst.FieldSources[FieldPerRequest] = src.FieldSources[FieldPerRequest]
	}
	if len(dst.Tiers) == 0 && len(src.Tiers) > 0 {
		dst.Tiers = src.Tiers
		for index, tier := range src.Tiers {
			prefix := fmt.Sprintf("tier.%d.", index)
			setCostSetFieldSources(dst.FieldSources, tier.Costs, src.PrimarySource, prefix)
			for field, source := range src.FieldSources {
				if strings.HasPrefix(string(field), prefix) {
					dst.FieldSources[field] = source
				}
			}
		}
	}
	if len(dst.Aliases) == 0 && len(src.Aliases) > 0 {
		dst.Aliases = src.Aliases
	}
	if dst.BillingExpr == "" && src.BillingExpr != "" {
		dst.BillingExpr, dst.BillingMode = src.BillingExpr, src.BillingMode
		dst.FieldSources[FieldBillingExpr] = src.FieldSources[FieldBillingExpr]
	}
	if dst.Provider == "" {
		dst.Provider = src.Provider
	}
}

func recordToEntry(record PriceRecord) (Entry, bool) {
	input, output := record.Standard.Input, record.Standard.Output
	if input == nil && record.PerRequest == nil {
		return Entry{}, false
	}
	if !validPriceRecord(record) {
		return Entry{}, false
	}
	entry := Entry{CatalogKey: normalizeKey(record.Model), Source: record.PrimarySource, FieldSources: record.FieldSources}
	if input != nil {
		entry.ModelRatio = roundRatio(*input / ratioUnitUSDPerMillionTokens)
		if output != nil && *input > 0 {
			entry.CompletionRatio = roundRatio(*output / *input)
			if entry.CompletionRatio > maxMultiplier {
				return Entry{}, false
			}
		} else {
			entry.CompletionRatio = 1
		}
		if record.Standard.CacheRead != nil && *input > 0 {
			entry.CacheRatio = roundRatio(*record.Standard.CacheRead / *input)
			if entry.CacheRatio > maxMultiplier {
				return Entry{}, false
			}
			entry.HasCacheRatio = true
		}
		if record.Standard.CacheWrite5m != nil && *input > 0 {
			entry.CreateCacheRatio = roundRatio(*record.Standard.CacheWrite5m / *input)
			if entry.CreateCacheRatio > maxMultiplier {
				return Entry{}, false
			}
			entry.HasCreateCacheRatio = true
		}
	}
	expr := strings.TrimSpace(record.BillingExpr)
	if expr == "" && needsBillingExpr(record) {
		expr = buildBillingExpr(record)
	}
	if expr != "" {
		if !validBillingExpr(expr) {
			return Entry{}, false
		}
		entry.BillingExpr = expr
		entry.HasBillingExpr = true
	}
	return entry, true
}

func validMillionCost(v float64) bool {
	return validCost(v) && v <= maxModelRatio*ratioUnitUSDPerMillionTokens
}

func validPriceRecord(record PriceRecord) bool {
	validCostSet := func(costs CostSet) bool {
		values := []*float64{
			costs.Input, costs.Output, costs.CacheRead, costs.CacheWrite5m,
			costs.CacheWrite1h, costs.ImageInput, costs.ImageOutput,
			costs.AudioInput, costs.AudioOutput,
		}
		for _, value := range values {
			if value != nil && !validMillionCost(*value) {
				return false
			}
		}
		return true
	}
	if !validCostSet(record.Standard) || !validCostSet(record.Priority) || !validCostSet(record.Flex) {
		return false
	}
	if record.PerRequest != nil && !validMillionCost(*record.PerRequest) {
		return false
	}
	for _, tier := range record.Tiers {
		if tier.MaxInputTokens < 0 || !validCostSet(tier.Costs) {
			return false
		}
	}
	return true
}

func needsBillingExpr(r PriceRecord) bool {
	zeroInputWithPaidTokens := r.Standard.Input != nil && *r.Standard.Input == 0 &&
		(r.Standard.Output != nil && *r.Standard.Output > 0 ||
			r.Standard.CacheRead != nil && *r.Standard.CacheRead > 0 ||
			r.Standard.CacheWrite5m != nil && *r.Standard.CacheWrite5m > 0)
	return zeroInputWithPaidTokens || len(r.Tiers) > 0 || hasCosts(r.Priority) || hasCosts(r.Flex) || r.Standard.CacheWrite1h != nil || r.Standard.ImageInput != nil || r.Standard.ImageOutput != nil || r.Standard.AudioInput != nil || r.Standard.AudioOutput != nil || r.PerRequest != nil
}

func validBillingExpr(expr string) bool {
	vectors := []billingexpr.TokenParams{
		{},
		{P: 1000, C: 1000, Len: 1000, CR: 100, CC: 100, CC1h: 100, Img: 100, ImgO: 100, AI: 100, AO: 100},
		{P: 300000, C: 100000, Len: 300000, CR: 10000, CC: 10000, CC1h: 10000, Img: 1000, ImgO: 1000, AI: 1000, AO: 1000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{Body: []byte(`{"service_tier":"priority"}`)},
		{Body: []byte(`{"service_tier":"flex"}`)},
	}
	for _, vector := range vectors {
		for _, request := range requests {
			value, _, err := billingexpr.RunExprWithRequest(expr, vector, request)
			if err != nil || value < 0 || math.IsNaN(value) || math.IsInf(value, 0) {
				return false
			}
		}
	}
	return true
}

func buildBillingExpr(r PriceRecord) string {
	standard := costExpr(r.Standard, r.PerRequest)
	tierExpr := standard
	if len(r.Tiers) > 0 {
		tiers := append([]PriceTier(nil), r.Tiers...)
		sort.SliceStable(tiers, func(i, j int) bool {
			return tiers[i].MaxInputTokens > 0 && (tiers[j].MaxInputTokens == 0 || tiers[i].MaxInputTokens < tiers[j].MaxInputTokens)
		})
		tail := standard
		for i := len(tiers) - 1; i >= 0; i-- {
			e := fmt.Sprintf("tier(%q, %s)", safeTierName(tiers[i].Name), costExpr(tiers[i].Costs, r.PerRequest))
			if tiers[i].MaxInputTokens > 0 {
				tail = fmt.Sprintf("len <= %d ? %s : %s", tiers[i].MaxInputTokens, e, tail)
			} else {
				tail = e
			}
		}
		tierExpr = tail
	} else {
		tierExpr = fmt.Sprintf("tier(%q, %s)", "standard", standard)
	}
	if hasCosts(r.Priority) {
		tierExpr = fmt.Sprintf("(param(\"service_tier\") == \"priority\" || param(\"service_tier\") == \"fast\") ? tier(\"priority\", %s) : (%s)", costExpr(r.Priority, r.PerRequest), tierExpr)
	}
	if hasCosts(r.Flex) {
		tierExpr = fmt.Sprintf("param(\"service_tier\") == \"flex\" ? tier(\"flex\", %s) : (%s)", costExpr(r.Flex, r.PerRequest), tierExpr)
	}
	return tierExpr
}

func safeTierName(name string) string {
	if strings.TrimSpace(name) == "" {
		return "tier"
	}
	return strings.ReplaceAll(name, "\"", "")
}
func costExpr(c CostSet, perRequest *float64) string {
	terms := make([]string, 0, 9)
	add := func(name string, v *float64) {
		if v != nil {
			terms = append(terms, fmt.Sprintf("%s * %s", name, formatFloat(*v)))
		}
	}
	add("p", c.Input)
	add("c", c.Output)
	add("cr", c.CacheRead)
	add("cc", c.CacheWrite5m)
	add("cc1h", c.CacheWrite1h)
	add("img", c.ImageInput)
	add("img_o", c.ImageOutput)
	add("ai", c.AudioInput)
	add("ao", c.AudioOutput)
	if perRequest != nil {
		terms = append(terms, formatFloat(*perRequest*1_000_000))
	}
	if len(terms) == 0 {
		return "0"
	}
	return strings.Join(terms, " + ")
}
func formatFloat(v float64) string {
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.9f", v), "0"), ".")
}

func catalogFingerprint(version, model string, record *PriceRecord) string {
	payload, _ := common.Marshal(struct {
		Version string       `json:"version"`
		Model   string       `json:"model"`
		Record  *PriceRecord `json:"record,omitempty"`
	}{version, model, record})
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}
