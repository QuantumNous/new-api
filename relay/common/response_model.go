package common

import "strings"

// ResponseModel records upstream declarations before response conversion. It is
// diagnostic only: it must never change routing, pricing, or downstream output.
type ResponseModel struct {
	RequestedModel string `json:"requested_model"`
	UpstreamModel  string `json:"upstream_model"`
	ReturnedModel  string `json:"returned_model"`
	Mismatch       bool   `json:"mismatch"`
}

// ObserveResponseModel retains the first mismatch, so a later matching or empty
// stream event cannot erase it. Call only with a model read from the upstream,
// never with a model synthesized by a response converter.
func (info *RelayInfo) ObserveResponseModel(model string) {
	if info == nil || strings.TrimSpace(model) == "" {
		return
	}
	if info.ResponseModel == nil {
		info.ResponseModel = &ResponseModel{
			RequestedModel: info.OriginModelName,
			UpstreamModel:  info.GetUpstreamModelName(),
		}
	}
	observation := info.ResponseModel
	if observation.Mismatch {
		return
	}
	observation.ReturnedModel = model
	observation.Mismatch = model != observation.RequestedModel && model != observation.UpstreamModel
}
