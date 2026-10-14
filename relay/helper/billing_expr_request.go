package helper

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"math"
	"mime"
	"mime/multipart"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

func ResolveIncomingBillingExprRequestInput(c *gin.Context, info *relaycommon.RelayInfo) (billingexpr.RequestInput, error) {
	if info != nil && info.BillingRequestInput != nil {
		input := cloneRequestInput(*info.BillingRequestInput)
		merged := cloneStringMap(info.RequestHeaders)
		maps.Copy(merged, input.Headers)
		input.Headers = merged
		return input, nil
	}

	input := billingexpr.RequestInput{}
	if info != nil {
		input.Headers = cloneStringMap(info.RequestHeaders)
	}

	bodyBytes, err := readIncomingBillingExprBody(c)
	if err != nil {
		return billingexpr.RequestInput{}, err
	}
	input.Body = bodyBytes
	if info != nil {
		return ResolveImageBillingRequestInput(c, info, input)
	}
	return input, nil
}

const seedreamLowerTierMaxPixels = 2_610_000

const (
	maxImageBillingScalarBytes = 128
	maxImageDimension          = 65_535
	maxImageBillingInteger     = 1_000_000
	maxExactJSONInteger        = 9_007_199_254_740_991
	maxImageBillingNumber      = 1_000_000
)

var (
	seedreamImageSizePattern        = regexp.MustCompile(`^([0-9]+)\s*[xX*]\s*([0-9]+)$`)
	imageBillingSizePattern         = regexp.MustCompile(`^([0-9]+)[xX*]([0-9]+)$`)
	imageBillingAspectRatioPattern  = regexp.MustCompile(`^([0-9]+):([0-9]+)$`)
	imageBillingScalarPattern       = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:+*-]{0,127}$`)
	imageBillingIdentifierPattern   = regexp.MustCompile(`^[a-z][a-z0-9_.+-]{0,31}$`)
	imageBillingHostnamePattern     = regexp.MustCompile(`(?i)^(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z]{2,63}(?::[0-9]{1,5})?$`)
	imageBillingSchemePattern       = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.-]*:`)
	indexedImageFieldPattern        = regexp.MustCompile(`^image\[(0|[1-9][0-9]*)\]$`)
	imageBillingSizeValues          = []string{"auto", "1K", "1.5K", "2K", "3K", "4K"}
	openAIImageQualityValues        = []string{"auto", "high", "medium", "low", "hd", "standard"}
	openAIImageResponseFormatValues = []string{"url", "b64_json"}
	geminiImageSizeValues           = []string{"1K", "2K"}
	replicateAspectRatioValues      = []string{"1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3", "custom"}
	miniMaxAspectRatioValues        = []string{"1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"}
	miniMaxResponseFormatValues     = []string{"url", "base64"}
)

type seedreamRequestProfile struct {
	maxOutputs         int
	maxReferenceImages int
	layerDecomposition bool
}

// OutboundImageBilling contains only the final price-bearing image fields.
// Request keeps the client model as billing identity; Input is safe to retain
// because prompts, image bytes, and image URLs are excluded.
type OutboundImageBilling struct {
	Request     *dto.ImageRequest
	PromptTexts []string
	Input       billingexpr.RequestInput
	Count       int
}

func seedreamProfile(model string) (seedreamRequestProfile, bool) {
	switch strings.TrimSpace(model) {
	case "doubao-seedream-5-0-pro", "doubao-seedream-5-0-pro-260628":
		return seedreamRequestProfile{maxOutputs: 15, maxReferenceImages: 10, layerDecomposition: true}, true
	case "doubao-seedream-5-0", "doubao-seedream-5-0-260128",
		"doubao-seedream-4-5", "doubao-seedream-4-5-251128",
		"doubao-seedream-4-0", "doubao-seedream-4-0-20260415",
		"doubao-seedream-4-0-250828":
		return seedreamRequestProfile{maxOutputs: 15, maxReferenceImages: 14}, true
	default:
		return seedreamRequestProfile{}, false
	}
}

func seedreamReferenceImageCount(raw []byte) (int, error) {
	value := strings.TrimSpace(string(raw))
	if value == "" || value == "null" {
		return 0, nil
	}
	var single string
	if err := common.Unmarshal(raw, &single); err == nil {
		if strings.TrimSpace(single) == "" {
			return 0, fmt.Errorf("image must not be empty")
		}
		return 1, nil
	}
	var multiple []string
	if err := common.Unmarshal(raw, &multiple); err != nil {
		return 0, fmt.Errorf("image must be a string or string array")
	}
	for _, image := range multiple {
		if strings.TrimSpace(image) == "" {
			return 0, fmt.Errorf("image entries must not be empty")
		}
	}
	return len(multiple), nil
}

func seedreamSizeIsLowerTier(size string) bool {
	switch strings.ToUpper(strings.TrimSpace(size)) {
	case "1K", "1.5K":
		return true
	case "", "2K", "3K", "4K", "AUTO":
		return false
	}
	match := seedreamImageSizePattern.FindStringSubmatch(strings.TrimSpace(size))
	if len(match) != 3 {
		return false
	}
	width, widthErr := strconv.ParseUint(match[1], 10, 32)
	height, heightErr := strconv.ParseUint(match[2], 10, 32)
	if widthErr != nil || heightErr != nil || width == 0 || height == 0 {
		return false
	}
	return width <= seedreamLowerTierMaxPixels/height
}

// ResolveImageBillingRequestInput freezes only the validated scalar image
// parameters needed by pricing. Image files, prompts and base64 payloads are
// deliberately excluded, including for multipart edits.
func ResolveImageBillingRequestInput(c *gin.Context, info *relaycommon.RelayInfo, input billingexpr.RequestInput) (billingexpr.RequestInput, error) {
	if info == nil {
		return input, nil
	}
	request, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return input, nil
	}
	count, err := request.ImageCount(false)
	if err != nil {
		return input, err
	}
	profile, seedream := seedreamProfile(request.Model)
	if seedream {
		if count > profile.maxOutputs {
			return input, fmt.Errorf("n must be an integer between 1 and %d", profile.maxOutputs)
		}
		referenceImages, referenceErr := seedreamReferenceImageCount(request.Image)
		if referenceErr != nil {
			return input, referenceErr
		}
		if referenceImages > profile.maxReferenceImages {
			return input, fmt.Errorf("at most %d reference images are supported", profile.maxReferenceImages)
		}
		layered := request.LayerDecomposition != nil && *request.LayerDecomposition
		if layered {
			if !profile.layerDecomposition {
				return input, fmt.Errorf("layer_decomposition is not supported by this model")
			}
			if referenceImages != 1 {
				return input, fmt.Errorf("layer decomposition requires exactly one input image")
			}
			count = billingexpr.MaxRequestImageOutputs
		}
		lower, higher := float64(0), float64(count)
		if seedreamSizeIsLowerTier(request.Size) {
			lower, higher = float64(count), 0
		}
		references := float64(referenceImages)
		input.Body = nil
		input.ImageCount = &count
		input.ImagesUpTo1_5K = &lower
		input.ImagesAbove1_5K = &higher
		input.InputImages = &references
		return input, nil
	}
	if input.ImageCount != nil && len(input.Body) > 0 {
		input.ImageCount = &count
		return input, nil
	}
	body := map[string]any{"model": request.Model, "n": count, "size": request.Size, "quality": request.Quality}
	if request.BillingParameters != nil {
		body["parameters"] = request.BillingParameters
	}
	encoded, err := common.Marshal(body)
	if err != nil {
		return input, err
	}
	input.Body = encoded
	input.ImageCount = &count
	return input, nil
}

// ResolveOutboundImageBillingJSON rebuilds the billing view from the exact
// JSON sent upstream while retaining the client model as billing identity.
func ResolveOutboundImageBillingJSON(info *relaycommon.RelayInfo, outboundJSON []byte, schemaConfirmed ...bool) (*OutboundImageBilling, error) {
	if info == nil {
		return nil, nil
	}
	incoming, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return nil, nil
	}
	if info.ChannelMeta == nil {
		return nil, fmt.Errorf("image billing API type is required")
	}
	confirmed := len(schemaConfirmed) > 0 && schemaConfirmed[0]
	var err error
	outboundJSON, err = MaterializeOutboundImageBillingDefaults(info, outboundJSON, confirmed)
	if err != nil {
		return nil, err
	}

	switch info.ApiType {
	case constant.APITypeGemini, constant.APITypeVertexAi:
		return resolveGeminiImageBilling(info, incoming, outboundJSON)
	case constant.APITypeReplicate:
		return resolveReplicateImageBilling(info, incoming, outboundJSON)
	case constant.APITypeSiliconFlow:
		return resolveSiliconFlowImageBilling(info, incoming, outboundJSON)
	case constant.APITypeMiniMax:
		return resolveMiniMaxImageBilling(info, incoming, outboundJSON)
	case constant.APITypeJimeng:
		return resolveJimengImageBilling(info, incoming, outboundJSON)
	case constant.APITypeXai:
		return resolveXAIImageBilling(info, incoming, outboundJSON)
	default:
		if isOpenAIImageBillingAPIType(info.ApiType, confirmed) {
			return resolveOpenAIImageBilling(info, incoming, outboundJSON)
		}
		return nil, fmt.Errorf("unsupported image billing schema for API type %d", info.ApiType)
	}
}

// MaterializeOutboundImageBillingDefaults writes provider count defaults only
// for payloads that are known to have been produced by the matching adaptor.
func MaterializeOutboundImageBillingDefaults(info *relaycommon.RelayInfo, outboundJSON []byte, schemaConfirmed bool) ([]byte, error) {
	if info == nil || info.ChannelMeta == nil || !schemaConfirmed {
		return outboundJSON, nil
	}

	switch info.ApiType {
	case constant.APITypeReplicate, constant.APITypeSiliconFlow:
	default:
		return outboundJSON, nil
	}
	object, err := imageBillingObject(outboundJSON, "image request")
	if err != nil {
		return nil, err
	}
	switch info.ApiType {
	case constant.APITypeReplicate:
		inputRaw, exists := object["input"]
		if !exists || isJSONNull(inputRaw) {
			return outboundJSON, nil
		}
		input, inputErr := imageBillingObject(inputRaw, "input")
		if inputErr != nil {
			return nil, inputErr
		}
		if _, exists = input["num_outputs"]; exists {
			return outboundJSON, nil
		}
		input["num_outputs"] = json.RawMessage("1")
		encodedInput, marshalErr := common.Marshal(input)
		if marshalErr != nil {
			return nil, marshalErr
		}
		object["input"] = encodedInput
	case constant.APITypeSiliconFlow:
		if _, exists := object["batch_size"]; exists {
			return outboundJSON, nil
		}
		object["batch_size"] = json.RawMessage("1")
	}
	return common.Marshal(object)
}

func isOpenAIImageBillingAPIType(apiType int, schemaConfirmed bool) bool {
	switch apiType {
	case constant.APITypeOpenAI,
		constant.APITypeZhipuV4,
		constant.APITypeVolcEngine,
		constant.APITypeOpenRouter,
		constant.APITypeXinference,
		constant.APITypeMoonshot,
		constant.APITypeSub2API,
		constant.APITypeNewAPI:
		return true
	case constant.APITypeAdvancedCustom, constant.APITypeTencent:
		return schemaConfirmed
	default:
		return false
	}
}

func resolveOpenAIImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "OpenAI image request")
	if err != nil {
		return nil, err
	}
	prompt, err := optionalImageBillingString(object, "prompt", "prompt")
	if err != nil {
		return nil, err
	}
	count, err := imageBillingCount(object, "n", "n", true)
	if err != nil {
		return nil, err
	}
	body := canonicalImageBillingBody(incoming.Model, count)
	for _, key := range []string{
		"size", "quality", "response_format", "style", "background", "moderation",
		"output_format", "input_fidelity",
	} {
		if err = copyValidatedImageBillingString(body, object, key, key, validateOpenAIImageBillingString); err != nil {
			return nil, err
		}
	}
	if err = copyImageBillingIntegers(body, object, "", 0, maxImageBillingInteger, "output_compression"); err != nil {
		return nil, err
	}
	if err = copyImageBillingIntegers(body, object, "", 0, maxImageBillingInteger, "partial_images"); err != nil {
		return nil, err
	}
	if err = copyImageBillingBooleans(body, object, "",
		"stream", "watermark", "layer_decomposition", "watermark_enabled",
	); err != nil {
		return nil, err
	}
	copyCanonicalStringAlias(body, "size", "resolution")

	var parameters *dto.ImageBillingParameters
	if raw, exists := object["parameters"]; exists && !isJSONNull(raw) {
		if _, objectErr := imageBillingObject(raw, "parameters"); objectErr != nil {
			return nil, objectErr
		}
		safeParameters := map[string]any{}
		parameters = &dto.ImageBillingParameters{}
		if unmarshalErr := common.Unmarshal(raw, parameters); unmarshalErr != nil {
			return nil, fmt.Errorf("invalid image parameters: %w", unmarshalErr)
		}
		if parameters.N != nil && *parameters.N > dto.MaxImageN {
			return nil, fmt.Errorf("parameters.n must be an integer between 0 and %d", dto.MaxImageN)
		}
		if parameters.N != nil {
			safeParameters["n"] = *parameters.N
		}
		if parameters.PromptExtend != nil {
			safeParameters["prompt_extend"] = *parameters.PromptExtend
		}
		if len(safeParameters) > 0 {
			body["parameters"] = safeParameters
		}
	}

	size, err := optionalValidatedImageBillingString(
		object, "size", "size", validateOpenAIImageBillingString,
	)
	if err != nil {
		return nil, err
	}
	quality, err := optionalValidatedImageBillingString(
		object, "quality", "quality", validateOpenAIImageBillingString,
	)
	if err != nil {
		return nil, err
	}
	layerDecomposition, err := optionalImageBillingBool(object, "layer_decomposition", "layer_decomposition")
	if err != nil {
		return nil, err
	}
	referenceImages := 0
	if _, seedream := seedreamProfile(incoming.Model); seedream {
		referenceImages, err = seedreamReferenceImageCount(object["image"])
		if err != nil {
			return nil, err
		}
	}
	var promptTexts []string
	if prompt != "" {
		promptTexts = append(promptTexts, prompt)
	}
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model:              incoming.Model,
		N:                  common.GetPointer(uint(count)),
		Size:               size,
		Quality:            quality,
		LayerDecomposition: layerDecomposition,
		BillingParameters:  parameters,
	}, referenceImages, body, promptTexts)
}

func resolveGeminiImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "Gemini image request")
	if err != nil {
		return nil, err
	}
	var instances []json.RawMessage
	if raw, exists := object["instances"]; !exists || isJSONNull(raw) {
		return nil, fmt.Errorf("instances must contain exactly one item")
	} else if err = common.Unmarshal(raw, &instances); err != nil || len(instances) != 1 {
		return nil, fmt.Errorf("instances must contain exactly one item")
	}
	instance, err := imageBillingObject(instances[0], "instances[0]")
	if err != nil {
		return nil, err
	}
	prompt, err := requiredImageBillingString(instance, "prompt", "instances[0].prompt")
	if err != nil {
		return nil, err
	}
	parametersRaw, exists := object["parameters"]
	if !exists || isJSONNull(parametersRaw) {
		return nil, fmt.Errorf("parameters.sampleCount is required")
	}
	parameters, err := imageBillingObject(parametersRaw, "parameters")
	if err != nil {
		return nil, err
	}
	count, err := imageBillingCount(parameters, "sampleCount", "parameters.sampleCount", false)
	if err != nil {
		return nil, err
	}
	safeParameters := map[string]any{}
	safeParameters["sampleCount"] = count
	for key, validator := range map[string]imageBillingStringValidator{
		"aspectRatio":      validateImageBillingAspectRatio,
		"imageSize":        imageBillingEnumValidator(geminiImageSizeValues),
		"personGeneration": validateImageBillingString,
	} {
		if err = copyValidatedImageBillingString(safeParameters, parameters, key, "parameters."+key, validator); err != nil {
			return nil, err
		}
	}
	body := canonicalImageBillingBody(incoming.Model, count)
	body["parameters"] = safeParameters
	aspectRatio, err := optionalValidatedImageBillingString(
		parameters, "aspectRatio", "parameters.aspectRatio", validateImageBillingAspectRatio,
	)
	if err != nil {
		return nil, err
	}
	imageSize, err := optionalValidatedImageBillingString(
		parameters, "imageSize", "parameters.imageSize", imageBillingEnumValidator(geminiImageSizeValues),
	)
	if err != nil {
		return nil, err
	}
	setCanonicalString(body, "size", aspectRatio)
	setCanonicalString(body, "resolution", imageSize)
	setCanonicalString(body, "quality", imageSize)
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model: incoming.Model, N: common.GetPointer(uint(count)), Size: aspectRatio, Quality: imageSize,
	}, 0, body, []string{prompt})
}

func resolveReplicateImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "Replicate image request")
	if err != nil {
		return nil, err
	}
	inputRaw, exists := object["input"]
	if !exists || isJSONNull(inputRaw) {
		return nil, fmt.Errorf("input.prompt is required")
	}
	input, err := imageBillingObject(inputRaw, "input")
	if err != nil {
		return nil, err
	}
	prompt, err := requiredImageBillingString(input, "prompt", "input.prompt")
	if err != nil {
		return nil, err
	}
	promptTexts := []string{prompt}
	if negativePrompt, promptErr := optionalImageBillingString(input, "negative_prompt", "input.negative_prompt"); promptErr != nil {
		return nil, promptErr
	} else if negativePrompt != "" {
		promptTexts = append(promptTexts, negativePrompt)
	}
	count, err := imageBillingCount(input, "num_outputs", "input.num_outputs", false)
	if err != nil {
		return nil, err
	}
	safeInput := map[string]any{}
	safeInput["num_outputs"] = count
	if err = copyValidatedImageBillingString(
		safeInput, input, "aspect_ratio", "input.aspect_ratio",
		imageBillingEnumValidator(replicateAspectRatioValues),
	); err != nil {
		return nil, err
	}
	if err = copyValidatedImageBillingString(
		safeInput, input, "output_format", "input.output_format", validateFreeImageBillingIdentifier,
	); err != nil {
		return nil, err
	}
	for _, key := range []string{"width", "height"} {
		raw, exists := input[key]
		if !exists || isJSONNull(raw) {
			continue
		}
		value, valueErr := imageBillingInteger(raw, "input."+key, 256, 1440)
		if valueErr != nil || value%32 != 0 {
			return nil, fmt.Errorf("input.%s must be a number represented as an integer between 256 and 1440 in increments of 32", key)
		}
		safeInput[key] = value
	}
	if err = copyImageBillingBooleans(safeInput, input, "input.", "prompt_upsampling"); err != nil {
		return nil, err
	}
	body := canonicalImageBillingBody(incoming.Model, count)
	body["input"] = safeInput
	aspectRatio, err := optionalValidatedImageBillingString(
		input, "aspect_ratio", "input.aspect_ratio", imageBillingEnumValidator(replicateAspectRatioValues),
	)
	if err != nil {
		return nil, err
	}
	size := aspectRatio
	resolution := imageBillingDimensions(input)
	if size == "" {
		size = resolution
	}
	setCanonicalString(body, "size", size)
	setCanonicalString(body, "resolution", resolution)
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model: incoming.Model, N: common.GetPointer(uint(count)), Size: size,
	}, 0, body, promptTexts)
}

func resolveSiliconFlowImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "SiliconFlow image request")
	if err != nil {
		return nil, err
	}
	prompt, err := requiredImageBillingString(object, "prompt", "prompt")
	if err != nil {
		return nil, err
	}
	promptTexts := []string{prompt}
	if negativePrompt, promptErr := optionalImageBillingString(object, "negative_prompt", "negative_prompt"); promptErr != nil {
		return nil, promptErr
	} else if negativePrompt != "" {
		promptTexts = append(promptTexts, negativePrompt)
	}
	count, err := imageBillingCount(object, "batch_size", "batch_size", false)
	if err != nil {
		return nil, err
	}
	body := canonicalImageBillingBody(incoming.Model, count)
	body["batch_size"] = count
	if err = copyValidatedImageBillingString(
		body, object, "image_size", "image_size", validateImageBillingSize,
	); err != nil {
		return nil, err
	}
	if err = copyImageBillingIntegers(body, object, "", 0, maxExactJSONInteger, "seed"); err != nil {
		return nil, err
	}
	if err = copyImageBillingIntegers(body, object, "", 0, maxImageBillingInteger, "num_inference_steps"); err != nil {
		return nil, err
	}
	if err = copyImageBillingNumbers(body, object, "", -maxImageBillingNumber, maxImageBillingNumber, "guidance_scale", "cfg"); err != nil {
		return nil, err
	}
	imageSize, err := optionalValidatedImageBillingString(
		object, "image_size", "image_size", validateImageBillingSize,
	)
	if err != nil {
		return nil, err
	}
	setCanonicalString(body, "size", imageSize)
	setCanonicalString(body, "resolution", imageSize)
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model: incoming.Model, N: common.GetPointer(uint(count)), Size: imageSize,
	}, 0, body, promptTexts)
}

func resolveMiniMaxImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "MiniMax image request")
	if err != nil {
		return nil, err
	}
	prompt, err := requiredImageBillingString(object, "prompt", "prompt")
	if err != nil {
		return nil, err
	}
	count, err := imageBillingCount(object, "n", "n", true)
	if err != nil {
		return nil, err
	}
	body := canonicalImageBillingBody(incoming.Model, count)
	if err = copyValidatedImageBillingString(
		body, object, "aspect_ratio", "aspect_ratio", imageBillingEnumValidator(miniMaxAspectRatioValues),
	); err != nil {
		return nil, err
	}
	if err = copyValidatedImageBillingString(
		body, object, "response_format", "response_format", imageBillingEnumValidator(miniMaxResponseFormatValues),
	); err != nil {
		return nil, err
	}
	if err = copyImageBillingBooleans(body, object, "", "prompt_optimizer", "aigc_watermark"); err != nil {
		return nil, err
	}
	body["n"] = count
	aspectRatio, err := optionalValidatedImageBillingString(
		object, "aspect_ratio", "aspect_ratio", imageBillingEnumValidator(miniMaxAspectRatioValues),
	)
	if err != nil {
		return nil, err
	}
	setCanonicalString(body, "size", aspectRatio)
	setCanonicalString(body, "resolution", aspectRatio)
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model: incoming.Model, N: common.GetPointer(uint(count)), Size: aspectRatio,
	}, 0, body, []string{prompt})
}

func resolveJimengImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "Jimeng image request")
	if err != nil {
		return nil, err
	}
	prompt, err := requiredImageBillingString(object, "prompt", "prompt")
	if err != nil {
		return nil, err
	}
	const count = 1
	body := canonicalImageBillingBody(incoming.Model, count)
	if err = copyImageBillingIntegers(body, object, "", 256, 768, "width", "height"); err != nil {
		return nil, err
	}
	if err = copyImageBillingIntegers(body, object, "", -maxExactJSONInteger, maxExactJSONInteger, "seed"); err != nil {
		return nil, err
	}
	if err = copyImageBillingBooleans(body, object, "", "use_pre_llm", "use_sr", "return_url"); err != nil {
		return nil, err
	}
	if raw, exists := object["logo_info"]; exists && !isJSONNull(raw) {
		logo, objectErr := imageBillingObject(raw, "logo_info")
		if objectErr != nil {
			return nil, objectErr
		}
		safeLogo := map[string]any{}
		if copyErr := copyImageBillingBooleans(safeLogo, logo, "logo_info.", "add_logo"); copyErr != nil {
			return nil, copyErr
		}
		if copyErr := copyImageBillingIntegers(safeLogo, logo, "logo_info.", -maxImageBillingInteger, maxImageBillingInteger, "position", "language"); copyErr != nil {
			return nil, copyErr
		}
		if copyErr := copyImageBillingNumbers(safeLogo, logo, "logo_info.", -maxImageBillingNumber, maxImageBillingNumber, "opacity"); copyErr != nil {
			return nil, copyErr
		}
		if len(safeLogo) > 0 {
			body["logo_info"] = safeLogo
		}
	}
	resolution := imageBillingDimensions(object)
	setCanonicalString(body, "size", resolution)
	setCanonicalString(body, "resolution", resolution)
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model: incoming.Model, N: common.GetPointer(uint(count)), Size: resolution,
	}, 0, body, []string{prompt})
}

func resolveXAIImageBilling(info *relaycommon.RelayInfo, incoming *dto.ImageRequest, outboundJSON []byte) (*OutboundImageBilling, error) {
	object, err := imageBillingObject(outboundJSON, "xAI image request")
	if err != nil {
		return nil, err
	}
	prompt, err := requiredImageBillingString(object, "prompt", "prompt")
	if err != nil {
		return nil, err
	}
	count, err := imageBillingCount(object, "n", "n", true)
	if err != nil {
		return nil, err
	}
	body := canonicalImageBillingBody(incoming.Model, count)
	if err = copyValidatedImageBillingString(
		body, object, "response_format", "response_format",
		validateImageBillingString,
	); err != nil {
		return nil, err
	}
	body["n"] = count
	return resolveOutboundImageBilling(info, &dto.ImageRequest{
		Model: incoming.Model, N: common.GetPointer(uint(count)),
	}, 0, body, []string{prompt})
}

func imageBillingObject(raw []byte, name string) (map[string]json.RawMessage, error) {
	var object map[string]json.RawMessage
	if err := common.Unmarshal(raw, &object); err != nil {
		return nil, fmt.Errorf("invalid %s: %w", name, err)
	}
	if object == nil {
		return nil, fmt.Errorf("%s must be a JSON object", name)
	}
	return object, nil
}

func requiredImageBillingString(object map[string]json.RawMessage, key, path string) (string, error) {
	raw, exists := object[key]
	if !exists || isJSONNull(raw) {
		return "", fmt.Errorf("%s is required", path)
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return "", fmt.Errorf("%s must be a string", path)
	}
	return value, nil
}

func optionalImageBillingString(object map[string]json.RawMessage, key, path string) (string, error) {
	raw, exists := object[key]
	if !exists || isJSONNull(raw) {
		return "", nil
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return "", fmt.Errorf("%s must be a string", path)
	}
	return value, nil
}

type imageBillingStringValidator func(value, path string) (string, error)

func optionalValidatedImageBillingString(
	object map[string]json.RawMessage,
	key, path string,
	validator imageBillingStringValidator,
) (string, error) {
	value, err := optionalImageBillingString(object, key, path)
	if err != nil || value == "" {
		return value, err
	}
	return validator(value, path)
}

func optionalImageBillingBool(object map[string]json.RawMessage, key, path string) (*bool, error) {
	raw, exists := object[key]
	if !exists || isJSONNull(raw) {
		return nil, nil
	}
	var value bool
	if err := common.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("%s must be a boolean", path)
	}
	return common.GetPointer(value), nil
}

func imageBillingCount(object map[string]json.RawMessage, key, path string, defaultOne bool) (int, error) {
	raw, exists := object[key]
	if !exists {
		if defaultOne {
			return 1, nil
		}
		return 0, fmt.Errorf("%s is required", path)
	}
	if isJSONNull(raw) {
		return 0, fmt.Errorf("%s must be an integer between 1 and %d", path, dto.MaxImageN)
	}
	var number json.Number
	if !isJSONNumber(raw) {
		return 0, fmt.Errorf("%s must be an integer between 1 and %d", path, dto.MaxImageN)
	}
	if err := common.Unmarshal(raw, &number); err != nil {
		return 0, fmt.Errorf("%s must be an integer between 1 and %d", path, dto.MaxImageN)
	}
	value, err := strconv.ParseUint(number.String(), 10, 64)
	if err != nil || value < 1 || value > dto.MaxImageN {
		return 0, fmt.Errorf("%s must be an integer between 1 and %d", path, dto.MaxImageN)
	}
	return int(value), nil
}

func copyValidatedImageBillingString(
	destination map[string]any,
	source map[string]json.RawMessage,
	key, path string,
	validator imageBillingStringValidator,
) error {
	raw, exists := source[key]
	if !exists || isJSONNull(raw) {
		return nil
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("%s must be a string", path)
	}
	value, err := validator(value, path)
	if err != nil {
		return err
	}
	destination[key] = value
	return nil
}

func validateImageBillingString(value, path string) (string, error) {
	lower := strings.ToLower(value)
	if value == "" ||
		len(value) > maxImageBillingScalarBytes ||
		value != strings.TrimSpace(value) ||
		!imageBillingScalarPattern.MatchString(value) ||
		strings.Contains(lower, "://") ||
		strings.HasPrefix(lower, "www.") ||
		imageBillingSchemePattern.MatchString(value) ||
		imageBillingHostnamePattern.MatchString(value) ||
		strings.Contains(lower, ";base64,") ||
		looksLikeEncodedImageBillingPayload(value) {
		return "", fmt.Errorf("%s must be a bounded non-sensitive string", path)
	}
	return value, nil
}

func validateOpenAIImageBillingString(value, path string) (string, error) {
	switch path {
	case "size":
		return validateImageBillingSize(value, path)
	case "quality":
		return imageBillingEnumValidator(openAIImageQualityValues)(value, path)
	case "response_format":
		return imageBillingEnumValidator(openAIImageResponseFormatValues)(value, path)
	case "style", "background", "moderation", "output_format", "input_fidelity":
		return validateImageBillingString(value, path)
	default:
		return "", fmt.Errorf("unsupported image billing string %s", path)
	}
}

func imageBillingEnumValidator(values []string) imageBillingStringValidator {
	return func(value, path string) (string, error) {
		value, err := validateImageBillingString(value, path)
		if err != nil {
			return "", err
		}
		if !slices.Contains(values, value) {
			return "", fmt.Errorf("%s must be one of %s", path, strings.Join(values, ", "))
		}
		return value, nil
	}
}

func validateImageBillingSize(value, path string) (string, error) {
	value, err := validateImageBillingString(value, path)
	if err != nil {
		return "", err
	}
	if slices.Contains(imageBillingSizeValues, value) {
		return value, nil
	}
	match := imageBillingSizePattern.FindStringSubmatch(value)
	if len(match) != 3 {
		return "", fmt.Errorf("%s must be a supported size or bounded dimensions", path)
	}
	width, widthErr := strconv.ParseInt(match[1], 10, 64)
	height, heightErr := strconv.ParseInt(match[2], 10, 64)
	if widthErr != nil || heightErr != nil ||
		width < 1 || width > maxImageDimension ||
		height < 1 || height > maxImageDimension {
		return "", fmt.Errorf("%s must be a supported size or bounded dimensions", path)
	}
	return value, nil
}

func validateImageBillingAspectRatio(value, path string) (string, error) {
	value, err := validateImageBillingString(value, path)
	if err != nil {
		return "", err
	}
	match := imageBillingAspectRatioPattern.FindStringSubmatch(value)
	if len(match) != 3 {
		return "", fmt.Errorf("%s must be a positive integer aspect ratio", path)
	}
	width, widthErr := strconv.ParseInt(match[1], 10, 64)
	height, heightErr := strconv.ParseInt(match[2], 10, 64)
	if widthErr != nil || heightErr != nil ||
		width < 1 || width > maxImageDimension ||
		height < 1 || height > maxImageDimension {
		return "", fmt.Errorf("%s must be a positive integer aspect ratio", path)
	}
	return value, nil
}

func validateFreeImageBillingIdentifier(value, path string) (string, error) {
	value, err := validateImageBillingString(value, path)
	if err != nil {
		return "", err
	}
	if !imageBillingIdentifierPattern.MatchString(value) {
		return "", fmt.Errorf("%s must be a bounded lowercase identifier", path)
	}
	return value, nil
}

func looksLikeEncodedImageBillingPayload(value string) bool {
	encodings := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}
	for _, encoding := range encodings {
		decoded, err := encoding.DecodeString(value)
		if err != nil || len(decoded) == 0 {
			continue
		}
		if imageBillingDecodedPayloadHasImageMagic(decoded) {
			return true
		}
	}
	return false
}

func imageBillingDecodedPayloadHasImageMagic(decoded []byte) bool {
	return bytes.HasPrefix(decoded, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}) ||
		bytes.HasPrefix(decoded, []byte{0xff, 0xd8, 0xff}) ||
		bytes.HasPrefix(decoded, []byte("GIF87a")) ||
		bytes.HasPrefix(decoded, []byte("GIF89a")) ||
		bytes.HasPrefix(decoded, []byte("BM")) ||
		bytes.HasPrefix(decoded, []byte("II*\x00")) ||
		bytes.HasPrefix(decoded, []byte("MM\x00*")) ||
		len(decoded) >= 12 && bytes.Equal(decoded[:4], []byte("RIFF")) && bytes.Equal(decoded[8:12], []byte("WEBP"))
}

func copyImageBillingIntegers(
	destination map[string]any,
	source map[string]json.RawMessage,
	prefix string,
	minimum, maximum int64,
	keys ...string,
) error {
	for _, key := range keys {
		raw, exists := source[key]
		if !exists || isJSONNull(raw) {
			continue
		}
		value, err := imageBillingInteger(raw, prefix+key, minimum, maximum)
		if err != nil {
			return err
		}
		destination[key] = value
	}
	return nil
}

func imageBillingInteger(raw json.RawMessage, path string, minimum, maximum int64) (int64, error) {
	var number json.Number
	if !isJSONNumber(raw) {
		return 0, fmt.Errorf("%s must be a number represented as an integer between %d and %d", path, minimum, maximum)
	}
	if err := common.Unmarshal(raw, &number); err != nil {
		return 0, fmt.Errorf("%s must be a number represented as an integer between %d and %d", path, minimum, maximum)
	}
	value, err := strconv.ParseInt(number.String(), 10, 64)
	if err != nil || value < minimum || value > maximum {
		return 0, fmt.Errorf("%s must be a number represented as an integer between %d and %d", path, minimum, maximum)
	}
	return value, nil
}

func copyImageBillingNumbers(
	destination map[string]any,
	source map[string]json.RawMessage,
	prefix string,
	minimum, maximum float64,
	keys ...string,
) error {
	for _, key := range keys {
		raw, exists := source[key]
		if !exists || isJSONNull(raw) {
			continue
		}
		value, err := imageBillingNumber(raw, prefix+key, minimum, maximum)
		if err != nil {
			return err
		}
		destination[key] = value
	}
	return nil
}

func imageBillingNumber(raw json.RawMessage, path string, minimum, maximum float64) (float64, error) {
	var number json.Number
	if !isJSONNumber(raw) {
		return 0, fmt.Errorf("%s must be a finite number between %g and %g", path, minimum, maximum)
	}
	if err := common.Unmarshal(raw, &number); err != nil {
		return 0, fmt.Errorf("%s must be a finite number between %g and %g", path, minimum, maximum)
	}
	value, err := strconv.ParseFloat(number.String(), 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < minimum || value > maximum {
		return 0, fmt.Errorf("%s must be a finite number between %g and %g", path, minimum, maximum)
	}
	return value, nil
}

func isJSONNumber(raw json.RawMessage) bool {
	value := strings.TrimSpace(string(raw))
	return value != "" && (value[0] == '-' || value[0] >= '0' && value[0] <= '9')
}

func copyImageBillingBooleans(destination map[string]any, source map[string]json.RawMessage, prefix string, keys ...string) error {
	for _, key := range keys {
		raw, exists := source[key]
		if !exists || isJSONNull(raw) {
			continue
		}
		var value bool
		if err := common.Unmarshal(raw, &value); err != nil {
			return fmt.Errorf("%s%s must be a boolean", prefix, key)
		}
		destination[key] = value
	}
	return nil
}

func canonicalImageBillingBody(model string, count int) map[string]any {
	return map[string]any{"model": model, "n": count}
}

func copyCanonicalStringAlias(body map[string]any, sourceKey, destinationKey string) {
	if value, ok := body[sourceKey].(string); ok && value != "" {
		body[destinationKey] = value
	}
}

func setCanonicalString(body map[string]any, key, value string) {
	if value != "" {
		body[key] = value
	}
}

func imageBillingDimensions(object map[string]json.RawMessage) string {
	width, widthOK := imageBillingPositiveInteger(object["width"])
	height, heightOK := imageBillingPositiveInteger(object["height"])
	if !widthOK || !heightOK {
		return ""
	}
	return fmt.Sprintf("%dx%d", width, height)
}

func imageBillingPositiveInteger(raw json.RawMessage) (uint64, bool) {
	if len(raw) == 0 || isJSONNull(raw) {
		return 0, false
	}
	value, err := imageBillingInteger(raw, "image dimension", 1, maxImageDimension)
	return uint64(value), err == nil
}

func isJSONNull(raw json.RawMessage) bool {
	return strings.TrimSpace(string(raw)) == "null"
}

type imageMultipartFieldSet struct {
	mode     string
	indexes  map[int]struct{}
	maxIndex int
	count    int
}

func newImageMultipartFieldSet() imageMultipartFieldSet {
	return imageMultipartFieldSet{
		indexes:  map[int]struct{}{},
		maxIndex: -1,
	}
}

func (fields *imageMultipartFieldSet) add(name string, occurrences int) error {
	if occurrences < 1 {
		return nil
	}
	mode := name
	if name != "image" && name != "image[]" {
		match := indexedImageFieldPattern.FindStringSubmatch(name)
		if len(match) != 2 {
			return fmt.Errorf("invalid multipart image field %q", name)
		}
		mode = "image[index]"
		index, err := strconv.ParseInt(match[1], 10, 32)
		if err != nil {
			return fmt.Errorf("invalid indexed image field %q", name)
		}
		if occurrences != 1 {
			return fmt.Errorf("duplicate indexed image field %q", name)
		}
		if _, duplicate := fields.indexes[int(index)]; duplicate {
			return fmt.Errorf("duplicate indexed image field %q", name)
		}
		fields.indexes[int(index)] = struct{}{}
		fields.maxIndex = max(fields.maxIndex, int(index))
	}
	if fields.mode != "" && fields.mode != mode {
		return fmt.Errorf("ambiguous multipart image fields %q and %q", fields.mode, name)
	}
	fields.mode = mode
	fields.count += occurrences
	return nil
}

func (fields *imageMultipartFieldSet) validate() error {
	if fields.mode == "image[index]" && fields.maxIndex+1 != len(fields.indexes) {
		return fmt.Errorf("indexed image fields must be unique and contiguous from image[0]")
	}
	return nil
}

// ValidateImageMultipartFileFields checks the original multipart part names
// before an adaptor can collapse indexed fields into image or image[].
func ValidateImageMultipartFileFields(form *multipart.Form) error {
	if form == nil {
		return nil
	}
	fields := newImageMultipartFieldSet()
	for name, values := range form.Value {
		if !isImageMultipartFieldName(name) {
			continue
		}
		if err := fields.add(name, len(values)); err != nil {
			return err
		}
	}
	for name, files := range form.File {
		if !isImageMultipartFieldName(name) {
			continue
		}
		if err := fields.add(name, len(files)); err != nil {
			return err
		}
	}
	return fields.validate()
}

func isImageMultipartFieldName(name string) bool {
	return name == "image" || name == "image[]" || strings.HasPrefix(name, "image[")
}

// ResolveOutboundImageBillingMultipart rebuilds the billing view from the
// final multipart body without retaining prompts or file contents.
func ResolveOutboundImageBillingMultipart(info *relaycommon.RelayInfo, contentType string, body io.Reader, schemaConfirmed ...bool) (*OutboundImageBilling, error) {
	if info == nil {
		return nil, nil
	}
	incoming, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return nil, nil
	}
	confirmed := len(schemaConfirmed) > 0 && schemaConfirmed[0]
	if info.ChannelMeta == nil || !isOpenAIImageBillingAPIType(info.ApiType, confirmed) {
		return nil, fmt.Errorf("unsupported multipart image billing schema")
	}
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(mediaType, "multipart/form-data") || params["boundary"] == "" {
		return nil, fmt.Errorf("invalid multipart content type")
	}

	outbound := &dto.ImageRequest{Model: incoming.Model}
	references := newImageMultipartFieldSet()
	sanitizedBody := map[string]any{}
	seen := map[string]bool{}
	reader := multipart.NewReader(body, params["boundary"])
	for {
		part, nextErr := reader.NextPart()
		if nextErr == io.EOF {
			break
		}
		if nextErr != nil {
			return nil, nextErr
		}
		name := part.FormName()
		if name == "image" || name == "image[]" || strings.HasPrefix(name, "image[") {
			if err = references.add(name, 1); err != nil {
				_ = part.Close()
				return nil, err
			}
			if part.FileName() == "" {
				_ = part.Close()
				return nil, fmt.Errorf("%s must be a file part", name)
			}
			_, err = io.Copy(io.Discard, part)
			_ = part.Close()
			if err != nil {
				return nil, err
			}
			continue
		}
		switch name {
		case "prompt", "n", "size", "quality", "response_format", "style",
			"background", "moderation", "output_format", "output_compression",
			"partial_images", "stream", "input_fidelity", "watermark",
			"layer_decomposition", "watermark_enabled", "parameters":
			if seen[name] {
				_, err = io.Copy(io.Discard, part)
				_ = part.Close()
				if err != nil {
					return nil, err
				}
				return nil, fmt.Errorf("duplicate multipart billing parameter %q", name)
			}
			if part.FileName() != "" {
				_ = part.Close()
				return nil, fmt.Errorf("%s must not contain file content", name)
			}
			seen[name] = true
			var value string
			var valueErr error
			if name == "prompt" {
				var prompt []byte
				prompt, valueErr = io.ReadAll(part)
				value = string(prompt)
			} else {
				value, valueErr = readMultipartBillingScalar(part)
			}
			_ = part.Close()
			if valueErr != nil {
				return nil, valueErr
			}
			switch name {
			case "prompt":
				outbound.Prompt = value
			case "n":
				parsed, parseErr := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
				if parseErr != nil || parsed > dto.MaxImageN {
					return nil, fmt.Errorf("n must be an integer between 1 and %d", dto.MaxImageN)
				}
				outbound.N = common.GetPointer(uint(parsed))
			case "size":
				parsed, parseErr := validateOpenAIImageBillingString(value, "size")
				if parseErr != nil {
					return nil, parseErr
				}
				outbound.Size = parsed
				sanitizedBody["size"] = parsed
				sanitizedBody["resolution"] = parsed
			case "quality":
				parsed, parseErr := validateOpenAIImageBillingString(value, "quality")
				if parseErr != nil {
					return nil, parseErr
				}
				outbound.Quality = parsed
				sanitizedBody["quality"] = parsed
			case "response_format", "style", "background", "moderation", "output_format", "input_fidelity":
				parsed, parseErr := validateOpenAIImageBillingString(value, name)
				if parseErr != nil {
					return nil, parseErr
				}
				sanitizedBody[name] = parsed
			case "output_compression":
				parsed, parseErr := imageBillingInteger(
					json.RawMessage(strings.TrimSpace(value)), name, 0, maxImageBillingInteger,
				)
				if parseErr != nil {
					return nil, parseErr
				}
				sanitizedBody[name] = parsed
			case "partial_images":
				parsed, parseErr := imageBillingInteger(
					json.RawMessage(strings.TrimSpace(value)), name, 0, maxImageBillingInteger,
				)
				if parseErr != nil {
					return nil, parseErr
				}
				sanitizedBody[name] = parsed
			case "stream", "watermark", "watermark_enabled":
				parsed, parseErr := parseMultipartImageBillingBool(value, name)
				if parseErr != nil {
					return nil, parseErr
				}
				sanitizedBody[name] = parsed
			case "layer_decomposition":
				parsed, parseErr := parseMultipartImageBillingBool(value, name)
				if parseErr != nil {
					return nil, parseErr
				}
				outbound.LayerDecomposition = common.GetPointer(parsed)
				sanitizedBody["layer_decomposition"] = parsed
			case "parameters":
				parameters := &dto.ImageBillingParameters{}
				if parseErr := common.Unmarshal([]byte(value), parameters); parseErr != nil {
					return nil, fmt.Errorf("invalid image parameters: %w", parseErr)
				}
				if parameters.N != nil && *parameters.N > dto.MaxImageN {
					return nil, fmt.Errorf("parameters.n must be an integer between 0 and %d", dto.MaxImageN)
				}
				outbound.BillingParameters = parameters
				safeParameters := map[string]any{}
				if parameters.N != nil {
					safeParameters["n"] = *parameters.N
				}
				if parameters.PromptExtend != nil {
					safeParameters["prompt_extend"] = *parameters.PromptExtend
				}
				if len(safeParameters) > 0 {
					sanitizedBody["parameters"] = safeParameters
				}
			}
		default:
			_, err = io.Copy(io.Discard, part)
			_ = part.Close()
			if err != nil {
				return nil, err
			}
		}
	}
	if err = references.validate(); err != nil {
		return nil, err
	}
	promptTexts := []string{outbound.Prompt}
	outbound.Prompt = ""
	return resolveOutboundImageBilling(info, outbound, references.count, sanitizedBody, promptTexts)
}

func parseMultipartImageBillingBool(value, path string) (bool, error) {
	switch value {
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, fmt.Errorf("%s must be true or false", path)
	}
}

func resolveOutboundImageBilling(
	info *relaycommon.RelayInfo,
	outbound *dto.ImageRequest,
	referenceImages int,
	sanitizedBody map[string]any,
	promptTexts []string,
) (*OutboundImageBilling, error) {
	incoming, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return nil, nil
	}
	profile, seedream := seedreamProfile(incoming.Model)
	if outbound.N != nil && *outbound.N == 0 {
		maxOutputs := dto.MaxImageN
		if seedream {
			maxOutputs = profile.maxOutputs
		}
		return nil, fmt.Errorf("n must be an integer between 1 and %d", maxOutputs)
	}

	billingRequest := &dto.ImageRequest{
		Model:              incoming.Model,
		N:                  outbound.N,
		Size:               outbound.Size,
		Quality:            outbound.Quality,
		LayerDecomposition: outbound.LayerDecomposition,
		BillingParameters:  outbound.BillingParameters,
	}
	if seedream && referenceImages > 0 {
		references := make([]string, referenceImages)
		for index := range references {
			references[index] = "billing-reference"
		}
		encoded, err := common.Marshal(references)
		if err != nil {
			return nil, err
		}
		billingRequest.Image = encoded
	}
	count, err := billingRequest.ImageCount(false)
	if err != nil {
		return nil, err
	}

	input := billingexpr.RequestInput{Headers: cloneStringMap(info.RequestHeaders)}
	if info.BillingRequestInput != nil {
		input.Headers = cloneStringMap(info.BillingRequestInput.Headers)
		input.EvaluatedAtUnix = info.BillingRequestInput.EvaluatedAtUnix
	}
	var resolved billingexpr.RequestInput
	if seedream {
		resolved, err = ResolveImageBillingRequestInput(nil, &relaycommon.RelayInfo{Request: billingRequest}, input)
		if err != nil {
			return nil, err
		}
		if resolved.ImageCount != nil {
			count = *resolved.ImageCount
		}
	} else {
		if sanitizedBody == nil {
			sanitizedBody = canonicalImageBillingBody(incoming.Model, count)
			setCanonicalString(sanitizedBody, "size", billingRequest.Size)
			setCanonicalString(sanitizedBody, "resolution", billingRequest.Size)
			setCanonicalString(sanitizedBody, "quality", billingRequest.Quality)
			if parameters := billingRequest.BillingParameters; parameters != nil {
				safeParameters := map[string]any{}
				if parameters.N != nil {
					safeParameters["n"] = *parameters.N
				}
				if parameters.PromptExtend != nil {
					safeParameters["prompt_extend"] = *parameters.PromptExtend
				}
				if len(safeParameters) > 0 {
					sanitizedBody["parameters"] = safeParameters
				}
			}
		}
		sanitizedBody["model"] = incoming.Model
		sanitizedBody["n"] = count
		encoded, marshalErr := common.Marshal(sanitizedBody)
		if marshalErr != nil {
			return nil, marshalErr
		}
		input.Body = encoded
		input.ImageCount = common.GetPointer(count)
		resolved = input
	}
	return &OutboundImageBilling{
		Request:     billingRequest,
		PromptTexts: append([]string(nil), promptTexts...),
		Input:       resolved,
		Count:       count,
	}, nil
}

func readMultipartBillingScalar(part io.Reader) (string, error) {
	const maxBillingScalarBytes = 64 << 10
	value, err := io.ReadAll(io.LimitReader(part, maxBillingScalarBytes+1))
	if err != nil {
		return "", err
	}
	if len(value) > maxBillingScalarBytes {
		return "", fmt.Errorf("multipart billing parameter exceeds %d bytes", maxBillingScalarBytes)
	}
	return string(value), nil
}

// ResolveOutboundSeedreamBillingRequestInput is retained for callers that only
// need the Seedream scalar snapshot.
func ResolveOutboundSeedreamBillingRequestInput(info *relaycommon.RelayInfo, outboundJSON []byte) (*billingexpr.RequestInput, error) {
	if info == nil {
		return nil, nil
	}
	incoming, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return nil, nil
	}
	if _, seedream := seedreamProfile(incoming.Model); !seedream {
		return nil, nil
	}
	resolved, err := ResolveOutboundImageBillingJSON(info, outboundJSON)
	if err != nil || resolved == nil {
		return nil, err
	}
	return &resolved.Input, nil
}

func BuildBillingExprRequestInputFromRequest(request dto.Request, headers map[string]string) (billingexpr.RequestInput, error) {
	input := billingexpr.RequestInput{
		Headers: cloneStringMap(headers),
	}
	if request == nil {
		return input, nil
	}
	if imageRequest, ok := request.(*dto.ImageRequest); ok {
		return ResolveImageBillingRequestInput(nil, &relaycommon.RelayInfo{Request: imageRequest}, input)
	}

	bodyBytes, err := common.Marshal(request)
	if err != nil {
		return billingexpr.RequestInput{}, err
	}
	input.Body = bodyBytes
	return input, nil
}

func readIncomingBillingExprBody(c *gin.Context) ([]byte, error) {
	if c == nil || c.Request == nil || !isJSONContentType(c.Request.Header.Get("Content-Type")) {
		return nil, nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	return storage.Bytes()
}

func cloneRequestInput(src billingexpr.RequestInput) billingexpr.RequestInput {
	input := billingexpr.RequestInput{
		Headers:         cloneStringMap(src.Headers),
		EvaluatedAtUnix: src.EvaluatedAtUnix,
	}
	if src.ImageCount != nil {
		count := *src.ImageCount
		input.ImageCount = &count
	}
	if src.ImagesUpTo1_5K != nil {
		count := *src.ImagesUpTo1_5K
		input.ImagesUpTo1_5K = &count
	}
	if src.ImagesAbove1_5K != nil {
		count := *src.ImagesAbove1_5K
		input.ImagesAbove1_5K = &count
	}
	if src.InputImages != nil {
		count := *src.InputImages
		input.InputImages = &count
	}
	if len(src.Body) > 0 {
		input.Body = append([]byte(nil), src.Body...)
	}
	if len(src.Usage) > 0 {
		input.Usage = make(map[string]any, len(src.Usage))
		maps.Copy(input.Usage, src.Usage)
	}
	return input
}

func isJSONContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	return strings.HasPrefix(contentType, "application/json")
}

func cloneStringMap(src map[string]string) map[string]string {
	if len(src) == 0 {
		return map[string]string{}
	}
	dst := make(map[string]string, len(src))
	for key, value := range src {
		if strings.TrimSpace(key) == "" {
			continue
		}
		dst[key] = value
	}
	return dst
}
