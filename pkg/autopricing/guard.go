package autopricing

import (
	"fmt"
	"math"
	"sort"

	"github.com/QuantumNous/new-api/common"
)

type PendingReview struct {
	Model            string       `json:"model"`
	Reason           string       `json:"reason"`
	Fingerprint      string       `json:"fingerprint"`
	CandidateVersion string       `json:"candidate_version"`
	Current          *PriceRecord `json:"current,omitempty"`
	Candidate        *PriceRecord `json:"candidate,omitempty"`
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
	keySet := make(map[string]struct{}, len(active.records)+len(candidate.records))
	for key := range active.records {
		keySet[key] = struct{}{}
	}
	for key := range candidate.records {
		keySet[key] = struct{}{}
	}
	keys := make([]string, 0, len(keySet))
	for key := range keySet {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, model := range keys {
		newRecord, candidateExists := candidate.records[model]
		oldRecord, exists := active.records[model]
		if !exists {
			if candidateExists && newRecord.PrimarySource != SourceOverride {
				candidateCopy := newRecord
				fingerprint := catalogFingerprint(candidate.Version, model, &candidateCopy)
				delete(result, model)
				if !rejected[fingerprint] {
					pending = append(pending, PendingReview{
						Model: model, Reason: "model added to catalog", Fingerprint: fingerprint,
						CandidateVersion: candidate.Version, Candidate: &candidateCopy,
					})
				}
			}
			continue
		}
		reason := ""
		var candidateRecord *PriceRecord
		if !candidateExists {
			reason = "model removed from catalog"
		} else {
			candidateCopy := newRecord
			candidateRecord = &candidateCopy
			if newRecord.PrimarySource != SourceOverride {
				reason = reviewReason(oldRecord, newRecord, threshold)
			}
		}
		if reason == "" {
			continue
		}
		fingerprint := catalogFingerprint(candidate.Version, model, candidateRecord)
		result[model] = oldRecord
		if rejected[fingerprint] {
			continue
		}
		oldCopy := oldRecord
		pending = append(pending, PendingReview{Model: model, Reason: reason, Fingerprint: fingerprint, CandidateVersion: candidate.Version, Current: &oldCopy, Candidate: candidateRecord})
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
	aAliases := append([]string(nil), a.Aliases...)
	bAliases := append([]string(nil), b.Aliases...)
	sort.Strings(aAliases)
	sort.Strings(bAliases)
	for index := range aAliases {
		if normalizeKey(aAliases[index]) != normalizeKey(bAliases[index]) {
			return false
		}
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
		pairs := map[string]*float64{"input": costs.Input, "output": costs.Output, "cache_read": costs.CacheRead, "cache_write_5m": costs.CacheWrite5m, "cache_write_1h": costs.CacheWrite1h, "image_input": costs.ImageInput, "image_output": costs.ImageOutput, "audio_input": costs.AudioInput, "audio_output": costs.AudioOutput}
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

func ApplyReview(guarded *Catalog, pending []PendingReview, fingerprints []string, approve bool) (*Catalog, []PendingReview, []string, error) {
	if guarded == nil {
		return nil, nil, nil, fmt.Errorf("guarded catalog is nil")
	}
	selected := map[string]bool{}
	for _, fingerprint := range fingerprints {
		if selected[fingerprint] {
			return nil, nil, nil, fmt.Errorf("duplicate fingerprint %q", fingerprint)
		}
		selected[fingerprint] = true
	}
	if !approve && len(fingerprints) == 0 {
		for _, item := range pending {
			selected[item.Fingerprint] = true
		}
	}
	known := map[string]bool{}
	for _, item := range pending {
		known[item.Fingerprint] = true
	}
	for fingerprint := range selected {
		if !known[fingerprint] {
			return nil, nil, nil, fmt.Errorf("review fingerprint %q is not pending or is stale", fingerprint)
		}
	}
	records := cloneRecords(guarded.records)
	remaining := []PendingReview{}
	rejected := []string{}
	for _, item := range pending {
		if !selected[item.Fingerprint] {
			remaining = append(remaining, item)
			continue
		}
		if approve {
			if item.Candidate == nil {
				delete(records, item.Model)
			} else {
				records[item.Model] = *item.Candidate
			}
		} else {
			rejected = append(rejected, item.Fingerprint)
		}
	}
	next, err := catalogFromRecords(records, guarded.Version, guarded.SourceVersions)
	sort.Strings(rejected)
	return next, remaining, rejected, err
}

func cloneRecords(input map[string]PriceRecord) map[string]PriceRecord {
	raw, _ := common.Marshal(input)
	output := map[string]PriceRecord{}
	_ = common.Unmarshal(raw, &output)
	return output
}

func catalogFromRecords(records map[string]PriceRecord, version string, versions map[SourceID]string) (*Catalog, error) {
	keys := make([]string, 0, len(records))
	for key := range records {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	entries := make(map[string]Entry, len(records))
	validRecords := make(map[string]PriceRecord, len(records))
	skipped := 0
	for _, key := range keys {
		record := records[key]
		entry, ok := recordToEntry(record)
		if !ok {
			skipped++
			continue
		}
		entries[key] = entry
		validRecords[key] = record
	}
	for _, key := range keys {
		record, ok := validRecords[key]
		if !ok {
			continue
		}
		entry := entries[key]
		for _, alias := range record.Aliases {
			alias = normalizeKey(alias)
			if alias == "" {
				continue
			}
			if _, canonical := validRecords[alias]; canonical {
				continue
			}
			if _, exists := entries[alias]; exists {
				continue
			}
			aliasEntry := entry
			aliasEntry.CatalogKey = key
			entries[alias] = aliasEntry
		}
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("catalog has no usable entries")
	}
	catalog := newCatalog(entries, version, skipped)
	catalog.records = cloneRecords(validRecords)
	catalog.SourceVersions = map[SourceID]string{}
	for source, value := range versions {
		catalog.SourceVersions[source] = value
	}
	return catalog, nil
}
