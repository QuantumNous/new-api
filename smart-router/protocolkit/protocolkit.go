package protocolkit

import (
	"context"
	"errors"
	"fmt"

	"smart-router/api"
	"smart-router/connectors"
)

var approvedModelIDs = []string{
	"claude-fable-5",
	"claude-haiku-4-5",
	"claude-opus-4-6",
	"claude-opus-4-7",
	"claude-opus-4-8",
	"claude-opus-5",
	"claude-sonnet-4-6",
	"claude-sonnet-5",
	"deepseek-v4-pro",
	"deepseekv4.1flash",
	"doubao-1-5-lite-32k",
	"doubao-1-5-pro-32k",
	"doubao-1-5-pro-32k-character",
	"doubao-seed-1.6",
	"doubao-seed-1.6-flash",
	"doubao-seed-1.8",
	"doubao-seed-2.0-code",
	"doubao-seed-2.0-lite",
	"doubao-seed-2.0-mini",
	"doubao-seed-2.0-pro",
	"doubao-seed-2.1-pro",
	"doubao-seed-2.1-turbo",
	"glm-4.7",
	"glm-5.1",
	"glm-5.2",
	"glm-5.3",
	"glm-5.3-flash",
	"gpt-5.3-codex-spark",
	"gpt-5.5",
	"gpt-5.6",
	"gpt-6-astra",
	"grok-4.5",
	"grok-4.6",
	"kimi-k2-5",
	"kimi-k3",
	"minimax-m3",
}

var conformanceProtocols = []api.Protocol{
	api.ProtocolChat,
	api.ProtocolResponses,
	api.ProtocolMessages,
}

var conformanceProviders = []string{"ebond", "hualong", "leyi"}

type CheckName string

const (
	CheckUnary  CheckName = "unary"
	CheckStream CheckName = "stream"
	CheckTool   CheckName = "tool"
	CheckUsage  CheckName = "usage"
	CheckError  CheckName = "error"
)

type Check struct {
	Name       CheckName `json:"name"`
	Applicable bool      `json:"applicable"`
	Passed     bool      `json:"passed"`
}

type Cell struct {
	ModelID     string       `json:"model_id"`
	Protocol    api.Protocol `json:"protocol"`
	Provider    string       `json:"provider"`
	AdapterPath string       `json:"adapter_path"`
	Checks      []Check      `json:"checks"`
	Passed      bool         `json:"passed"`
}

type Mutation struct {
	ModelID  string
	Protocol api.Protocol
	Check    CheckName
}

func ApprovedModelIDs() []string {
	return append([]string(nil), approvedModelIDs...)
}

func Protocols() []api.Protocol {
	return append([]api.Protocol(nil), conformanceProtocols...)
}

func Run() ([]Cell, error) {
	return run(Mutation{}, false)
}

func RunWithMutation(mutation Mutation) ([]Cell, error) {
	if !containsModel(mutation.ModelID) {
		return nil, errors.New("mutation model is not approved")
	}
	if !containsProtocol(mutation.Protocol) {
		return nil, errors.New("mutation protocol is not in the conformance matrix")
	}
	if !containsCheck(mutation.Check) {
		return nil, errors.New("mutation check is unsupported")
	}
	return run(mutation, true)
}

func run(mutation Mutation, mutate bool) ([]Cell, error) {
	adapters := protocolAdapters()
	cells := make([]Cell, 0, len(approvedModelIDs)*len(conformanceProtocols))
	for modelIndex, modelID := range approvedModelIDs {
		for protocolIndex, protocol := range conformanceProtocols {
			provider := conformanceProviders[(modelIndex+protocolIndex)%len(conformanceProviders)]
			if err := runConnector(provider, modelID, protocol); err != nil {
				return nil, fmt.Errorf(
					"connector %s for %s/%s: %w",
					provider,
					modelID,
					protocol,
					err,
				)
			}
			adapter, ok := adapters[protocol]
			if !ok {
				return nil, fmt.Errorf("no adapter for protocol %q", protocol)
			}
			mutatedCheck := CheckName("")
			if mutate && mutation.ModelID == modelID && mutation.Protocol == protocol {
				mutatedCheck = mutation.Check
			}
			checks, err := adapter.Run(modelID, mutatedCheck)
			if err != nil {
				return nil, fmt.Errorf("adapter %s for %s: %w", adapter.Path(), modelID, err)
			}
			cells = append(cells, Cell{
				ModelID:     modelID,
				Protocol:    protocol,
				Provider:    provider,
				AdapterPath: provider + "/" + adapter.Path(),
				Checks:      checks,
				Passed:      checksPassed(checks),
			})
		}
	}
	return cells, nil
}

func runConnector(provider string, modelID string, protocol api.Protocol) error {
	var (
		connector connectors.Connector
		fixture   any
	)
	switch provider {
	case "ebond":
		connector = connectors.EBond{}
		fixture = connectors.EBondFixture{
			HTTPStatus: 200,
			Revision:   "conformance-v1",
			Models:     []string{modelID},
			Protocols:  []api.Protocol{protocol},
			LatencyMS:  1,
		}
	case "hualong":
		connector = connectors.Hualong{}
		fixture = connectors.HualongFixture{
			Code:  "OK",
			Build: "conformance-v1",
			Offerings: []connectors.HualongOffering{{
				Model: modelID, Protocol: protocol,
			}},
			LatencyMS: 1,
		}
	case "leyi":
		connector = connectors.Leyi{}
		fixture = connectors.LeyiFixture{
			Available: true,
			Release:   "conformance-v1",
			Capabilities: map[api.Protocol][]string{
				protocol: {modelID},
			},
			LatencyMS: 1,
		}
	default:
		return errors.New("unsupported provider")
	}
	observation, err := connector.Probe(context.Background(), fixture)
	if err != nil {
		return err
	}
	if observation.Provider != provider ||
		len(observation.Models) != 1 ||
		observation.Models[0] != modelID ||
		len(observation.Protocols) != 1 ||
		observation.Protocols[0] != protocol {
		return errors.New("connector did not preserve the cell capability")
	}
	return nil
}

func containsModel(modelID string) bool {
	for _, approved := range approvedModelIDs {
		if modelID == approved {
			return true
		}
	}
	return false
}

func containsProtocol(protocol api.Protocol) bool {
	for _, approved := range conformanceProtocols {
		if protocol == approved {
			return true
		}
	}
	return false
}

func containsCheck(check CheckName) bool {
	switch check {
	case CheckUnary, CheckStream, CheckTool, CheckUsage, CheckError:
		return true
	default:
		return false
	}
}

func checksPassed(checks []Check) bool {
	for _, check := range checks {
		if check.Applicable && !check.Passed {
			return false
		}
	}
	return true
}
