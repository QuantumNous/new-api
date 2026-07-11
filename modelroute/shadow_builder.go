package modelroute

import "github.com/QuantumNous/new-api/model"

// ShadowBuildResult is the outcome of building a shadow request (PRD §14).
type ShadowBuildResult string

const (
	ShadowBuildOK              ShadowBuildResult = "SHADOW_BUILD_OK"
	ShadowUnprobeableContent   ShadowBuildResult = "SHADOW_UNPROBEABLE_CONTENT"
	ShadowTemplateIncompatible ShadowBuildResult = "SHADOW_TEMPLATE_INCOMPATIBLE"
	ShadowContentRejected      ShadowBuildResult = "SHADOW_CONTENT_REJECTED"
	ShadowTransportFailure     ShadowBuildResult = "SHADOW_TRANSPORT_FAILURE"
)

// ShadowFailureWeight returns learning weight for a failure class (PRD §14).
func ShadowFailureWeight(r ShadowBuildResult) float64 {
	switch r {
	case ShadowBuildOK:
		return 0
	case ShadowUnprobeableContent, ShadowTemplateIncompatible, ShadowContentRejected:
		return 0
	case ShadowTransportFailure:
		return 0.35
	default:
		return 0
	}
}

// ProductionFailureWeight maps production error class to weight (PRD §14).
func ProductionFailureWeight(deterministic bool) float64 {
	if deterministic {
		return 1.0
	}
	return 0.85
}

// ShadowRequest is a trimmed production request copy for probing (PRD §12 / §13).
type ShadowRequest struct {
	ChannelID      int64
	RequestedModel string
	EffectiveModel string
	MaxTokens      int
	Messages       []ShadowMessage
	MultimodalKept bool
	// SourceRequestID is the production request that spawned this probe (for capture lookup).
	SourceRequestID string
}

// SourceRequestIDHint returns the production request id when known.
func (r *ShadowRequest) SourceRequestIDHint() string {
	if r == nil {
		return ""
	}
	return r.SourceRequestID
}

// ShadowMessage is a minimal text message for shadow probes.
type ShadowMessage struct {
	Role string
	Text string
}

// ProductionRequestView is a read-only view of the production request for builders (PRD §13).
type ProductionRequestView struct {
	RequestedModel                 string
	Messages                       []ShadowMessage
	HasNonTextContent              bool
	HasTools                       bool
	TextIndependentComplete        bool
	ProviderSupportsSafeMultimodal bool
}

// ShadowRequestBuilder builds provider-specific shadow requests (PRD §13).
type ShadowRequestBuilder interface {
	BuildShadowRequest(
		prod *ProductionRequestView,
		channelID int64,
		requestedModel string,
		effectiveModel string,
	) (*ShadowRequest, ShadowBuildResult)
}

// TextShadowBuilder implements pure-text shadow construction (PRD §13.1).
type TextShadowBuilder struct{}

func (TextShadowBuilder) BuildShadowRequest(
	prod *ProductionRequestView,
	channelID int64,
	requestedModel string,
	effectiveModel string,
) (*ShadowRequest, ShadowBuildResult) {
	if prod == nil {
		return nil, ShadowUnprobeableContent
	}
	var system string
	var lastUser string
	for _, m := range prod.Messages {
		switch m.Role {
		case "system":
			if system == "" && m.Text != "" {
				system = m.Text
			}
		case "user":
			if m.Text != "" {
				lastUser = m.Text
			}
		}
	}
	if lastUser == "" {
		return nil, ShadowUnprobeableContent
	}
	if prod.HasNonTextContent && !prod.TextIndependentComplete {
		return nil, ShadowUnprobeableContent
	}
	msgs := make([]ShadowMessage, 0, 2)
	if system != "" {
		sys := system
		if len(sys) > 512 {
			sys = sys[:512]
		}
		msgs = append(msgs, ShadowMessage{Role: "system", Text: sys})
	}
	msgs = append(msgs, ShadowMessage{Role: "user", Text: lastUser})
	return &ShadowRequest{
		ChannelID:      channelID,
		RequestedModel: requestedModel,
		EffectiveModel: effectiveModel,
		MaxTokens:      model.DefaultShadowProbeMaxTokens,
		Messages:       msgs,
	}, ShadowBuildOK
}

// MultimodalShadowBuilder implements multimodal-aware construction (PRD §13.2).
type MultimodalShadowBuilder struct {
	Text TextShadowBuilder
}

func (b MultimodalShadowBuilder) BuildShadowRequest(
	prod *ProductionRequestView,
	channelID int64,
	requestedModel string,
	effectiveModel string,
) (*ShadowRequest, ShadowBuildResult) {
	if prod == nil {
		return nil, ShadowUnprobeableContent
	}
	if !prod.HasNonTextContent {
		return b.Text.BuildShadowRequest(prod, channelID, requestedModel, effectiveModel)
	}
	if prod.ProviderSupportsSafeMultimodal {
		// provider may keep same-type multimodal; still require last user text
		view := *prod
		view.TextIndependentComplete = true
		req, res := b.Text.BuildShadowRequest(&view, channelID, requestedModel, effectiveModel)
		if res != ShadowBuildOK {
			return req, res
		}
		req.MultimodalKept = true
		return req, ShadowBuildOK
	}
	if prod.TextIndependentComplete {
		return b.Text.BuildShadowRequest(prod, channelID, requestedModel, effectiveModel)
	}
	return nil, ShadowUnprobeableContent
}

// SelectShadowBuilder picks text vs multimodal builder from production view.
func SelectShadowBuilder(prod *ProductionRequestView) ShadowRequestBuilder {
	if prod != nil && prod.HasNonTextContent {
		return MultimodalShadowBuilder{}
	}
	return TextShadowBuilder{}
}
