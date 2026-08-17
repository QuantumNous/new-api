package intelligent_routing

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
)

type Candidate struct {
	Model            string
	ChannelID        int
	Tier             int
	InputPrice       float64
	OutputPrice      float64
	ContextLimit     int
	Capabilities     map[Capability]bool
	ResponseTimeMS   int
	PredictedSuccess float64
	FailureRate      float64
	HealthTier       int
}

type ChannelSource func(group, requestPath string) []*model.Channel

type Catalog struct {
	config routingsetting.Config
	source ChannelSource
}

func NewCatalog(config routingsetting.Config, source ChannelSource) Catalog {
	if source == nil {
		source = model.ListEnabledChannelsForRouting
	}
	return Catalog{config: config, source: source}
}

func (catalog Catalog) Build(group, requestPath string) []Candidate {
	policies := make(map[string]routingsetting.ModelPolicy, len(catalog.config.Models))
	for _, policy := range catalog.config.Models {
		if policy.InputPrice == 0 && policy.OutputPrice == 0 {
			continue
		}
		policies[policy.Model] = policy
	}
	var candidates []Candidate
	for _, channel := range catalog.source(group, requestPath) {
		if channel == nil || channel.Status != common.ChannelStatusEnabled || !contains(channel.GetGroups(), group) {
			continue
		}
		for _, modelName := range channel.GetModels() {
			modelName = strings.TrimSpace(modelName)
			policy, ok := policies[modelName]
			if !ok {
				continue
			}
			capabilities := make(map[Capability]bool, len(policy.Capabilities))
			for _, capability := range policy.Capabilities {
				capabilities[Capability(capability)] = true
			}
			candidates = append(candidates, Candidate{
				Model: modelName, ChannelID: channel.Id, Tier: policy.Tier,
				InputPrice: policy.InputPrice, OutputPrice: policy.OutputPrice,
				ContextLimit: policy.ContextLimit, Capabilities: capabilities,
				ResponseTimeMS: channel.ResponseTime,
			})
		}
	}
	return candidates
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
