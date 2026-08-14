package autopricing

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
)

type PendingReview struct {
	Model       string       `json:"model"`
	Reason      string       `json:"reason"`
	Fingerprint string       `json:"fingerprint"`
	Current     *PriceRecord `json:"current,omitempty"`
	Candidate   PriceRecord  `json:"candidate"`
}

func GuardCatalog(active, candidate *Catalog, threshold float64, rejected map[string]bool) (*Catalog, []PendingReview, error) {
	if candidate == nil {
		return nil, nil, fmt.Errorf("candidate catalog is nil")
	}
	if active == nil || len(active.records) == 0 {
		return candidate, nil, nil
	}
	result := cloneRecords(candidate.records)
	pending := []PendingReview{}
	keys := make([]string, 0, len(candidate.records))
	for key := range candidate.records {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, model := range keys {
		newRecord := candidate.records[model]
		oldRecord, exists := active.records[model]
		if !exists || newRecord.PrimarySource == SourceOverride {
			continue
		}
		reason := reviewReason(oldRecord, newRecord, threshold)
		if reason == "" {
			continue
		}
		fingerprint := catalogFingerprint(candidate.Version, newRecord)
		result[model] = oldRecord
		if rejected[fingerprint] {
			continue
		}
		oldCopy := oldRecord
		pending = append(pending, PendingReview{Model: model, Reason: reason, Fingerprint: fingerprint, Current: &oldCopy, Candidate: newRecord})
	}
	guarded, err := catalogFromRecords(result, candidate.Version, candidate.SourceVersions)
	return guarded, pending, err
}

func reviewReason(oldRecord, newRecord PriceRecord, threshold float64) string {
	if !sameStructure(oldRecord, newRecord) {
		return "billing structure changed"
	}
	oldValues, newValues := numericFields(oldRecord), numericFields(newRecord)
	if len(oldValues) != len(newValues) {
		return "pricing fields added or removed"
	}
	for name, oldValue := range oldValues {
		newValue, ok := newValues[name]
		if !ok {
			return "pricing fields added or removed"
		}
		if (oldValue == 0) != (newValue == 0) {
			return "zero price changed"
		}
		if oldValue != 0 && math.Abs(newValue-oldValue)/math.Abs(oldValue) > threshold {
			return "price change exceeds threshold"
		}
	}
	return ""
}

func sameStructure(a, b PriceRecord) bool {
	if a.BillingMode != b.BillingMode || a.BillingExpr != b.BillingExpr || len(a.Tiers) != len(b.Tiers) || len(a.Aliases) != len(b.Aliases) {
		return false
	}
	for index := range a.Tiers {
		if a.Tiers[index].Name != b.Tiers[index].Name || a.Tiers[index].MaxInputTokens != b.Tiers[index].MaxInputTokens {
			return false
		}
	}
	return true
}

func numericFields(record PriceRecord) map[string]float64 {
	result := map[string]float64{}
	addCosts := func(prefix string, costs CostSet) {
		pairs := map[string]*float64{"input": costs.Input, "output": costs.Output, "cache_read": costs.CacheRead, "cache_write_5m": costs.CacheWrite5m, "cache_write_1h": costs.CacheWrite1h, "image_input": costs.ImageInput, "image_output": costs.ImageOutput}
		for name, value := range pairs {
			if value != nil {
				result[prefix+name] = *value
			}
		}
	}
	addCosts("standard.", record.Standard)
	addCosts("priority.", record.Priority)
	addCosts("flex.", record.Flex)
	for index, tier := range record.Tiers {
		addCosts(fmt.Sprintf("tier.%d.", index), tier.Costs)
	}
	if record.PerRequest != nil {
		result["per_request"] = *record.PerRequest
	}
	return result
}

func ApplyReview(guarded *Catalog, pending []PendingReview, models []string, approve bool) (*Catalog, []PendingReview, []string, error) {
	if guarded == nil {
		return nil, nil, nil, fmt.Errorf("guarded catalog is nil")
	}
	selected := map[string]bool{}
	for _, model := range models {
		if selected[model] {
			return nil, nil, nil, fmt.Errorf("duplicate model %q", model)
		}
		selected[model] = true
	}
	if !approve && len(models) == 0 {
		for _, item := range pending {
			selected[item.Model] = true
		}
	}
	known := map[string]bool{}
	for _, item := range pending {
		known[item.Model] = true
	}
	for model := range selected {
		if !known[model] {
			return nil, nil, nil, fmt.Errorf("model %q is not pending or is stale", model)
		}
	}
	records := cloneRecords(guarded.records)
	remaining := []PendingReview{}
	rejected := []string{}
	for _, item := range pending {
		if !selected[item.Model] {
			remaining = append(remaining, item)
			continue
		}
		if approve {
			records[item.Model] = item.Candidate
		} else {
			rejected = append(rejected, item.Fingerprint)
		}
	}
	next, err := catalogFromRecords(records, guarded.Version, guarded.SourceVersions)
	sort.Strings(rejected)
	return next, remaining, rejected, err
}

func cloneRecords(input map[string]PriceRecord) map[string]PriceRecord {
	raw, _ := json.Marshal(input)
	output := map[string]PriceRecord{}
	_ = json.Unmarshal(raw, &output)
	return output
}

func catalogFromRecords(records map[string]PriceRecord, version string, versions map[SourceID]string) (*Catalog, error) {
	entries := map[string]Entry{}
	skipped := 0
	for key, record := range records {
		entry, ok := recordToEntry(record)
		if !ok {
			skipped++
			continue
		}
		entries[key] = entry
		for _, alias := range record.Aliases {
			aliasEntry := entry
			aliasEntry.CatalogKey = key
			entries[normalizeKey(alias)] = aliasEntry
		}
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("catalog has no usable entries")
	}
	catalog := newCatalog(entries, version, skipped)
	catalog.records = cloneRecords(records)
	catalog.SourceVersions = map[SourceID]string{}
	for source, value := range versions {
		catalog.SourceVersions[source] = value
	}
	return catalog, nil
}
