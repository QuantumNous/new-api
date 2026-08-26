package ir

import "github.com/QuantumNous/new-api/relaykit/types"

type LossKind string

const (
	LossDropped   LossKind = "dropped_field"
	LossCoerced   LossKind = "coerced"
	LossGenerated LossKind = "generated_id"
	LossStateful  LossKind = "ignored_stateful"
)

type Loss struct {
	Kind   LossKind `json:"kind"`
	Field  string   `json:"field,omitempty"`
	Reason string   `json:"reason,omitempty"`
}

// Report records projection losses for To(Y). From(X) should not add losses
// for first-class semantics.
type Report struct {
	From   types.RelayFormat `json:"from,omitempty"`
	To     types.RelayFormat `json:"to,omitempty"`
	Losses []Loss            `json:"losses,omitempty"`
}

func (r *Report) Add(kind LossKind, field, reason string) {
	if r == nil {
		return
	}
	r.Losses = append(r.Losses, Loss{Kind: kind, Field: field, Reason: reason})
}

func (r *Report) Empty() bool {
	return r == nil || len(r.Losses) == 0
}
