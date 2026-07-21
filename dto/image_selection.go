package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// NormalizeImageSelectionRequirement resolves model-neutral image controls to
// one canonical capability requirement and retains it for billing.
func (request *ImageRequest) NormalizeImageSelectionRequirement(model string, operation ImageOperation) (*ImageSelectionRequirement, error) {
	requirement, err := ResolveImageSelectionRequirementWithModelDefaults(request, model, operation)
	if err != nil {
		return nil, err
	}
	request.imageSelectionRequirement = &requirement
	return &requirement, nil
}

func (request *ImageRequest) SetImageSelectionRequirement(requirement ImageSelectionRequirement) error {
	normalized, err := requirement.Normalize()
	if err != nil {
		return err
	}
	request.imageSelectionRequirement = &normalized
	return nil
}

func (request *ImageRequest) ImageSelectionRequirement() (ImageSelectionRequirement, bool) {
	if request == nil || request.imageSelectionRequirement == nil {
		return ImageSelectionRequirement{}, false
	}
	return *request.imageSelectionRequirement, true
}

func (request *ImageRequest) imageBillingResolution() string {
	if request == nil || request.imageSelectionRequirement == nil {
		return ""
	}
	return request.imageSelectionRequirement.Resolution
}

// ResolveImageSelectionRequirement is pure so middleware can inspect a reusable
// request body without changing the request later decoded by the relay.
func ResolveImageSelectionRequirement(request *ImageRequest, model string, operation ImageOperation) (ImageSelectionRequirement, error) {
	return resolveImageSelectionRequirement(request, model, operation, false)
}

// ResolveImageSelectionRequirementWithModelDefaults is used after channel
// selection (or by legacy callers that do not have an explicit routing
// profile). It applies the model catalog's defaults only after the request has
// had a chance to select an explicit channel profile.
func ResolveImageSelectionRequirementWithModelDefaults(request *ImageRequest, model string, operation ImageOperation) (ImageSelectionRequirement, error) {
	return resolveImageSelectionRequirement(request, model, operation, true)
}

func resolveImageSelectionRequirement(request *ImageRequest, model string, operation ImageOperation, applyModelDefaults bool) (ImageSelectionRequirement, error) {
	if request == nil {
		return ImageSelectionRequirement{}, fmt.Errorf("image request is required")
	}
	if strings.TrimSpace(model) == "" {
		model = request.Model
	}

	resolution, hasResolution, err := imageRequestExtraString(request, "resolution")
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	aspectRatio, hasAspectRatio, err := imageRequestExtraString(request, "aspect_ratio")
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	outputFormat, err := imageRequestRawString(request.OutputFormat, "output_format")
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	outputCount := uint(1)
	if request.N != nil {
		outputCount = *request.N
	}
	providerOutputCount, hasProviderOutputCount, err := imageRequestProviderOutputCount(request)
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	if hasProviderOutputCount && providerOutputCount > outputCount {
		outputCount = providerOutputCount
	}
	imageURLs, err := request.ImageInputURLs()
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	referenceImageCount := len(imageURLs)
	if referenceImageCount == 0 && imageRequestRawPresent(request.Image) {
		referenceImageCount = 1
	}
	multipartReferenceImageCount, multipartHasMask := request.MultipartImageSelectionMeta()
	if multipartReferenceImageCount > referenceImageCount {
		referenceImageCount = multipartReferenceImageCount
	}
	optionalParameters := make([]string, 0, 12)
	optionalValues := make(map[string]json.RawMessage)
	addOptionalValue := func(name string, raw json.RawMessage) {
		if !imageRequestRawPresent(raw) {
			return
		}
		optionalParameters = append(optionalParameters, name)
		optionalValues[name] = append(json.RawMessage(nil), bytes.TrimSpace(raw)...)
	}
	if request.Watermark != nil {
		raw, marshalErr := common.Marshal(*request.Watermark)
		if marshalErr != nil {
			return ImageSelectionRequirement{}, fmt.Errorf("encode watermark: %w", marshalErr)
		}
		addOptionalValue("watermark", raw)
	}
	for _, parameter := range []struct {
		name string
		raw  json.RawMessage
	}{
		{name: "output_compression", raw: request.OutputCompression},
		{name: "background", raw: request.Background},
		{name: "moderation", raw: request.Moderation},
		{name: "style", raw: request.Style},
		{name: "user", raw: request.User},
		{name: "extra_fields", raw: request.ExtraFields},
		{name: "partial_images", raw: request.PartialImages},
		{name: "input_fidelity", raw: request.InputFidelity},
		{name: "watermark_enabled", raw: request.WatermarkEnabled},
		{name: "user_id", raw: request.UserId},
	} {
		addOptionalValue(parameter.name, parameter.raw)
	}
	for name, raw := range request.Extra {
		if name == "resolution" || name == "aspect_ratio" {
			continue
		}
		addOptionalValue(name, raw)
	}
	if len(optionalValues) == 0 {
		optionalValues = nil
	}
	requirement, err := (ImageSelectionRequirement{
		Operation:           operation,
		Resolution:          resolution,
		AspectRatio:         aspectRatio,
		Size:                request.Size,
		Quality:             request.Quality,
		OutputFormat:        outputFormat,
		N:                   outputCount,
		ReferenceImageCount: referenceImageCount,
		OptionalParameters:  optionalParameters,
		OptionalValues:      optionalValues,
		HasMask:             imageRequestRawPresent(request.Mask) || multipartHasMask,
	}).Normalize()
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	capabilities := common.ImageModelCapabilitiesForModel(model)
	if applyModelDefaults && requirement.Size != "" && len(capabilities.ResolutionAspectVariants) > 0 {
		for _, variant := range capabilities.ResolutionAspectVariants {
			if variant.Size != requirement.Size {
				continue
			}
			if hasResolution && requirement.Resolution != variant.Resolution {
				return ImageSelectionRequirement{}, fmt.Errorf("size %s conflicts with resolution %s", requirement.Size, requirement.Resolution)
			}
			if hasAspectRatio && requirement.AspectRatio != variant.AspectRatio {
				return ImageSelectionRequirement{}, fmt.Errorf("size %s conflicts with aspect_ratio %s", requirement.Size, requirement.AspectRatio)
			}
			requirement.Resolution = variant.Resolution
			requirement.AspectRatio = variant.AspectRatio
			break
		}
	}

	if applyModelDefaults && requirement.Resolution == "" && len(capabilities.Resolutions) > 0 {
		requirement.Resolution = strings.ToUpper(strings.TrimSpace(capabilities.DefaultResolution))
		if requirement.Resolution == "" && capabilities.SupportsResolution("1K") {
			requirement.Resolution = "1K"
		}
	}

	if applyModelDefaults && len(capabilities.ResolutionAspectVariants) > 0 && (hasResolution || hasAspectRatio) {
		if requirement.Resolution == "" {
			requirement.Resolution = "1K"
		}
		if requirement.AspectRatio == "" {
			requirement.AspectRatio = strings.ToLower(strings.TrimSpace(capabilities.DefaultAspectRatio))
			if requirement.AspectRatio == "" {
				requirement.AspectRatio = "1:1"
			}
		}
		if size, ok := capabilities.SizeFor(requirement.Resolution, requirement.AspectRatio); ok {
			if requirement.Size != "" && requirement.Size != size {
				return ImageSelectionRequirement{}, fmt.Errorf(
					"size %s conflicts with resolution %s and aspect_ratio %s",
					requirement.Size,
					requirement.Resolution,
					requirement.AspectRatio,
				)
			}
			requirement.Size = size
		}
	}

	normalized, err := requirement.Normalize()
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	return normalized, nil
}

func imageRequestProviderOutputCount(request *ImageRequest) (uint, bool, error) {
	if request == nil || len(request.Extra) == 0 {
		return 0, false, nil
	}
	type countLocation struct {
		container string
		key       string
	}
	locations := []countLocation{
		{key: "batch_size"},
		{key: "num_outputs"},
		{container: "parameters", key: "n"},
		{container: "parameters", key: "sampleCount"},
		{container: "parameters", key: "sample_count"},
		{container: "generationConfig", key: "candidateCount"},
		{container: "generationConfig", key: "candidate_count"},
		{container: "input", key: "num_outputs"},
		{container: "input", key: "n"},
	}
	selected := uint(0)
	found := false
	for _, location := range locations {
		container := request.Extra
		field := location.key
		if location.container != "" {
			rawContainer, ok := request.Extra[location.container]
			if !ok {
				continue
			}
			if common.GetJsonType(rawContainer) != "object" {
				return 0, false, fmt.Errorf("%s must be an object", location.container)
			}
			container = make(map[string]json.RawMessage)
			if err := common.Unmarshal(rawContainer, &container); err != nil {
				return 0, false, fmt.Errorf("%s must be an object", location.container)
			}
			field = location.container + "." + location.key
		}
		raw, ok := container[location.key]
		if !ok {
			continue
		}
		if common.GetJsonType(raw) != "number" {
			return 0, false, fmt.Errorf("%s must be an integer between 1 and %d", field, MaxImageN)
		}
		count, err := strconv.ParseUint(strings.TrimSpace(string(raw)), 10, 64)
		if err != nil || count == 0 || count > uint64(MaxImageN) {
			return 0, false, fmt.Errorf("%s must be an integer between 1 and %d", field, MaxImageN)
		}
		if uint(count) > selected {
			selected = uint(count)
		}
		found = true
	}
	return selected, found, nil
}

func imageRequestRawPresent(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && common.GetJsonType(trimmed) != "null"
}

func imageRequestRawString(raw json.RawMessage, field string) (string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
		return "", nil
	}
	if common.GetJsonType(trimmed) != "string" {
		return "", fmt.Errorf("%s must be a string", field)
	}
	var value string
	if err := common.Unmarshal(trimmed, &value); err != nil {
		return "", fmt.Errorf("%s must be a string: %w", field, err)
	}
	return strings.TrimSpace(value), nil
}

func imageRequestExtraString(request *ImageRequest, field string) (string, bool, error) {
	if request.Extra == nil {
		return "", false, nil
	}
	raw, exists := request.Extra[field]
	if !exists || common.GetJsonType(raw) == "null" {
		return "", false, nil
	}
	if common.GetJsonType(raw) != "string" {
		return "", true, fmt.Errorf("%s must be a string", field)
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return "", true, fmt.Errorf("%s must be a string: %w", field, err)
	}
	value = strings.TrimSpace(value)
	return value, value != "", nil
}
