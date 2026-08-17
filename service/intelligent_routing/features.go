package intelligent_routing

import (
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
)

type TaskType = routingsetting.TaskType

const (
	TaskTranslation = routingsetting.TaskTranslation
	TaskSummary     = routingsetting.TaskSummary
	TaskGeneral     = routingsetting.TaskGeneral
	TaskExtraction  = routingsetting.TaskExtraction
	TaskCode        = routingsetting.TaskCode
	TaskReasoning   = routingsetting.TaskReasoning
	TaskJSON        = routingsetting.TaskJSON
	TaskTool        = routingsetting.TaskTool
)

type Capability string

const (
	CapabilityTools      Capability = "tools"
	CapabilityJSONSchema Capability = "json_schema"
	CapabilityVision     Capability = "vision"
	CapabilityAudio      Capability = "audio"
)

type Input struct {
	Request      dto.Request
	RelayFormat  types.RelayFormat
	PromptTokens int
	RequestPath  string
}

type Features struct {
	Task               TaskType
	PromptTokens       int
	MaxOutputTokens    int
	HasTools           bool
	RequiresJSONSchema bool
	HasImage           bool
	HasAudio           bool
	IsStream           bool
	MinimumTier        int
}

type Requirements struct {
	Capabilities  map[Capability]bool
	MinimumTier   int
	ContextNeeded int
}

func ExtractFeatures(input Input) Features {
	features := Features{Task: TaskGeneral, PromptTokens: input.PromptTokens, MinimumTier: 1}
	var text string
	switch request := input.Request.(type) {
	case *dto.GeneralOpenAIRequest:
		features.HasTools = len(request.Tools) > 0 || len(request.Functions) > 0
		features.RequiresJSONSchema = request.ResponseFormat != nil && request.ResponseFormat.Type == "json_schema"
		features.IsStream = request.Stream != nil && *request.Stream
		features.MaxOutputTokens = int(request.GetMaxTokens())
		for _, message := range request.Messages {
			switch content := message.Content.(type) {
			case string:
				text += " " + content
			case []dto.MediaContent:
				for _, item := range content {
					text += " " + item.Text
					features.HasImage = features.HasImage || item.ImageUrl != nil
					features.HasAudio = features.HasAudio || item.InputAudio != nil
				}
			}
		}
		if request.ReasoningEffort != "" {
			features.Task, features.MinimumTier = TaskReasoning, 2
		}
	case *dto.OpenAIResponsesRequest:
		features.HasTools = len(request.Tools) > 0
		features.RequiresJSONSchema = strings.Contains(string(request.Text), "json_schema")
		features.IsStream = request.Stream != nil && *request.Stream
		if request.MaxOutputTokens != nil {
			features.MaxOutputTokens = int(*request.MaxOutputTokens)
		}
		text = string(request.Input) + " " + string(request.Instructions)
	case *dto.ClaudeRequest:
		features.HasTools = request.Tools != nil
		features.RequiresJSONSchema = len(request.OutputFormat) > 0
		features.IsStream = request.Stream != nil && *request.Stream
		if request.MaxTokens != nil {
			features.MaxOutputTokens = int(*request.MaxTokens)
		}
		text = request.Prompt
	}
	if features.HasTools {
		features.Task, features.MinimumTier = TaskTool, 2
	} else if features.RequiresJSONSchema {
		features.Task, features.MinimumTier = TaskJSON, 2
	} else if features.Task == TaskGeneral {
		features.Task, features.MinimumTier = classifyText(text)
	}
	return features
}

func DeriveRequirements(features Features) Requirements {
	requirements := Requirements{
		Capabilities:  make(map[Capability]bool),
		MinimumTier:   features.MinimumTier,
		ContextNeeded: features.PromptTokens + features.MaxOutputTokens,
	}
	if features.HasTools {
		requirements.Capabilities[CapabilityTools] = true
	}
	if features.RequiresJSONSchema {
		requirements.Capabilities[CapabilityJSONSchema] = true
	}
	if features.HasImage {
		requirements.Capabilities[CapabilityVision] = true
	}
	if features.HasAudio {
		requirements.Capabilities[CapabilityAudio] = true
	}
	return requirements
}

func ConversationSeed(request dto.Request) string {
	switch value := request.(type) {
	case *dto.GeneralOpenAIRequest:
		for _, message := range value.Messages {
			if message.Role != "user" {
				continue
			}
			switch content := message.Content.(type) {
			case string:
				return strings.TrimSpace(content)
			case []dto.MediaContent:
				for _, item := range content {
					if text := strings.TrimSpace(item.Text); text != "" {
						return text
					}
				}
			}
		}
	case *dto.OpenAIResponsesRequest:
		return strings.TrimSpace(string(value.Input))
	}
	return ""
}

func classifyText(text string) (TaskType, int) {
	lower := strings.ToLower(text)
	checks := []struct {
		words []string
		task  TaskType
		tier  int
	}{
		{[]string{"translate", "翻译"}, TaskTranslation, 0},
		{[]string{"summarize", "summary", "总结", "摘要"}, TaskSummary, 1},
		{[]string{"extract", "提取", "分类"}, TaskExtraction, 0},
		{[]string{"write a go", "write code", "代码", "function", "debug"}, TaskCode, 2},
		{[]string{"prove", "推理", "数学", "calculate"}, TaskReasoning, 2},
	}
	for _, check := range checks {
		for _, word := range check.words {
			if strings.Contains(lower, word) {
				return check.task, check.tier
			}
		}
	}
	return TaskGeneral, 1
}
