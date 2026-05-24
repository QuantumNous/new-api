package service

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
)

type dynamicStatusSample struct {
	Provider     string
	MonitorID    string
	MonitorName  string
	Source       string
	State        string
	Status       int
	Availability float64
	Latency      int
	Reason       string
}

func loadLatestExternalStatusSamples() (map[string]dynamicStatusSample, error) {
	var records []model.SupplierStatusSync
	if err := model.DB.Order("checked_at asc").Find(&records).Error; err != nil {
		return nil, err
	}
	index := make(map[string]dynamicStatusSample)
	for _, record := range records {
		providerSlug := externalProviderSlug(record)
		if providerSlug == "" || record.ModelName == "" {
			continue
		}
		index[externalStatusKey(providerSlug, record.ModelName)] = dynamicStatusSample{
			Provider:     record.Provider,
			MonitorID:    record.MonitorID,
			MonitorName:  record.MonitorName,
			Source:       record.Provider,
			State:        supplierStatusToDynamicHealth(record.Status, record.Availability),
			Status:       record.Status,
			Availability: record.Availability,
			Latency:      record.Latency,
			Reason:       record.Message,
		}
	}
	return index, nil
}

func statusSampleForAbility(
	ability dynamicAbilityRow,
	probes map[string]model.ChannelProbeResult,
	externalStatuses map[string]dynamicStatusSample,
) (dynamicStatusSample, bool) {
	if setting := ParseChannelStatusMonitorSetting(ability.ChannelOtherInfo); setting != nil {
		requestModel := firstNonEmpty(setting.RequestModel, ability.Model)
		providerSlug := firstNonEmpty(setting.ProviderSlug, normalizeStatusSlug(setting.Provider))
		if providerSlug != "" && requestModel != "" {
			if sample, ok := externalStatuses[externalStatusKey(providerSlug, requestModel)]; ok {
				sample.Provider = firstNonEmpty(sample.Provider, setting.Provider)
				sample.MonitorID = firstNonEmpty(setting.MonitorID, sample.MonitorID)
				sample.MonitorName = firstNonEmpty(setting.MonitorName, sample.MonitorName)
				sample.Source = firstNonEmpty(sample.Source, setting.Provider)
				return sample, true
			}
		}
	}
	if probe, ok := probes[dynamicTargetKey(ability.ChannelID, ability.Group, ability.Model)]; ok {
		return dynamicStatusSample{
			Provider:    DynamicSourcePlatformProbe,
			MonitorID:   dynamicTargetKey(ability.ChannelID, ability.Group, ability.Model),
			MonitorName: ability.Model,
			Source:      DynamicSourcePlatformProbe,
			State:       probeStatusToDynamicHealth(probe.Status),
			Status:      probeStatusCode(probe.Status),
			Latency:     probe.Latency,
			Reason:      probe.ErrorMessage,
		}, true
	}
	for _, slug := range abilityProviderSlugCandidates(ability) {
		if sample, ok := externalStatuses[externalStatusKey(slug, ability.Model)]; ok {
			return sample, true
		}
	}
	return dynamicStatusSample{}, false
}

func probeStatusToDynamicHealth(status string) string {
	switch status {
	case DynamicHealthHealthy, DynamicHealthDegraded, DynamicHealthUnhealthy:
		return status
	default:
		return DynamicHealthUnknown
	}
}

func supplierStatusToDynamicHealth(status int, availability float64) string {
	if status == 1 && availability >= 95 {
		return DynamicHealthHealthy
	}
	if status == 0 || availability < 70 {
		return DynamicHealthUnhealthy
	}
	if status == 2 || availability < 95 {
		return DynamicHealthDegraded
	}
	return DynamicHealthUnknown
}

func probeStatusCode(status string) int {
	switch status {
	case DynamicHealthHealthy:
		return 1
	case DynamicHealthDegraded:
		return 2
	case DynamicHealthUnhealthy:
		return 0
	default:
		return -1
	}
}

func abilityProviderSlugCandidates(ability dynamicAbilityRow) []string {
	candidates := make([]string, 0, 2)
	if ability.Tag != nil {
		candidates = append(candidates, normalizeStatusSlug(*ability.Tag))
	}
	candidates = append(candidates, normalizeStatusSlug(ability.ChannelName))
	return candidates
}

func externalProviderSlug(record model.SupplierStatusSync) string {
	if strings.Contains(record.MonitorID, ":") {
		return normalizeStatusSlug(strings.SplitN(record.MonitorID, ":", 2)[0])
	}
	return normalizeStatusSlug(record.GroupName)
}

func externalStatusKey(providerSlug string, modelName string) string {
	return normalizeStatusSlug(providerSlug) + "\x00" + strings.TrimSpace(modelName)
}

func normalizeStatusSlug(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
