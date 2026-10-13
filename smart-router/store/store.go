package store

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"

	"smart-router/api"
	"smart-router/routing"
)

var (
	ErrBindingNotFound = errors.New("binding does not exist")
	ErrOutcomeConflict = errors.New("outcome event conflicts with prior payload")
)

type Source struct {
	ID        string
	Connector string
	Enabled   bool
}

type BindingRecord struct {
	ID             string
	SourceID       string
	Group          string
	Model          string
	Protocol       api.Protocol
	ProtocolPlugin string
	Enabled        bool
	CostMicrounits int64
}

type RouteKey struct {
	Group    string
	Model    string
	Protocol api.Protocol
}

type Observation struct {
	Health              routing.Health
	ConsecutiveFailures int
	CooldownUntil       time.Time
	Fingerprint         string
	ObservedAt          time.Time
}

type Decision struct {
	RequestID        string
	Group            string
	Model            string
	Protocol         api.Protocol
	SnapshotRevision string
	BindingIDs       []string
	CreatedAt        time.Time
}

func NewBindingID() (string, error) {
	random := make([]byte, 18)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return "bnd_" + base64.RawURLEncoding.EncodeToString(random), nil
}
