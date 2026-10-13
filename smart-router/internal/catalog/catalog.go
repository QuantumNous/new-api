package catalog

import (
	"context"
	"errors"
	"time"

	"smart-router/api"
	"smart-router/routing"
)

var ErrBindingUnavailable = errors.New("no eligible binding")

type Repository interface {
	ListCandidates(context.Context, string, string, api.Protocol) ([]routing.Candidate, error)
	LastDecisionBinding(context.Context, string, string, api.Protocol) (string, error)
}

type Catalog struct {
	repository           Repository
	now                  func() time.Time
	hysteresisMicrounits int64
}

func New(repository Repository, now func() time.Time, hysteresisMicrounits int64) *Catalog {
	return &Catalog{
		repository: repository, now: now,
		hysteresisMicrounits: hysteresisMicrounits,
	}
}

func (catalog *Catalog) Select(ctx context.Context, request api.RouteRequest) ([]api.Binding, error) {
	candidates, err := catalog.repository.ListCandidates(
		ctx, request.Group, request.Model, request.Protocol,
	)
	if err != nil {
		return nil, err
	}
	incumbent, err := catalog.repository.LastDecisionBinding(
		ctx, request.Group, request.Model, request.Protocol,
	)
	if err != nil {
		return nil, err
	}
	bindings := routing.Select(
		request, candidates, incumbent, catalog.now(), catalog.hysteresisMicrounits,
	)
	if len(bindings) == 0 {
		return nil, ErrBindingUnavailable
	}
	return bindings, nil
}
