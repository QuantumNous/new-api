package oaichat

import (
	"github.com/QuantumNous/new-api/relaykit/dto"
	sharedresponses "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/responses"
)

// The Responses request converter flattens a namespace tool group into
// individual chat completions functions named "namespace__tool", because chat
// completions has no grouping and member names are only unique inside their
// group. The Responses function_call item carries the namespace in a dedicated
// field, so the flat name has to be split apart again on the way back: a client
// that declared the tool inside a namespace does not recognise the flat name.

// SplitNamespacedResponse restores the namespace of every function call in a
// non-streaming response.
func SplitNamespacedResponse(resp *dto.OpenAIResponsesResponse) {
	if resp == nil {
		return
	}
	for i := range resp.Output {
		splitNamespacedOutput(&resp.Output[i])
	}
}

// SplitNamespacedStreamPayload restores the namespace of every function call
// carried by one streaming event, whether it arrives as the event's own item or
// inside the final response.
func SplitNamespacedStreamPayload(payload *dto.ResponsesStreamResponse) {
	if payload == nil {
		return
	}
	splitNamespacedOutput(payload.Item)
	SplitNamespacedResponse(payload.Response)
}

func splitNamespacedOutput(output *dto.ResponsesOutput) {
	if output == nil || output.Type != responsesOutputTypeFunctionCall || output.Namespace != "" {
		return
	}
	namespace, name := sharedresponses.SplitNamespacedTool(output.Name)
	if namespace == "" {
		return
	}
	output.Name = name
	output.Namespace = namespace
}
