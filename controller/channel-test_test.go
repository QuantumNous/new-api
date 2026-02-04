package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestBuildTestRequest_CodexChannelUsesResponses(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeCodex}
	req := buildTestRequest("gpt-5.2", "", ch)
	if _, ok := req.(*dto.OpenAIResponsesRequest); !ok {
		t.Fatalf("expected OpenAIResponsesRequest, got %T", req)
	}
}

func TestBuildTestRequest_CodexChannelCompactSuffixUsesCompaction(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeCodex}
	modelName := ratio_setting.WithCompactModelSuffix("gpt-5.2")
	req := buildTestRequest(modelName, "", ch)
	if _, ok := req.(*dto.OpenAIResponsesCompactionRequest); !ok {
		t.Fatalf("expected OpenAIResponsesCompactionRequest, got %T", req)
	}
}

func TestBuildTestRequest_OpenAIChannelDefaultsToChat(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeOpenAI}
	req := buildTestRequest("gpt-5.2", "", ch)
	if _, ok := req.(*dto.GeneralOpenAIRequest); !ok {
		t.Fatalf("expected GeneralOpenAIRequest, got %T", req)
	}
}
