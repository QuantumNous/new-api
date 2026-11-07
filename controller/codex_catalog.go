package controller

import (
	"net/http"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

const codexCatalogInstructions = "You are Codex, a coding agent. You and the user share the same workspace. Inspect the repository before changing it, use the available tools, make focused changes, and verify the result. Ask the user only when a decision materially affects the outcome."

type codexCatalogResponse struct {
	Models []codexCatalogModel `json:"models"`
}

type codexCatalogModel struct {
	Slug                        string                 `json:"slug"`
	DisplayName                 string                 `json:"display_name"`
	Description                 string                 `json:"description"`
	DefaultReasoningLevel       *string                `json:"default_reasoning_level,omitempty"`
	SupportedReasoningLevels    []codexReasoningPreset `json:"supported_reasoning_levels"`
	ShellType                   string                 `json:"shell_type"`
	Visibility                  string                 `json:"visibility"`
	SupportedInAPI              bool                   `json:"supported_in_api"`
	Priority                    int                    `json:"priority"`
	SupportVerbosity            bool                   `json:"support_verbosity"`
	ApplyPatchToolType          *string                `json:"apply_patch_tool_type,omitempty"`
	WebSearchToolType           string                 `json:"web_search_tool_type"`
	TruncationPolicy            codexTruncationPolicy  `json:"truncation_policy"`
	ExperimentalSupportedTools  []string               `json:"experimental_supported_tools"`
	InputModalities             []string               `json:"input_modalities"`
	BaseInstructions            string                 `json:"base_instructions"`
	SupportsReasoningSummary    bool                   `json:"supports_reasoning_summary_parameter"`
	IncludeAppsInstructions     bool                   `json:"include_apps_usage_instructions"`
	SupportsImageDetailOriginal bool                   `json:"supports_image_detail_original"`
}

type codexReasoningPreset struct {
	Effort      string `json:"effort"`
	Description string `json:"description"`
}

type codexTruncationPolicy struct {
	Mode  string `json:"mode"`
	Limit int    `json:"limit"`
}

func CodexListModels(c *gin.Context) {
	modelNames, _, err := getListedModelNames(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "failed to list models",
				"type":    "server_error",
			},
		})
		return
	}

	models := make([]codexCatalogModel, 0, len(modelNames))
	for i, modelName := range modelNames {
		if !isCodexCatalogModel(modelName) {
			continue
		}
		models = append(models, buildCodexCatalogModel(modelName, i))
	}

	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, codexCatalogResponse{Models: models})
}

func buildCodexCatalogModel(modelName string, priority int) codexCatalogModel {
	reasoningLevels := []codexReasoningPreset{}
	var defaultReasoning *string
	if codexModelSupportsReasoning(modelName) {
		reasoningLevels = []codexReasoningPreset{
			{Effort: "low", Description: "Fast responses with lighter reasoning"},
			{Effort: "medium", Description: "Balanced speed and reasoning depth"},
			{Effort: "high", Description: "Greater reasoning depth for complex tasks"},
		}
		defaultReasoning = new(string)
		*defaultReasoning = "medium"
	}

	applyPatchToolType := "freeform"
	return codexCatalogModel{
		Slug:                        modelName,
		DisplayName:                 modelName,
		Description:                 "Available through NekoAI",
		DefaultReasoningLevel:       defaultReasoning,
		SupportedReasoningLevels:    reasoningLevels,
		ShellType:                   "shell_command",
		Visibility:                  "list",
		SupportedInAPI:              true,
		Priority:                    priority,
		SupportVerbosity:            false,
		ApplyPatchToolType:          &applyPatchToolType,
		WebSearchToolType:           "text",
		TruncationPolicy:            codexTruncationPolicy{Mode: "tokens", Limit: 10000},
		ExperimentalSupportedTools:  []string{},
		InputModalities:             []string{"text", "image"},
		BaseInstructions:            codexCatalogInstructions,
		SupportsReasoningSummary:    false,
		IncludeAppsInstructions:     false,
		SupportsImageDetailOriginal: false,
	}
}

func isCodexCatalogModel(modelName string) bool {
	endpoints := model.GetModelSupportEndpointTypes(modelName)
	if slices.Contains(endpoints, constant.EndpointTypeImageGeneration) ||
		slices.Contains(endpoints, constant.EndpointTypeEmbeddings) ||
		slices.Contains(endpoints, constant.EndpointTypeOpenAIVideo) {
		return false
	}

	name := strings.ToLower(modelName)
	for _, marker := range []string{
		"embedding",
		"image",
		"tts",
		"asr",
		"whisper",
		"transcri",
		"speech",
		"video",
		"rerank",
		"moderation",
	} {
		if strings.Contains(name, marker) {
			return false
		}
	}
	return true
}

func codexModelSupportsReasoning(modelName string) bool {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if dto.IsOpenAIReasoningOModel(name) || dto.IsOpenAIGPT5Model(name) {
		return true
	}
	for _, marker := range []string{
		"gpt-6",
		"deepseek",
		"claude-3-7",
		"claude-4",
		"gemini-2.5",
		"gemini-3",
		"qwen3",
		"qwq",
		"grok-4",
		"thinking",
		"reasoner",
		"reasoning",
	} {
		if strings.Contains(name, marker) {
			return true
		}
	}
	return false
}
