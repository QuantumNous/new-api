package connectors

import (
	"context"
	"errors"
	"sort"

	"smart-router/api"
	"smart-router/fingerprint"
	"smart-router/routing"
)

type EBondFixture struct {
	HTTPStatus int
	Revision   string
	Models     []string
	Protocols  []api.Protocol
	LatencyMS  int64
}

type HualongOffering struct {
	Model    string
	Protocol api.Protocol
}

type HualongFixture struct {
	Code      string
	Build     string
	Offerings []HualongOffering
	LatencyMS int64
}

type LeyiFixture struct {
	Available    bool
	Release      string
	Capabilities map[api.Protocol][]string
	LatencyMS    int64
}

func (connector EBond) Probe(ctx context.Context, raw any) (Observation, error) {
	if err := ctx.Err(); err != nil {
		return Observation{}, err
	}
	fixture, ok := raw.(EBondFixture)
	if !ok {
		return Observation{}, ErrFixtureDrift
	}
	health := routing.HealthUnhealthy
	if fixture.HTTPStatus >= 200 && fixture.HTTPStatus < 300 {
		health = routing.HealthHealthy
	} else if fixture.HTTPStatus == 429 {
		health = routing.HealthDegraded
	}
	return makeObservation(
		connector.Name(), fixture.Revision, health,
		fixture.Models, fixture.Protocols, fixture.LatencyMS,
	)
}

func (connector Hualong) Probe(ctx context.Context, raw any) (Observation, error) {
	if err := ctx.Err(); err != nil {
		return Observation{}, err
	}
	fixture, ok := raw.(HualongFixture)
	if !ok {
		return Observation{}, ErrFixtureDrift
	}
	models := make([]string, 0, len(fixture.Offerings))
	protocols := make([]api.Protocol, 0, len(fixture.Offerings))
	for _, offering := range fixture.Offerings {
		models = append(models, offering.Model)
		protocols = append(protocols, offering.Protocol)
	}
	health := routing.HealthUnhealthy
	if fixture.Code == "OK" {
		health = routing.HealthHealthy
	}
	return makeObservation(
		connector.Name(), fixture.Build, health,
		models, protocols, fixture.LatencyMS,
	)
}

func (connector Leyi) Probe(ctx context.Context, raw any) (Observation, error) {
	if err := ctx.Err(); err != nil {
		return Observation{}, err
	}
	fixture, ok := raw.(LeyiFixture)
	if !ok {
		return Observation{}, ErrFixtureDrift
	}
	var models []string
	var protocols []api.Protocol
	for protocol, protocolModels := range fixture.Capabilities {
		protocols = append(protocols, protocol)
		models = append(models, protocolModels...)
	}
	health := routing.HealthUnhealthy
	if fixture.Available {
		health = routing.HealthHealthy
	}
	return makeObservation(
		connector.Name(), fixture.Release, health,
		models, protocols, fixture.LatencyMS,
	)
}

func makeObservation(
	provider string,
	revision string,
	health routing.Health,
	models []string,
	protocols []api.Protocol,
	latencyMS int64,
) (Observation, error) {
	if latencyMS < 0 {
		return Observation{}, errors.New("latency must not be negative")
	}
	models = uniqueStrings(models)
	protocols = uniqueProtocols(protocols)
	hash, err := fingerprint.Compute(fingerprint.Document{
		Provider: provider, Revision: revision, Healthy: health != routing.HealthUnhealthy,
		Models: models, Protocols: protocols,
	})
	if err != nil {
		return Observation{}, err
	}
	return Observation{
		Provider: provider, Health: health, Models: models, Protocols: protocols,
		LatencyMS: latencyMS, Fingerprint: hash,
	}, nil
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
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

func uniqueProtocols(values []api.Protocol) []api.Protocol {
	seen := make(map[api.Protocol]struct{}, len(values))
	result := make([]api.Protocol, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Slice(result, func(left, right int) bool {
		return result[left] < result[right]
	})
	return result
}
