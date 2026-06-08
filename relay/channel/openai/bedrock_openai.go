package openai

// BedrockOpenAIModelList is the built-in model list for the "Bedrock OpenAI"
// channel type. These are OpenAI frontier models hosted on Amazon Bedrock via
// the bedrock-mantle endpoint. Model IDs use the "openai." prefix as required
// by Bedrock (e.g. openai.gpt-5.5, openai.gpt-5.4).
//
// Note: GPT-5.5 on Bedrock only supports the Responses API (not Chat
// Completions), while GPT-5.4 supports both. New API automatically converts
// chat/completions requests to the Responses API for this channel type
// (see service/openaicompat/policy.go).
var BedrockOpenAIModelList = []string{
	"openai.gpt-5.5",
	"openai.gpt-5.4",
}

// BedrockOpenAIChannelName is the owner/channel name reported for models served
// by the Bedrock OpenAI channel type.
const BedrockOpenAIChannelName = "bedrock-openai"
