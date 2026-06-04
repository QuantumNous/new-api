package constant

type EndpointType string

const (
	EndpointTypeOpenAI                EndpointType = "openai"
	EndpointTypeOpenAIResponse        EndpointType = "openai-response"
	EndpointTypeOpenAIResponseCompact EndpointType = "openai-response-compact"
	EndpointTypeAnthropic             EndpointType = "anthropic"
	EndpointTypeGemini                EndpointType = "gemini"
	EndpointTypeJinaRerank            EndpointType = "jina-rerank"
	EndpointTypeImageGeneration       EndpointType = "image-generation"
	EndpointTypeEmbeddings            EndpointType = "embeddings"
	EndpointTypeOpenAIVideo           EndpointType = "openai-video"
	//EndpointTypeMidjourney     EndpointType = "midjourney-proxy"
	//EndpointTypeSuno           EndpointType = "suno-proxy"
	//EndpointTypeKling          EndpointType = "kling"
	//EndpointTypeJimeng         EndpointType = "jimeng"
)

var AllEndpointTypes = []EndpointType{
	EndpointTypeOpenAI,
	EndpointTypeOpenAIResponse,
	EndpointTypeOpenAIResponseCompact,
	EndpointTypeAnthropic,
	EndpointTypeGemini,
	EndpointTypeJinaRerank,
}

func NormalizeEndpointType(endpointType string) EndpointType {
	switch endpointType {
	case string(EndpointTypeImageGeneration), string(EndpointTypeEmbeddings), string(EndpointTypeOpenAIVideo):
		return EndpointTypeOpenAI
	default:
		return EndpointType(endpointType)
	}
}

func IsValidEndpointType(endpointType EndpointType) bool {
	for _, validEndpointType := range AllEndpointTypes {
		if validEndpointType == endpointType {
			return true
		}
	}
	return false
}
