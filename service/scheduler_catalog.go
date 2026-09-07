package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

// SchedulerCatalog is the credential-free Catalog contract consumed by the
// standalone Scheduler. Keep this DTO local to new-api so the Scheduler
// process never needs to import new-api's model package.
type SchedulerCatalog struct {
	Version   string              `json:"version"`
	Model     string              `json:"model"`
	Endpoints []SchedulerEndpoint `json:"endpoints"`
}

type SchedulerEndpoint struct {
	EndpointID   string                `json:"endpoint_id"`
	ChannelID    int                   `json:"channel_id"`
	KeyIndex     int                   `json:"key_index"`
	Provider     string                `json:"provider"`
	Model        string                `json:"model"`
	ModelAliases []string              `json:"model_aliases,omitempty"`
	Enabled      bool                  `json:"enabled"`
	Group        string                `json:"group,omitempty"`
	Priority     int64                 `json:"priority"`
	Weight       int64                 `json:"weight"`
	Capabilities SchedulerCapabilities `json:"capabilities"`
	Limits       SchedulerLimits       `json:"limits"`
}

type SchedulerCapabilities struct {
	Stream     bool `json:"stream"`
	Tools      bool `json:"tools"`
	JSONMode   bool `json:"json_mode"`
	Vision     bool `json:"vision"`
	MaxTokens  int  `json:"max_tokens"`
	MaxContext int  `json:"max_context"`
}

type SchedulerLimits struct {
	RPM            int `json:"rpm"`
	TPM            int `json:"tpm,omitempty"`
	MaxConcurrency int `json:"max_concurrency"`
}

// BuildSchedulerCatalog reads only Channel configuration and emits one
// stable Endpoint per channel key. Key material itself is never copied into
// the returned DTO. The model query is explicit to keep one Scheduler
// Catalog scoped to one request model, matching the current scheduler-v2
// contract.
func BuildSchedulerCatalog(modelName string) (SchedulerCatalog, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return SchedulerCatalog{}, fmt.Errorf("model is required")
	}
	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		return SchedulerCatalog{}, err
	}
	return BuildSchedulerCatalogFromChannels(modelName, channels)
}

// BuildSchedulerCatalogFromChannels is separated from the database query so
// the sensitive-field and multi-key expansion rules can be tested without a
// running new-api database.
func BuildSchedulerCatalogFromChannels(modelName string, channels []*model.Channel) (SchedulerCatalog, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return SchedulerCatalog{}, fmt.Errorf("model is required")
	}
	endpoints := make([]SchedulerEndpoint, 0)
	for _, channel := range channels {
		if channel == nil || !channelSupportsModel(channel, modelName) {
			continue
		}
		models := channelModelNames(channel)
		if len(models) == 0 {
			models = []string{modelName}
		}
		keys := channel.GetKeys()
		if len(keys) == 0 {
			// Keep an explicit disabled Endpoint so Scheduler can audit the
			// configured Channel while never attempting a missing credential.
			keys = []string{""}
		}
		for keyIndex := range keys {
			enabled := channel.Status == common.ChannelStatusEnabled
			if channel.ChannelInfo.IsMultiKey {
				if status, ok := channel.ChannelInfo.MultiKeyStatusList[keyIndex]; ok {
					enabled = enabled && status == common.ChannelStatusEnabled
				}
			}
			aliases := make([]string, 0, len(models))
			for _, candidate := range models {
				if candidate != modelName {
					aliases = append(aliases, candidate)
				}
			}
			endpoints = append(endpoints, SchedulerEndpoint{
				EndpointID:   fmt.Sprintf("new-api-ch-%d-k%d", channel.Id, keyIndex),
				ChannelID:    channel.Id,
				KeyIndex:     keyIndex,
				Provider:     constant.GetChannelTypeName(channel.Type),
				Model:        modelName,
				ModelAliases: aliases,
				Enabled:      enabled && strings.TrimSpace(keys[keyIndex]) != "",
				Group:        firstGroup(channel.GetGroups()),
				Priority:     channel.GetPriority(),
				Weight:       int64(channel.GetWeight()),
				Capabilities: SchedulerCapabilities{Stream: true},
				Limits:       SchedulerLimits{RPM: channel.RPM, TPM: channel.TPM, MaxConcurrency: channel.MaxConcurrency},
			})
		}
	}
	sort.Slice(endpoints, func(i, j int) bool { return endpoints[i].EndpointID < endpoints[j].EndpointID })
	if len(endpoints) == 0 {
		return SchedulerCatalog{}, fmt.Errorf("no channel endpoint supports model %s", modelName)
	}
	// Hash the complete credential-free representation. The version is stable
	// while Channel/Key metadata is unchanged and changes whenever a relevant
	// field changes, without requiring a mutable counter in new-api.
	canonical := struct {
		Model     string              `json:"model"`
		Endpoints []SchedulerEndpoint `json:"endpoints"`
	}{Model: modelName, Endpoints: endpoints}
	data, err := json.Marshal(canonical)
	if err != nil {
		return SchedulerCatalog{}, err
	}
	digest := sha256.Sum256(data)
	return SchedulerCatalog{Version: "new-api-" + hex.EncodeToString(digest[:8]), Model: modelName, Endpoints: endpoints}, nil
}

func channelSupportsModel(channel *model.Channel, requested string) bool {
	for _, candidate := range channelModelNames(channel) {
		if candidate == requested {
			return true
		}
	}
	return false
}

func channelModelNames(channel *model.Channel) []string {
	models := normalizeModels(channel.GetModels())
	if mapping := strings.TrimSpace(channel.GetModelMapping()); mapping != "" {
		var aliases map[string]string
		if json.Unmarshal([]byte(mapping), &aliases) == nil {
			for source := range aliases {
				models = append(models, source)
			}
			models = normalizeModels(models)
		}
	}
	return models
}

func normalizeModels(models []string) []string {
	seen := make(map[string]struct{}, len(models))
	result := make([]string, 0, len(models))
	for _, value := range models {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func firstGroup(groups []string) string {
	for _, group := range groups {
		if group = strings.TrimSpace(group); group != "" {
			return group
		}
	}
	return ""
}
