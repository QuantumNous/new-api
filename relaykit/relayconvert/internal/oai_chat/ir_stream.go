package oaichat

import (
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

// ProjectIR renders canonical block events using the Responses lifecycle writer.
// It shares output indexes with hosted tools and does not convert via Chat.
func (s *ChatToResponsesStreamState) ProjectIR(events []ir.Event, hub *ir.StreamState) ([]ChatToResponsesStreamEvent, error) {
	if s == nil || s.finalized {
		return nil, nil
	}
	out := s.ensureCreated()
	for _, event := range events {
		switch event.Kind {
		case ir.EventBlockStart:
			if event.Block != nil && (event.Block.Kind == ir.BlockKindMedia || event.Block.Kind == ir.BlockKindCode) {
				out = append(out, s.appendTextDelta(event.Block.RenderText())...)
			} else if event.Block != nil && event.Block.ToolUse != nil {
				use := event.Block.ToolUse
				added, err := s.appendToolCallDelta(dto.ToolCallResponse{Index: &event.Index, ID: use.ID, Function: dto.FunctionResponse{Name: use.Name}})
				if err != nil {
					return nil, err
				}
				out = append(out, added...)
			}
		case ir.EventBlockDelta:
			if event.Delta == nil {
				continue
			}
			switch hub.KindOf(event.Index) {
			case ir.BlockKindToolUse:
				use := dto.ToolCallResponse{Index: &event.Index, Function: dto.FunctionResponse{Arguments: event.Delta.JSON}}
				if event.Block != nil && event.Block.ToolUse != nil {
					use.ID = event.Block.ToolUse.ID
					use.Function.Name = event.Block.ToolUse.Name
				}
				added, err := s.appendToolCallDelta(use)
				if err != nil {
					return nil, err
				}
				out = append(out, added...)
			case ir.BlockKindThink:
				out = append(out, s.appendReasoningDelta(event.Delta.Text)...)
			case ir.BlockKindText:
				out = append(out, s.appendTextDelta(event.Delta.Text)...)
			}
		case ir.EventFinish:
			if event.Finish != nil {
				s.applyFinishReason(event.Finish.ToChatFinishReason())
			}
			out = append(out, s.doneDeltaEvents()...)
		}
	}
	return out, nil
}
