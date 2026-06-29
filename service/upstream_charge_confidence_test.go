package service

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestClassifyUpstreamChargeConfidence_kimiTokenLimit400(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		fmt.Errorf("Invalid request: Your request exceeded model token limit: 262144 (requested: 453374)"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)
	got := ClassifyUpstreamChargeConfidence(err)
	if got != UpstreamChargeConfirmedNot {
		t.Fatalf("expected ConfirmedNot, got %v", got)
	}
}

func TestClassifyUpstreamChargeConfidence_gateway504(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		fmt.Errorf("upstream timeout"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusGatewayTimeout,
	)
	got := ClassifyUpstreamChargeConfidence(err)
	if got != UpstreamChargeAmbiguous {
		t.Fatalf("expected Ambiguous, got %v", got)
	}
}

func TestClassifyUpstreamChargeConfidence_imageTimeout(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		fmt.Errorf("image_generation_timeout"),
		types.ErrorCodeImageGenerationTimeout,
		http.StatusRequestTimeout,
	)
	got := ClassifyUpstreamChargeConfidence(err)
	if got != UpstreamChargeAmbiguous {
		t.Fatalf("expected Ambiguous, got %v", got)
	}
}

func TestClassifyUpstreamChargeConfidence_convertRequestFailed(t *testing.T) {
	err := types.NewError(fmt.Errorf("convert failed"), types.ErrorCodeConvertRequestFailed)
	got := ClassifyUpstreamChargeConfidence(err)
	if got != UpstreamChargeConfirmedNot {
		t.Fatalf("expected ConfirmedNot, got %v", got)
	}
}

func TestClassifyUpstreamChargeConfidence_getChannelFailed(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		fmt.Errorf("no enabled channel for cheapest routing"),
		types.ErrorCodeGetChannelFailed,
		http.StatusInternalServerError,
	)
	got := ClassifyUpstreamChargeConfidence(err)
	if got != UpstreamChargeConfirmedNot {
		t.Fatalf("expected ConfirmedNot, got %v", got)
	}
}

func TestClassifyUpstreamChargeConfidence_moderationBlocked502(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		fmt.Errorf("Your request was rejected by the safety system"),
		types.ErrorCode("moderation_blocked"),
		http.StatusBadGateway,
	)
	got := ClassifyUpstreamChargeConfidence(err)
	if got != UpstreamChargeConfirmedNot {
		t.Fatalf("expected ConfirmedNot, got %v", got)
	}
}
