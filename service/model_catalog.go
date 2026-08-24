package service

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	CatalogIssueNoAbility        = "no_ability"
	CatalogIssueAbilityDisabled  = "ability_disabled"
	CatalogIssueChannelDisabled  = "channel_disabled"
	CatalogIssueBillingMissing   = "billing_missing"
	CatalogIssueMetadataMissing  = "metadata_missing"
	CatalogIssueResolverMismatch = "resolver_mismatch"
)

type ModelCatalogIssue struct {
	Code     string `json:"code"`
	Severity string `json:"severity"`
}

type ModelCatalogReadiness struct {
	Model                   string              `json:"model"`
	Available               bool                `json:"available"`
	ConfiguredChannels      int                 `json:"configured_channels"`
	Abilities               int                 `json:"abilities"`
	EnabledAbilities        int                 `json:"enabled_abilities"`
	EnabledChannels         int                 `json:"enabled_channels"`
	EnabledChannelAbilities int                 `json:"enabled_channel_abilities"`
	HasBilling              bool                `json:"has_billing"`
	HasMetadata             bool                `json:"has_metadata"`
	Issues                  []ModelCatalogIssue `json:"issues"`
}

type ModelCatalogReadinessReport struct {
	Group      string                  `json:"group"`
	Configured int                     `json:"configured"`
	Available  int                     `json:"available"`
	Blocked    int                     `json:"blocked"`
	Models     []ModelCatalogReadiness `json:"models"`
}

// AuditModelCatalogReadiness explains why a channel-declared model is absent
// from Available Models for one group. It reuses the production resolver as the
// source of truth and never exposes channel names, URLs, or keys.
func AuditModelCatalogReadiness(group string) (*ModelCatalogReadinessReport, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		group = modelAccessPLGGroup
	}

	channels, err := model.GetModelCatalogChannels()
	if err != nil {
		return nil, err
	}
	abilities, err := model.GetModelCatalogAbilitiesForGroup(group)
	if err != nil {
		return nil, err
	}

	configuredChannels := make(map[string]int)
	modelNames := make(map[string]struct{})
	for _, channel := range channels {
		if !stringSliceContains(channel.Groups, group) {
			continue
		}
		for _, modelName := range channel.Models {
			configuredChannels[modelName]++
			modelNames[modelName] = struct{}{}
		}
	}
	for _, ability := range abilities {
		modelNames[ability.Model] = struct{}{}
	}

	names := make([]string, 0, len(modelNames))
	for name := range modelNames {
		names = append(names, name)
	}
	sort.Strings(names)
	metadata, err := model.GetPublicModelMetadataMap(names)
	if err != nil {
		return nil, err
	}
	resolved, err := resolveStrictModelAccess([]string{group}, false)
	if err != nil {
		return nil, err
	}
	available := make(map[string]struct{}, len(resolved.modelIDs))
	for _, name := range resolved.modelIDs {
		available[name] = struct{}{}
	}

	byModel := make(map[string][]model.ModelCatalogAbility)
	for _, ability := range abilities {
		byModel[ability.Model] = append(byModel[ability.Model], ability)
	}

	report := &ModelCatalogReadinessReport{Group: group, Configured: len(names), Models: make([]ModelCatalogReadiness, 0, len(names))}
	for _, name := range names {
		rows := byModel[name]
		item := ModelCatalogReadiness{
			Model:              name,
			ConfiguredChannels: configuredChannels[name],
			Abilities:          len(rows),
			HasBilling:         modelHasVisibleBilling(name, false),
			Issues:             []ModelCatalogIssue{},
		}
		_, item.HasMetadata = metadata[name]
		for _, row := range rows {
			if row.Enabled {
				item.EnabledAbilities++
			}
			if row.ChannelStatus == common.ChannelStatusEnabled {
				item.EnabledChannels++
			}
			if row.Enabled && row.ChannelStatus == common.ChannelStatusEnabled {
				item.EnabledChannelAbilities++
			}
		}
		_, item.Available = available[name]

		if item.Abilities == 0 {
			item.Issues = append(item.Issues, catalogIssue(CatalogIssueNoAbility, "error"))
		} else if item.EnabledAbilities == 0 {
			item.Issues = append(item.Issues, catalogIssue(CatalogIssueAbilityDisabled, "error"))
		}
		if item.Abilities > 0 && item.EnabledChannels == 0 {
			item.Issues = append(item.Issues, catalogIssue(CatalogIssueChannelDisabled, "error"))
		}
		if !item.HasBilling {
			item.Issues = append(item.Issues, catalogIssue(CatalogIssueBillingMissing, "error"))
		}
		if !item.HasMetadata {
			item.Issues = append(item.Issues, catalogIssue(CatalogIssueMetadataMissing, "warning"))
		}
		if item.EnabledChannelAbilities > 0 && item.HasBilling && !item.Available {
			item.Issues = append(item.Issues, catalogIssue(CatalogIssueResolverMismatch, "error"))
		}

		if item.Available {
			report.Available++
		} else {
			report.Blocked++
		}
		report.Models = append(report.Models, item)
	}
	return report, nil
}

func catalogIssue(code, severity string) ModelCatalogIssue {
	return ModelCatalogIssue{Code: code, Severity: severity}
}

func stringSliceContains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
