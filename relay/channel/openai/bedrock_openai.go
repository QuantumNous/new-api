package openai

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsv4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/gin-gonic/gin"
)

const BedrockOpenAIChannelName = "AWS OpenAI"

type bedrockOpenAICredentials struct {
	keyType         dto.AwsKeyType
	accessKeyID     string
	secretAccessKey string
	apiKey          string
	region          string
}

var BedrockOpenAIModelList = func() []string {
	models := make([]string, 0, len(common.BedrockOpenAIResponsesModels)+len(common.BedrockOpenAIMantleChatModels)+len(common.BedrockOpenAIChatOnlyModels)+len(common.BedrockOpenAIRuntimeChatModels))
	models = append(models, common.BedrockOpenAIResponsesModels...)
	models = append(models, common.BedrockOpenAIMantleChatModels...)
	models = append(models, common.BedrockOpenAIChatOnlyModels...)
	models = append(models, common.BedrockOpenAIRuntimeChatModels...)
	return models
}()

func parseBedrockOpenAICredentials(info *relaycommon.RelayInfo) (bedrockOpenAICredentials, error) {
	if info == nil {
		return bedrockOpenAICredentials{}, fmt.Errorf("AWS OpenAI relay info is missing")
	}

	keyType := info.ChannelOtherSettings.AwsKeyType
	if keyType == "" {
		keyType = dto.AwsKeyTypeAKSK
	}
	parts := strings.Split(info.ApiKey, "|")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}

	credentials := bedrockOpenAICredentials{keyType: keyType}
	switch keyType {
	case dto.AwsKeyTypeAKSK:
		if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
			return bedrockOpenAICredentials{}, fmt.Errorf("invalid AWS OpenAI credentials: expected AccessKey|SecretAccessKey|Region")
		}
		credentials.accessKeyID = parts[0]
		credentials.secretAccessKey = parts[1]
		credentials.region = parts[2]
	case dto.AwsKeyTypeApiKey:
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return bedrockOpenAICredentials{}, fmt.Errorf("invalid AWS OpenAI API key: expected APIKey|Region")
		}
		credentials.apiKey = parts[0]
		credentials.region = parts[1]
	default:
		return bedrockOpenAICredentials{}, fmt.Errorf("unsupported AWS OpenAI key type: %s", keyType)
	}

	if !isValidBedrockOpenAIRegion(credentials.region) {
		return bedrockOpenAICredentials{}, fmt.Errorf("invalid AWS region: %s", credentials.region)
	}
	return credentials, nil
}

func isValidBedrockOpenAIRegion(region string) bool {
	if len(region) < 3 || len(region) > 64 || strings.HasPrefix(region, "-") || strings.HasSuffix(region, "-") {
		return false
	}
	parts := strings.Split(region, "-")
	if len(parts) < 3 {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
		for _, char := range part {
			if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
				return false
			}
		}
	}
	for _, char := range parts[len(parts)-1] {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func isBedrockOpenAIMantleEndpoint(hostname string) bool {
	hostname = strings.ToLower(hostname)
	return strings.HasPrefix(hostname, "bedrock-mantle.") && strings.HasSuffix(hostname, ".api.aws")
}

func isBedrockOpenAIRuntimeEndpoint(hostname string) bool {
	hostname = strings.ToLower(hostname)
	return strings.HasPrefix(hostname, "bedrock-runtime.") &&
		(strings.HasSuffix(hostname, ".amazonaws.com") || strings.HasSuffix(hostname, ".amazonaws.com.cn"))
}

func defaultBedrockOpenAIBaseURL(region, modelName string) string {
	if common.IsBedrockOpenAIRuntimeChatModel(modelName) {
		return fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com", region)
	}
	return fmt.Sprintf("https://bedrock-mantle.%s.api.aws", region)
}

func getBedrockOpenAIRequestURL(info *relaycommon.RelayInfo) (string, error) {
	credentials, err := parseBedrockOpenAICredentials(info)
	if err != nil {
		return "", err
	}

	baseURL := strings.TrimRight(info.ChannelBaseUrl, "/")
	if baseURL == "" {
		baseURL = defaultBedrockOpenAIBaseURL(credentials.region, info.UpstreamModelName)
	}
	parsedBaseURL, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid AWS OpenAI base URL: %w", err)
	}
	if parsedBaseURL.Host == "" || (parsedBaseURL.Scheme != "http" && parsedBaseURL.Scheme != "https") {
		return "", fmt.Errorf("invalid AWS OpenAI base URL: %s", baseURL)
	}

	hostname := strings.ToLower(parsedBaseURL.Hostname())
	isMantleEndpoint := isBedrockOpenAIMantleEndpoint(hostname)
	isRuntimeEndpoint := isBedrockOpenAIRuntimeEndpoint(hostname)

	if isRuntimeEndpoint && (info.RelayMode == relayconstant.RelayModeResponses || info.RelayMode == relayconstant.RelayModeResponsesCompact) {
		return "", fmt.Errorf("AWS Bedrock Runtime does not support the Responses API; use a bedrock-mantle base URL")
	}
	if isRuntimeEndpoint && common.IsBedrockOpenAIResponsesModel(info.UpstreamModelName) {
		return "", fmt.Errorf("model %s is only available through the AWS Bedrock Mantle Responses API", info.UpstreamModelName)
	}

	if isMantleEndpoint {
		// Accept both New API-style host URLs and the /v1 base URLs shown in
		// AWS SDK examples.
		baseURL = strings.TrimSuffix(baseURL, "/v1")
		// GPT-5.4 and later frontier models use /openai/v1/responses, while
		// gpt-oss models use the standard /v1 Chat Completions/Responses paths.
		baseURL = strings.TrimSuffix(baseURL, "/openai")
		if common.IsBedrockOpenAIResponsesModel(info.UpstreamModelName) {
			baseURL += "/openai"
		}
	} else if isRuntimeEndpoint {
		baseURL = strings.TrimSuffix(baseURL, "/v1")
	}

	return relaycommon.GetFullRequestURL(baseURL, info.RequestURLPath, info.ChannelType), nil
}

func getBedrockOpenAISigningService(req *http.Request, info *relaycommon.RelayInfo) string {
	if req != nil && req.URL != nil {
		if isBedrockOpenAIRuntimeEndpoint(req.URL.Hostname()) {
			return "bedrock"
		}
		if isBedrockOpenAIMantleEndpoint(req.URL.Hostname()) {
			return "bedrock-mantle"
		}
	}
	if info != nil && common.IsBedrockOpenAIRuntimeChatModel(info.UpstreamModelName) {
		return "bedrock"
	}
	return "bedrock-mantle"
}

func hashAndRestoreBedrockOpenAIRequestBody(req *http.Request) (string, error) {
	body := []byte{}
	if req.Body != nil {
		var err error
		body, err = io.ReadAll(req.Body)
		if err != nil {
			return "", fmt.Errorf("read AWS OpenAI request body: %w", err)
		}
		_ = req.Body.Close()
		req.Body = io.NopCloser(bytes.NewReader(body))
		req.GetBody = func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(body)), nil
		}
		req.ContentLength = int64(len(body))
	}
	payloadHash := sha256.Sum256(body)
	return hex.EncodeToString(payloadHash[:]), nil
}

func (a *Adaptor) SignRequest(_ *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	if info == nil || info.ChannelType != constant.ChannelTypeAwsOpenAI {
		return nil
	}
	if req == nil {
		return fmt.Errorf("AWS OpenAI request is missing")
	}
	credentials, err := parseBedrockOpenAICredentials(info)
	if err != nil {
		return err
	}
	if credentials.keyType == dto.AwsKeyTypeApiKey {
		return nil
	}
	payloadHash, err := hashAndRestoreBedrockOpenAIRequestBody(req)
	if err != nil {
		return err
	}
	return awsv4.NewSigner().SignHTTP(
		req.Context(),
		aws.Credentials{
			AccessKeyID:     credentials.accessKeyID,
			SecretAccessKey: credentials.secretAccessKey,
		},
		req,
		payloadHash,
		getBedrockOpenAISigningService(req, info),
		credentials.region,
		time.Now().UTC(),
	)
}
