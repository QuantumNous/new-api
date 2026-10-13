package connectors

import (
	"context"
	"errors"
	"testing"

	"smart-router/api"
	"smart-router/routing"
)

func TestSyntheticProviderFixturesNormalizeIndependently(t *testing.T) {
	tests := []struct {
		name      string
		connector Connector
		fixture   any
	}{
		{
			name:      "ebond",
			connector: EBond{},
			fixture: EBondFixture{
				HTTPStatus: 200, Revision: "eb-1", Models: []string{"model-a"},
				Protocols: []api.Protocol{api.ProtocolChat}, LatencyMS: 12,
			},
		},
		{
			name:      "hualong",
			connector: Hualong{},
			fixture: HualongFixture{
				Code: "OK", Build: "hl-1", Offerings: []HualongOffering{{
					Model: "model-a", Protocol: api.ProtocolResponses,
				}}, LatencyMS: 15,
			},
		},
		{
			name:      "leyi",
			connector: Leyi{},
			fixture: LeyiFixture{
				Available: true, Release: "ly-1",
				Capabilities: map[api.Protocol][]string{api.ProtocolMessages: {"model-a"}},
				LatencyMS:    9,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			observation, err := tt.connector.Probe(context.Background(), tt.fixture)
			if err != nil {
				t.Fatalf("Probe() error = %v", err)
			}
			if observation.Provider != tt.name || observation.Health != routing.HealthHealthy {
				t.Fatalf("Probe() = %#v", observation)
			}
			if len(observation.Models) != 1 || len(observation.Protocols) != 1 {
				t.Fatalf("Probe() capabilities = %#v", observation)
			}
			if len(observation.Fingerprint) != 64 {
				t.Fatalf("fingerprint length = %d, want 64", len(observation.Fingerprint))
			}
		})
	}
}

func TestFixtureDriftIsProviderLocal(t *testing.T) {
	fixture := EBondFixture{
		HTTPStatus: 200, Revision: "eb-1", Models: []string{"model-a"},
		Protocols: []api.Protocol{api.ProtocolChat},
	}
	if _, err := (Hualong{}).Probe(context.Background(), fixture); !errors.Is(err, ErrFixtureDrift) {
		t.Fatalf("Hualong.Probe(EBondFixture) error = %v, want ErrFixtureDrift", err)
	}
	if _, err := (EBond{}).Probe(context.Background(), fixture); err != nil {
		t.Fatalf("EBond.Probe() after isolated drift error = %v", err)
	}
}

func TestUnhealthyFixtureDoesNotExposePayload(t *testing.T) {
	for _, status := range []int{401, 503} {
		observation, err := (EBond{}).Probe(context.Background(), EBondFixture{
			HTTPStatus: status, Revision: "eb-2", Models: []string{"model-a"},
			Protocols: []api.Protocol{api.ProtocolChat},
		})
		if err != nil {
			t.Fatalf("Probe(%d) error = %v", status, err)
		}
		if observation.Health != routing.HealthUnhealthy {
			t.Fatalf("Probe(%d) health = %q, want unhealthy", status, observation.Health)
		}
	}
}
