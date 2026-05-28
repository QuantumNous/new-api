package helper

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func TestModelMappedHelperResponsesCompactUsesBaseModelWhenConfigured(t *testing.T) {
	setCompactUseBaseModelForTest(t, "true")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5",
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5.5"}

	if err := ModelMappedHelper(ctx, info, request); err != nil {
		t.Fatalf("ModelMappedHelper returned error: %v", err)
	}

	if info.OriginModelName != "gpt-5.5" {
		t.Fatalf("expected origin model to remain base model, got %q", info.OriginModelName)
	}
	if info.UpstreamModelName != "gpt-5.5" {
		t.Fatalf("expected upstream model to be base model, got %q", info.UpstreamModelName)
	}
	if request.Model != "gpt-5.5" {
		t.Fatalf("expected request model to be base model, got %q", request.Model)
	}
}

func TestModelMappedHelperResponsesCompactNormalizesSuffixedModelWhenConfigured(t *testing.T) {
	setCompactUseBaseModelForTest(t, "true")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5-openai-compact",
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5.5-openai-compact"}

	if err := ModelMappedHelper(ctx, info, request); err != nil {
		t.Fatalf("ModelMappedHelper returned error: %v", err)
	}

	if info.OriginModelName != "gpt-5.5" {
		t.Fatalf("expected origin model to normalize to base model, got %q", info.OriginModelName)
	}
	if info.UpstreamModelName != "gpt-5.5" {
		t.Fatalf("expected upstream model to normalize to base model, got %q", info.UpstreamModelName)
	}
	if request.Model != "gpt-5.5" {
		t.Fatalf("expected request model to normalize to base model, got %q", request.Model)
	}
}

func TestModelMappedHelperResponsesCompactKeepsSuffixedModelByDefault(t *testing.T) {
	setCompactUseBaseModelForTest(t, "")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5",
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5.5"}

	if err := ModelMappedHelper(ctx, info, request); err != nil {
		t.Fatalf("ModelMappedHelper returned error: %v", err)
	}

	if info.OriginModelName != "gpt-5.5-openai-compact" {
		t.Fatalf("expected origin model to use compact suffix, got %q", info.OriginModelName)
	}
	if info.UpstreamModelName != "gpt-5.5" {
		t.Fatalf("expected upstream model to remain base model, got %q", info.UpstreamModelName)
	}
	if request.Model != "gpt-5.5" {
		t.Fatalf("expected request model to remain base model, got %q", request.Model)
	}
}

func TestModelMappedHelperResponsesCompactMappedModelUsesBaseWhenConfigured(t *testing.T) {
	setCompactUseBaseModelForTest(t, "true")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("model_mapping", `{"gpt-5.5":"gpt-5.5-upstream"}`)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5",
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5.5"}

	if err := ModelMappedHelper(ctx, info, request); err != nil {
		t.Fatalf("ModelMappedHelper returned error: %v", err)
	}

	if info.OriginModelName != "gpt-5.5-upstream" {
		t.Fatalf("expected origin model to use mapped upstream model, got %q", info.OriginModelName)
	}
	if info.UpstreamModelName != "gpt-5.5-upstream" {
		t.Fatalf("expected upstream model to use mapped upstream model, got %q", info.UpstreamModelName)
	}
	if request.Model != "gpt-5.5-upstream" {
		t.Fatalf("expected request model to use mapped upstream model, got %q", request.Model)
	}
}

func TestModelMappedHelperResponsesCompactMappedModelKeepsSuffixByDefault(t *testing.T) {
	setCompactUseBaseModelForTest(t, "")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("model_mapping", `{"gpt-5.5":"gpt-5.5-upstream"}`)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5",
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5.5"}

	if err := ModelMappedHelper(ctx, info, request); err != nil {
		t.Fatalf("ModelMappedHelper returned error: %v", err)
	}

	if info.OriginModelName != "gpt-5.5-upstream-openai-compact" {
		t.Fatalf("expected origin model to use mapped compact suffix, got %q", info.OriginModelName)
	}
	if info.UpstreamModelName != "gpt-5.5-upstream" {
		t.Fatalf("expected upstream model to use mapped upstream model, got %q", info.UpstreamModelName)
	}
	if request.Model != "gpt-5.5-upstream" {
		t.Fatalf("expected request model to use mapped upstream model, got %q", request.Model)
	}
}

func setCompactUseBaseModelForTest(t *testing.T, value string) {
	t.Helper()
	oldValue, hadValue := os.LookupEnv("COMPACT_USE_BASE_MODEL")
	if value == "" {
		if err := os.Unsetenv("COMPACT_USE_BASE_MODEL"); err != nil {
			t.Fatalf("unset COMPACT_USE_BASE_MODEL: %v", err)
		}
	} else if err := os.Setenv("COMPACT_USE_BASE_MODEL", value); err != nil {
		t.Fatalf("set COMPACT_USE_BASE_MODEL: %v", err)
	}
	t.Cleanup(func() {
		if hadValue {
			if err := os.Setenv("COMPACT_USE_BASE_MODEL", oldValue); err != nil {
				t.Fatalf("restore COMPACT_USE_BASE_MODEL: %v", err)
			}
		} else if err := os.Unsetenv("COMPACT_USE_BASE_MODEL"); err != nil {
			t.Fatalf("restore COMPACT_USE_BASE_MODEL: %v", err)
		}
	})
}
