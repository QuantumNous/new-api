package catalog

import (
	"context"
	"errors"
	"testing"
	"time"

	"smart-router/api"
	"smart-router/routing"
)

type fakeRepository struct {
	candidates []routing.Candidate
	incumbent  string
	err        error
}

func (repository fakeRepository) ListCandidates(
	context.Context,
	string,
	string,
	api.Protocol,
) ([]routing.Candidate, error) {
	return repository.candidates, repository.err
}

func (repository fakeRepository) LastDecisionBinding(
	context.Context,
	string,
	string,
	api.Protocol,
) (string, error) {
	return repository.incumbent, repository.err
}

func TestSelectDelegatesPersistedStateToRoutingPolicy(t *testing.T) {
	now := time.Unix(100, 0)
	catalog := New(fakeRepository{
		incumbent: "bnd-incumbent",
		candidates: []routing.Candidate{
			{
				BindingID: "bnd-cheap", Group: "g", Model: "m",
				Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
				Enabled: true, Health: routing.HealthHealthy, CostMicrounits: 10,
			},
			{
				BindingID: "bnd-incumbent", Group: "g", Model: "m",
				Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
				Enabled: true, Health: routing.HealthHealthy, CostMicrounits: 12,
			},
		},
	}, func() time.Time { return now }, 2)
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "r",
		Group: "g", Model: "m", Protocol: api.ProtocolChat, AttemptLimit: 2,
	}

	bindings, err := catalog.Select(context.Background(), request)
	if err != nil {
		t.Fatalf("Select() error = %v", err)
	}
	if bindings[0].BindingID != "bnd-incumbent" {
		t.Fatalf("first binding = %q, want hysteresis incumbent", bindings[0].BindingID)
	}
}

func TestSelectReturnsBindingUnavailable(t *testing.T) {
	catalog := New(fakeRepository{}, time.Now, 0)
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "r",
		Group: "g", Model: "m", Protocol: api.ProtocolChat, AttemptLimit: 1,
	}
	_, err := catalog.Select(context.Background(), request)
	if !errors.Is(err, ErrBindingUnavailable) {
		t.Fatalf("Select() error = %v, want ErrBindingUnavailable", err)
	}
}
