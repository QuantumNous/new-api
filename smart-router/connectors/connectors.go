package connectors

import (
	"context"
	"errors"

	"smart-router/api"
	"smart-router/routing"
)

var ErrFixtureDrift = errors.New("fixture does not match connector schema")

type Observation struct {
	Provider    string
	Health      routing.Health
	Models      []string
	Protocols   []api.Protocol
	LatencyMS   int64
	Fingerprint string
}

type Connector interface {
	Name() string
	Probe(context.Context, any) (Observation, error)
}

type EBond struct{}

type Hualong struct{}

type Leyi struct{}

func (EBond) Name() string   { return "ebond" }
func (Hualong) Name() string { return "hualong" }
func (Leyi) Name() string    { return "leyi" }
