package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const ImageRoutingVersion1 = 1

type ImageOperation string

const (
	ImageOperationGeneration ImageOperation = "generation"
	ImageOperationEdit       ImageOperation = "edit"
)

type ImageRoutingProtocol string

const (
	ImageRoutingProtocolImagesGenerations ImageRoutingProtocol = "images_generations"
	ImageRoutingProtocolImagesEdits       ImageRoutingProtocol = "images_edits"
	ImageRoutingProtocolResponsesSSE      ImageRoutingProtocol = "responses_sse"
	ImageRoutingProtocolGeminiGenerate    ImageRoutingProtocol = "gemini_generate_content"
	ImageRoutingProtocolImagenPredict     ImageRoutingProtocol = "imagen_predict"
	ImageRoutingProtocolAdapter           ImageRoutingProtocol = "adapter"
)

type ImageRoutingVerificationStatus string

const (
	ImageRoutingVerificationUnverified         ImageRoutingVerificationStatus = "unverified"
	ImageRoutingVerificationCodeMapped         ImageRoutingVerificationStatus = "code_mapped"
	ImageRoutingVerificationDocsClaimed        ImageRoutingVerificationStatus = "docs_claimed"
	ImageRoutingVerificationProductionVerified ImageRoutingVerificationStatus = "production_verified"
	ImageRoutingVerificationFailed             ImageRoutingVerificationStatus = "failed"
	ImageRoutingVerificationStale              ImageRoutingVerificationStatus = "stale"
)

type ImageRoutingConfig struct {
	Version  int                   `json:"version"`
	Profiles []ImageRoutingProfile `json:"profiles"`
}

type ImageRoutingProfile struct {
	Model               string                         `json:"model"`
	Protocol            ImageRoutingProtocol           `json:"protocol"`
	UpstreamPath        string                         `json:"upstream_path"`
	Operations          []ImageOperation               `json:"operations"`
	Resolutions         []string                       `json:"resolutions,omitempty"`
	AspectRatios        []string                       `json:"aspect_ratios,omitempty"`
	Sizes               []string                       `json:"sizes,omitempty"`
	Qualities           []string                       `json:"qualities,omitempty"`
	OutputFormats       []string                       `json:"output_formats,omitempty"`
	DefaultResolution   string                         `json:"default_resolution,omitempty"`
	DefaultAspectRatio  string                         `json:"default_aspect_ratio,omitempty"`
	DefaultSize         string                         `json:"default_size,omitempty"`
	DefaultQuality      string                         `json:"default_quality,omitempty"`
	DefaultOutputFormat string                         `json:"default_output_format,omitempty"`
	MaxOutputImages     int                            `json:"max_output_images,omitempty"`
	MaxReferenceImages  int                            `json:"max_reference_images,omitempty"`
	OptionalParameters  []string                       `json:"optional_parameters,omitempty"`
	Parameters          []ImageRoutingParameter        `json:"parameters,omitempty"`
	SupportsMask        bool                           `json:"supports_mask,omitempty"`
	OperationRoutes     []ImageRoutingOperationRoute   `json:"operation_routes,omitempty"`
	AllowedCombinations []ImageRoutingCombination      `json:"allowed_combinations,omitempty"`
	VerificationStatus  ImageRoutingVerificationStatus `json:"verification_status"`
}

type ImageRoutingOperationRoute struct {
	Operation    ImageOperation       `json:"operation"`
	Protocol     ImageRoutingProtocol `json:"protocol"`
	UpstreamPath string               `json:"upstream_path"`
}

type ImageRoutingParameter struct {
	Name        string          `json:"name"`
	Type        string          `json:"type"`
	Required    bool            `json:"required,omitempty"`
	Default     json.RawMessage `json:"default,omitempty"`
	EnumValues  []string        `json:"enum_values,omitempty"`
	Min         *int            `json:"min,omitempty"`
	Max         *int            `json:"max,omitempty"`
	MaxItems    *int            `json:"max_items,omitempty"`
	Description string          `json:"description,omitempty"`
}

type ImageRoutingCombination struct {
	Operation    ImageOperation `json:"operation,omitempty"`
	Resolution   string         `json:"resolution,omitempty"`
	AspectRatio  string         `json:"aspect_ratio,omitempty"`
	Size         string         `json:"size,omitempty"`
	Quality      string         `json:"quality,omitempty"`
	OutputFormat string         `json:"output_format,omitempty"`
}

// ImageSelectionRequirement is the canonical capability input shared by
// automatic selection, retries, and explicitly pinned channels.
type ImageSelectionRequirement struct {
	Operation           ImageOperation             `json:"operation"`
	Resolution          string                     `json:"resolution,omitempty"`
	AspectRatio         string                     `json:"aspect_ratio,omitempty"`
	Size                string                     `json:"size,omitempty"`
	Quality             string                     `json:"quality,omitempty"`
	OutputFormat        string                     `json:"output_format,omitempty"`
	N                   uint                       `json:"n"`
	ReferenceImageCount int                        `json:"reference_image_count,omitempty"`
	OptionalParameters  []string                   `json:"optional_parameters,omitempty"`
	OptionalValues      map[string]json.RawMessage `json:"optional_values,omitempty"`
	HasMask             bool                       `json:"has_mask,omitempty"`
}

var (
	imageResolutionPattern    = regexp.MustCompile(`^[1-9][0-9]*(?:K)?$`)
	imageAspectRatioPattern   = regexp.MustCompile(`^[1-9][0-9]*:[1-9][0-9]*$`)
	imageSizePattern          = regexp.MustCompile(`^[1-9][0-9]*x[1-9][0-9]*$`)
	imageQualityPattern       = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)
	imageOutputFormatPattern  = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)
	imageOptionalParamPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	imageProviderParamPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]*$`)
)

var verifiedImageOptionalParameters = map[string]struct{}{
	"background":         {},
	"moderation":         {},
	"output_compression": {},
	"watermark":          {},
}

func (requirement ImageSelectionRequirement) Normalize() (ImageSelectionRequirement, error) {
	optionalValues, valueNames, err := normalizeImageOptionalValues(requirement.OptionalValues)
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	optionalParameters, err := normalizeImageOptionalParameters(append(append([]string(nil), requirement.OptionalParameters...), valueNames...))
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	normalized := ImageSelectionRequirement{
		Operation:           normalizeImageOperation(requirement.Operation),
		Resolution:          normalizeImageResolution(requirement.Resolution),
		AspectRatio:         normalizeImageAspectRatio(requirement.AspectRatio),
		Size:                normalizeImageSize(requirement.Size),
		Quality:             normalizeImageQuality(requirement.Quality),
		OutputFormat:        normalizeImageOutputFormat(requirement.OutputFormat),
		N:                   requirement.N,
		ReferenceImageCount: requirement.ReferenceImageCount,
		OptionalParameters:  optionalParameters,
		OptionalValues:      optionalValues,
		HasMask:             requirement.HasMask,
	}
	if normalized.N == 0 {
		normalized.N = 1
	}
	if !isImageOperationAllowed(normalized.Operation) {
		return ImageSelectionRequirement{}, fmt.Errorf("operation must be generation or edit")
	}
	if normalized.Resolution != "" && normalized.Resolution != "auto" && !imageResolutionPattern.MatchString(normalized.Resolution) {
		return ImageSelectionRequirement{}, fmt.Errorf("resolution %q is invalid", requirement.Resolution)
	}
	if normalized.AspectRatio != "" && normalized.AspectRatio != "auto" && !imageAspectRatioPattern.MatchString(normalized.AspectRatio) {
		return ImageSelectionRequirement{}, fmt.Errorf("aspect_ratio %q is invalid", requirement.AspectRatio)
	}
	if normalized.Size != "" && normalized.Size != "auto" && !imageSizePattern.MatchString(normalized.Size) {
		return ImageSelectionRequirement{}, fmt.Errorf("size %q is invalid", requirement.Size)
	}
	if normalized.Quality != "" && !imageQualityPattern.MatchString(normalized.Quality) {
		return ImageSelectionRequirement{}, fmt.Errorf("quality %q is invalid", requirement.Quality)
	}
	if normalized.OutputFormat != "" && !imageOutputFormatPattern.MatchString(normalized.OutputFormat) {
		return ImageSelectionRequirement{}, fmt.Errorf("output_format %q is invalid", requirement.OutputFormat)
	}
	if normalized.N > MaxImageN {
		return ImageSelectionRequirement{}, fmt.Errorf("n must be between 1 and %d", MaxImageN)
	}
	if normalized.ReferenceImageCount < 0 || normalized.ReferenceImageCount > MaxUnifiedImageInputURLs {
		return ImageSelectionRequirement{}, fmt.Errorf("reference_image_count must be between 0 and %d", MaxUnifiedImageInputURLs)
	}
	return normalized, nil
}

func (requirement ImageSelectionRequirement) Validate() error {
	_, err := requirement.Normalize()
	return err
}

func (config *ImageRoutingConfig) Validate() error {
	if config == nil {
		return fmt.Errorf("image_routing is required")
	}
	if config.Version != ImageRoutingVersion1 {
		return fmt.Errorf("image_routing.version must be %d", ImageRoutingVersion1)
	}
	if len(config.Profiles) == 0 {
		return fmt.Errorf("image_routing requires at least one profile")
	}

	models := make(map[string]struct{}, len(config.Profiles))
	for i := range config.Profiles {
		profile := &config.Profiles[i]
		if err := profile.validate(i); err != nil {
			return err
		}
		modelKey := normalizeImageRoutingModel(profile.Model)
		if _, exists := models[modelKey]; exists {
			return fmt.Errorf("image_routing.profiles[%d].model is a duplicate model: %s", i, profile.Model)
		}
		models[modelKey] = struct{}{}
	}
	return nil
}

func (config *ImageRoutingConfig) ProfileForModel(model string) (*ImageRoutingProfile, bool) {
	if config == nil {
		return nil, false
	}
	model = normalizeImageRoutingModel(model)
	var fallback *ImageRoutingProfile
	for i := range config.Profiles {
		profile := &config.Profiles[i]
		profileModel := normalizeImageRoutingModel(profile.Model)
		if profileModel == model {
			return profile, true
		}
		if profileModel == "*" {
			fallback = profile
		}
	}
	return fallback, fallback != nil
}

// RouteForOperation resolves an operation-specific endpoint override and
// otherwise returns the profile's backwards-compatible default endpoint.
func (profile *ImageRoutingProfile) RouteForOperation(operation ImageOperation) (ImageRoutingProtocol, string, bool) {
	if profile == nil {
		return "", "", false
	}
	operation = normalizeImageOperation(operation)
	if !containsImageOperation(profile.Operations, operation) {
		return "", "", false
	}
	for _, route := range profile.OperationRoutes {
		if route.Operation == operation {
			return route.Protocol, route.UpstreamPath, true
		}
	}
	if profile.Protocol == "" || profile.UpstreamPath == "" {
		return "", "", false
	}
	return profile.Protocol, profile.UpstreamPath, true
}

func (config *ImageRoutingConfig) Supports(model string, requirement ImageSelectionRequirement) bool {
	profile, ok := config.ProfileForModel(model)
	if !ok || profile.VerificationStatus != ImageRoutingVerificationProductionVerified {
		return false
	}
	normalized, err := profile.ApplyDefaults(requirement)
	if err != nil {
		return false
	}
	if !containsImageOperation(profile.Operations, normalized.Operation) ||
		!matchesOptionalImageValue(profile.Resolutions, normalized.Resolution) ||
		!matchesOptionalImageValue(profile.AspectRatios, normalized.AspectRatio) ||
		!matchesOptionalImageValue(profile.Sizes, normalized.Size) ||
		!matchesOptionalImageValue(profile.Qualities, normalized.Quality) ||
		!matchesOptionalImageValue(profile.OutputFormats, normalized.OutputFormat) {
		return false
	}
	maxOutputImages := profile.MaxOutputImages
	if maxOutputImages == 0 {
		maxOutputImages = 1
	}
	if normalized.N > uint(maxOutputImages) {
		return false
	}
	maxReferenceImages := profile.MaxReferenceImages
	if maxReferenceImages == 0 && normalized.Operation == ImageOperationEdit && containsImageOperation(profile.Operations, ImageOperationEdit) {
		maxReferenceImages = 1
	}
	if normalized.ReferenceImageCount > maxReferenceImages {
		return false
	}
	if normalized.HasMask && !profile.SupportsMask {
		return false
	}
	for _, parameter := range normalized.OptionalParameters {
		if containsImageString(profile.OptionalParameters, parameter) {
			continue
		}
		definition, ok := profile.imageRoutingParameter(parameter)
		if !ok {
			return false
		}
		raw, ok := normalized.OptionalValues[parameter]
		if !ok || !definition.matches(raw) {
			return false
		}
	}
	for _, parameter := range profile.Parameters {
		if !parameter.Required {
			continue
		}
		raw, ok := normalized.OptionalValues[canonicalImageOptionalParameterName(parameter.Name)]
		if !ok || !parameter.matches(raw) {
			return false
		}
	}
	if profile.AllowedCombinations == nil {
		return true
	}
	for _, combination := range profile.AllowedCombinations {
		if combination.matches(normalized) {
			return true
		}
	}
	return false
}

// ApplyDefaults freezes provider defaults into the canonical request so
// selection, billing, durable execution, and output validation share one
// explicit contract.
func (profile *ImageRoutingProfile) ApplyDefaults(requirement ImageSelectionRequirement) (ImageSelectionRequirement, error) {
	normalized, err := requirement.Normalize()
	if err != nil {
		return ImageSelectionRequirement{}, err
	}
	if profile == nil {
		return normalized, nil
	}
	profile.inferUniqueCombinationValues(&normalized)
	if normalized.Resolution == "" {
		normalized.Resolution = imageRoutingDefaultValue(profile.DefaultResolution, profile.Resolutions)
	}
	profile.inferUniqueCombinationValues(&normalized)
	if normalized.AspectRatio == "" {
		normalized.AspectRatio = imageRoutingDefaultValue(profile.DefaultAspectRatio, profile.AspectRatios)
	}
	profile.inferUniqueCombinationValues(&normalized)
	if normalized.Size == "" {
		normalized.Size = imageRoutingDefaultValue(profile.DefaultSize, profile.Sizes)
	}
	profile.inferUniqueCombinationValues(&normalized)
	if normalized.Quality == "" {
		normalized.Quality = imageRoutingDefaultValue(profile.DefaultQuality, profile.Qualities)
	}
	profile.inferUniqueCombinationValues(&normalized)
	if normalized.OutputFormat == "" {
		normalized.OutputFormat = imageRoutingDefaultValue(profile.DefaultOutputFormat, profile.OutputFormats)
	}
	profile.inferUniqueCombinationValues(&normalized)
	for _, parameter := range profile.Parameters {
		if len(bytes.TrimSpace(parameter.Default)) == 0 || common.GetJsonType(parameter.Default) == "null" {
			continue
		}
		parameterName := canonicalImageOptionalParameterName(parameter.Name)
		if _, exists := normalized.OptionalValues[parameterName]; exists {
			continue
		}
		if normalized.OptionalValues == nil {
			normalized.OptionalValues = make(map[string]json.RawMessage)
		}
		normalized.OptionalValues[parameterName] = append(json.RawMessage(nil), bytes.TrimSpace(parameter.Default)...)
		normalized.OptionalParameters = append(normalized.OptionalParameters, parameterName)
	}
	return normalized.Normalize()
}

func (profile *ImageRoutingProfile) inferUniqueCombinationValues(requirement *ImageSelectionRequirement) {
	if profile == nil || requirement == nil || len(profile.AllowedCombinations) == 0 {
		return
	}
	for range 5 {
		candidates := make([]ImageRoutingCombination, 0, len(profile.AllowedCombinations))
		for _, combination := range profile.AllowedCombinations {
			if combination.matches(*requirement) {
				candidates = append(candidates, combination)
			}
		}
		if len(candidates) == 0 || !fillUniqueImageCombinationValues(requirement, candidates) {
			return
		}
	}
}

func fillUniqueImageCombinationValues(requirement *ImageSelectionRequirement, combinations []ImageRoutingCombination) bool {
	changed := false
	fields := []struct {
		target *string
		value  func(ImageRoutingCombination) string
	}{
		{target: &requirement.Resolution, value: func(combination ImageRoutingCombination) string { return combination.Resolution }},
		{target: &requirement.AspectRatio, value: func(combination ImageRoutingCombination) string { return combination.AspectRatio }},
		{target: &requirement.Size, value: func(combination ImageRoutingCombination) string { return combination.Size }},
		{target: &requirement.Quality, value: func(combination ImageRoutingCombination) string { return combination.Quality }},
		{target: &requirement.OutputFormat, value: func(combination ImageRoutingCombination) string { return combination.OutputFormat }},
	}
	for _, field := range fields {
		if *field.target != "" {
			continue
		}
		value := field.value(combinations[0])
		if value == "" {
			continue
		}
		unique := true
		for _, combination := range combinations[1:] {
			if field.value(combination) != value {
				unique = false
				break
			}
		}
		if unique {
			*field.target = value
			changed = true
		}
	}
	return changed
}

func (profile *ImageRoutingProfile) validate(index int) error {
	prefix := fmt.Sprintf("image_routing.profiles[%d]", index)
	if profile.Model == "" || strings.TrimSpace(profile.Model) != profile.Model {
		return fmt.Errorf("%s.model is required and must not have surrounding whitespace", prefix)
	}
	if len(profile.Model) > 255 {
		return fmt.Errorf("%s.model is too long", prefix)
	}
	hasDefaultRoute := strings.TrimSpace(string(profile.Protocol)) != "" || strings.TrimSpace(profile.UpstreamPath) != ""
	if hasDefaultRoute {
		if err := ValidateImageRoutingEndpoint(profile.Protocol, profile.UpstreamPath); err != nil {
			if !isImageRoutingProtocolAllowed(profile.Protocol) {
				return fmt.Errorf("%s.protocol is invalid: %s", prefix, profile.Protocol)
			}
			return fmt.Errorf("%s.upstream_path: %w", prefix, err)
		}
	}
	if len(profile.Operations) == 0 {
		return fmt.Errorf("%s.operations requires at least one operation", prefix)
	}
	seenOperations := make(map[ImageOperation]struct{}, len(profile.Operations))
	for _, operation := range profile.Operations {
		if !isImageOperationAllowed(operation) {
			return fmt.Errorf("%s.operations contains invalid operation %q", prefix, operation)
		}
		if _, exists := seenOperations[operation]; exists {
			return fmt.Errorf("%s.operations contains duplicate operation %q", prefix, operation)
		}
		seenOperations[operation] = struct{}{}
	}
	if !isImageRoutingVerificationStatusAllowed(profile.VerificationStatus) {
		return fmt.Errorf("%s.verification_status is invalid: %s", prefix, profile.VerificationStatus)
	}

	if err := validateCanonicalImageValues(prefix+".resolutions", profile.Resolutions, normalizeImageResolution, validImageResolution); err != nil {
		return err
	}
	if err := validateCanonicalImageValues(prefix+".aspect_ratios", profile.AspectRatios, normalizeImageAspectRatio, validImageAspectRatio); err != nil {
		return err
	}
	if err := validateCanonicalImageValues(prefix+".sizes", profile.Sizes, normalizeImageSize, validImageSize); err != nil {
		return err
	}
	if err := validateCanonicalImageValues(prefix+".qualities", profile.Qualities, normalizeImageQuality, validImageQuality); err != nil {
		return err
	}
	if err := validateCanonicalImageValues(prefix+".output_formats", profile.OutputFormats, normalizeImageOutputFormat, validImageOutputFormat); err != nil {
		return err
	}
	if profile.VerificationStatus == ImageRoutingVerificationProductionVerified {
		for _, resolution := range profile.Resolutions {
			if resolution == "auto" {
				return fmt.Errorf("%s.resolutions cannot contain auto because verified resolution tiers require explicit pricing", prefix)
			}
		}
		for _, outputFormat := range profile.OutputFormats {
			switch outputFormat {
			case "png", "jpeg", "webp", "gif":
			default:
				return fmt.Errorf("%s.output_formats contains %q, which the image result decoder does not support", prefix, outputFormat)
			}
		}
	}
	defaults := []struct {
		name      string
		value     string
		declared  []string
		normalize func(string) string
	}{
		{name: "default_resolution", value: profile.DefaultResolution, declared: profile.Resolutions, normalize: normalizeImageResolution},
		{name: "default_aspect_ratio", value: profile.DefaultAspectRatio, declared: profile.AspectRatios, normalize: normalizeImageAspectRatio},
		{name: "default_size", value: profile.DefaultSize, declared: profile.Sizes, normalize: normalizeImageSize},
		{name: "default_quality", value: profile.DefaultQuality, declared: profile.Qualities, normalize: normalizeImageQuality},
		{name: "default_output_format", value: profile.DefaultOutputFormat, declared: profile.OutputFormats, normalize: normalizeImageOutputFormat},
	}
	for _, item := range defaults {
		if item.value != item.normalize(item.value) {
			return fmt.Errorf("%s.%s must use a canonical value", prefix, item.name)
		}
		if item.value != "" {
			if err := validateDeclaredImageValue(prefix+"."+item.name, item.declared, item.value); err != nil {
				return err
			}
		}
		if profile.VerificationStatus == ImageRoutingVerificationProductionVerified && len(item.declared) > 1 && item.value == "" {
			return fmt.Errorf("%s.%s is required when a verified profile declares multiple values", prefix, item.name)
		}
	}
	if profile.MaxOutputImages < 0 || profile.MaxOutputImages > MaxImageN {
		return fmt.Errorf("%s.max_output_images must be between 1 and %d when provided", prefix, MaxImageN)
	}
	if profile.MaxReferenceImages < 0 || profile.MaxReferenceImages > MaxUnifiedImageInputURLs {
		return fmt.Errorf("%s.max_reference_images must be between 0 and %d", prefix, MaxUnifiedImageInputURLs)
	}
	if profile.MaxReferenceImages > 0 && !containsImageOperation(profile.Operations, ImageOperationEdit) {
		return fmt.Errorf("%s.max_reference_images requires the edit operation", prefix)
	}
	if err := validateImageRoutingParameters(prefix, profile.Parameters, profile.VerificationStatus); err != nil {
		return err
	}
	if err := validateImageRoutingOptionalParameters(prefix, profile.OptionalParameters, profile.Parameters, profile.VerificationStatus); err != nil {
		return err
	}
	if profile.OperationRoutes != nil && len(profile.OperationRoutes) == 0 {
		return fmt.Errorf("%s.operation_routes must be omitted or contain at least one route", prefix)
	}
	seenOperationRoutes := make(map[ImageOperation]struct{}, len(profile.OperationRoutes))
	for i, route := range profile.OperationRoutes {
		routePrefix := fmt.Sprintf("%s.operation_routes[%d]", prefix, i)
		if route.Operation != normalizeImageOperation(route.Operation) || !isImageOperationAllowed(route.Operation) {
			return fmt.Errorf("%s.operation is invalid or not canonical", routePrefix)
		}
		if !containsImageOperation(profile.Operations, route.Operation) {
			return fmt.Errorf("%s.operation is not declared by the profile", routePrefix)
		}
		if _, exists := seenOperationRoutes[route.Operation]; exists {
			return fmt.Errorf("%s.operation duplicates %q", routePrefix, route.Operation)
		}
		seenOperationRoutes[route.Operation] = struct{}{}
		if err := ValidateImageRoutingEndpoint(route.Protocol, route.UpstreamPath); err != nil {
			return fmt.Errorf("%s: %w", routePrefix, err)
		}
	}
	if !hasDefaultRoute {
		for _, operation := range profile.Operations {
			if _, exists := seenOperationRoutes[operation]; !exists {
				return fmt.Errorf("%s.operation_routes must define a route for %q when no default endpoint is configured", prefix, operation)
			}
		}
	}
	for _, operation := range profile.Operations {
		protocol, _, ok := profile.RouteForOperation(operation)
		if !ok {
			return fmt.Errorf("%s has no route for operation %q", prefix, operation)
		}
		if protocol == ImageRoutingProtocolImagesEdits && operation != ImageOperationEdit {
			return fmt.Errorf("%s protocol images_edits is valid only for the edit operation", prefix)
		}
		if protocol == ImageRoutingProtocolImagenPredict && operation != ImageOperationGeneration {
			return fmt.Errorf("%s protocol imagen_predict is valid only for the generation operation", prefix)
		}
		if len(profile.Parameters) > 0 && protocol == ImageRoutingProtocolResponsesSSE {
			return fmt.Errorf("%s.parameters are not supported by responses_sse routes", prefix)
		}
		for _, parameter := range profile.OptionalParameters {
			if !imageRoutingProtocolSupportsOptionalParameter(protocol, parameter) {
				return fmt.Errorf("%s optional parameter %q is not supported by %s routes", prefix, parameter, protocol)
			}
		}
		if len(profile.Parameters) > 0 && operation == ImageOperationEdit &&
			(protocol == ImageRoutingProtocolImagesEdits || protocol == ImageRoutingProtocolAdapter) {
			for _, parameter := range profile.Parameters {
				if parameter.Type == "array" || parameter.Type == "object" {
					return fmt.Errorf("%s parameter %q must be scalar for multipart edit routes", prefix, parameter.Name)
				}
			}
		}
	}
	if profile.SupportsMask {
		if !containsImageOperation(profile.Operations, ImageOperationEdit) {
			return fmt.Errorf("%s.supports_mask requires the edit operation", prefix)
		}
		editProtocol, _, ok := profile.RouteForOperation(ImageOperationEdit)
		if !ok {
			return fmt.Errorf("%s.supports_mask requires a valid edit route", prefix)
		}
		if editProtocol != ImageRoutingProtocolImagesEdits {
			return fmt.Errorf("%s.supports_mask requires an images_edits route", prefix)
		}
	}
	if profile.AllowedCombinations != nil && len(profile.AllowedCombinations) == 0 {
		return fmt.Errorf("%s.allowed_combinations must be omitted or contain at least one combination", prefix)
	}
	if profile.VerificationStatus == ImageRoutingVerificationProductionVerified && len(profile.AllowedCombinations) == 0 {
		return fmt.Errorf("%s.allowed_combinations is required for a production_verified profile", prefix)
	}

	seenCombinations := make(map[ImageRoutingCombination]struct{}, len(profile.AllowedCombinations))
	for i, combination := range profile.AllowedCombinations {
		combinationPrefix := fmt.Sprintf("%s.allowed_combinations[%d]", prefix, i)
		normalized, err := combination.normalize()
		if err != nil {
			return fmt.Errorf("%s: %w", combinationPrefix, err)
		}
		if normalized != combination {
			return fmt.Errorf("%s must use canonical values", combinationPrefix)
		}
		if normalized == (ImageRoutingCombination{}) {
			return fmt.Errorf("%s must constrain at least one field", combinationPrefix)
		}
		if normalized.Operation != "" && !containsImageOperation(profile.Operations, normalized.Operation) {
			return fmt.Errorf("%s.operation is not declared by the profile", combinationPrefix)
		}
		if err := validateDeclaredImageValue(combinationPrefix+".resolution", profile.Resolutions, normalized.Resolution); err != nil {
			return err
		}
		if err := validateDeclaredImageValue(combinationPrefix+".aspect_ratio", profile.AspectRatios, normalized.AspectRatio); err != nil {
			return err
		}
		if err := validateDeclaredImageValue(combinationPrefix+".size", profile.Sizes, normalized.Size); err != nil {
			return err
		}
		if err := validateDeclaredImageValue(combinationPrefix+".quality", profile.Qualities, normalized.Quality); err != nil {
			return err
		}
		if err := validateDeclaredImageValue(combinationPrefix+".output_format", profile.OutputFormats, normalized.OutputFormat); err != nil {
			return err
		}
		if err := validateImageRoutingCombinationGeometry(normalized.Size, normalized.AspectRatio); err != nil {
			return fmt.Errorf("%s: %w", combinationPrefix, err)
		}
		if _, exists := seenCombinations[normalized]; exists {
			return fmt.Errorf("%s is duplicated", combinationPrefix)
		}
		seenCombinations[normalized] = struct{}{}
	}
	if profile.VerificationStatus == ImageRoutingVerificationProductionVerified {
		for _, operation := range profile.Operations {
			defaultRequirement, err := profile.ApplyDefaults(ImageSelectionRequirement{Operation: operation, N: 1})
			if err != nil {
				return fmt.Errorf("%s default image tuple is invalid: %w", prefix, err)
			}
			matched := false
			for _, combination := range profile.AllowedCombinations {
				if combination.matches(defaultRequirement) {
					matched = true
					break
				}
			}
			if !matched {
				return fmt.Errorf("%s default image tuple for operation %q does not match allowed_combinations", prefix, operation)
			}
		}
	}
	if profile.VerificationStatus == ImageRoutingVerificationProductionVerified && len(profile.Resolutions) > 0 {
		coveredResolutions := make(map[string]struct{}, len(profile.Resolutions))
		coveredSizes := make(map[string]struct{}, len(profile.Sizes))
		for i, combination := range profile.AllowedCombinations {
			if combination.Resolution == "" || !imageSizePattern.MatchString(combination.Size) {
				return fmt.Errorf("%s.allowed_combinations[%d] must bind resolution to an exact size for output verification", prefix, i)
			}
			coveredResolutions[combination.Resolution] = struct{}{}
			coveredSizes[combination.Size] = struct{}{}
		}
		for _, resolution := range profile.Resolutions {
			if _, ok := coveredResolutions[resolution]; !ok {
				return fmt.Errorf("%s.resolution %q is not covered by an exact-size combination", prefix, resolution)
			}
		}
		for _, size := range profile.Sizes {
			if _, ok := coveredSizes[size]; !ok {
				return fmt.Errorf("%s.size %q is not covered by a resolution combination", prefix, size)
			}
		}
	}
	if profile.VerificationStatus == ImageRoutingVerificationProductionVerified {
		coverageFields := []struct {
			name     string
			declared []string
			value    func(ImageRoutingCombination) string
		}{
			{name: "resolution", declared: profile.Resolutions, value: func(combination ImageRoutingCombination) string { return combination.Resolution }},
			{name: "aspect_ratio", declared: profile.AspectRatios, value: func(combination ImageRoutingCombination) string { return combination.AspectRatio }},
			{name: "size", declared: profile.Sizes, value: func(combination ImageRoutingCombination) string { return combination.Size }},
			{name: "quality", declared: profile.Qualities, value: func(combination ImageRoutingCombination) string { return combination.Quality }},
			{name: "output_format", declared: profile.OutputFormats, value: func(combination ImageRoutingCombination) string { return combination.OutputFormat }},
		}
		for _, field := range coverageFields {
			if err := validateImageRoutingCombinationCoverage(prefix, field.name, field.declared, profile.AllowedCombinations, field.value); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateImageRoutingCombinationCoverage(
	prefix string,
	field string,
	declared []string,
	combinations []ImageRoutingCombination,
	value func(ImageRoutingCombination) string,
) error {
	if len(declared) == 0 {
		return nil
	}
	covered := make(map[string]struct{}, len(declared))
	for _, combination := range combinations {
		combinationValue := value(combination)
		if combinationValue == "" {
			return nil
		}
		covered[combinationValue] = struct{}{}
	}
	for _, declaredValue := range declared {
		if _, ok := covered[declaredValue]; !ok {
			return fmt.Errorf("%s.%s %q is not covered by allowed_combinations", prefix, field, declaredValue)
		}
	}
	return nil
}

func imageRoutingProtocolSupportsOptionalParameter(protocol ImageRoutingProtocol, parameter string) bool {
	switch protocol {
	case ImageRoutingProtocolResponsesSSE:
		return parameter == "output_compression" || parameter == "background" || parameter == "moderation"
	case ImageRoutingProtocolGeminiGenerate, ImageRoutingProtocolImagenPredict:
		return false
	case ImageRoutingProtocolImagesGenerations, ImageRoutingProtocolImagesEdits:
		return true
	case ImageRoutingProtocolAdapter:
		// Adapter implementations differ by channel. Built-in optional fields
		// cannot be guaranteed to reach the upstream request; use a typed
		// provider parameter on a verified route instead.
		return false
	default:
		return false
	}
}

func validateImageRoutingCombinationGeometry(size, aspectRatio string) error {
	if size == "" || size == "auto" || aspectRatio == "" || aspectRatio == "auto" {
		return nil
	}
	widthText, heightText, _ := strings.Cut(size, "x")
	aspectWidthText, aspectHeightText, _ := strings.Cut(aspectRatio, ":")
	width, widthErr := strconv.Atoi(widthText)
	height, heightErr := strconv.Atoi(heightText)
	aspectWidth, aspectWidthErr := strconv.Atoi(aspectWidthText)
	aspectHeight, aspectHeightErr := strconv.Atoi(aspectHeightText)
	if widthErr != nil || heightErr != nil || aspectWidthErr != nil || aspectHeightErr != nil ||
		width <= 0 || height <= 0 || aspectWidth <= 0 || aspectHeight <= 0 {
		return fmt.Errorf("size %q or aspect_ratio %q is invalid", size, aspectRatio)
	}
	actualRatio := float64(width) / float64(height)
	expectedRatio := float64(aspectWidth) / float64(aspectHeight)
	if math.Abs(actualRatio/expectedRatio-1) > 0.01 {
		return fmt.Errorf("size %q conflicts with aspect_ratio %q", size, aspectRatio)
	}
	return nil
}

func (combination ImageRoutingCombination) normalize() (ImageRoutingCombination, error) {
	normalized := ImageRoutingCombination{
		Operation:    normalizeImageOperation(combination.Operation),
		Resolution:   normalizeImageResolution(combination.Resolution),
		AspectRatio:  normalizeImageAspectRatio(combination.AspectRatio),
		Size:         normalizeImageSize(combination.Size),
		Quality:      normalizeImageQuality(combination.Quality),
		OutputFormat: normalizeImageOutputFormat(combination.OutputFormat),
	}
	if normalized.Operation != "" && !isImageOperationAllowed(normalized.Operation) {
		return ImageRoutingCombination{}, fmt.Errorf("operation is invalid")
	}
	if !validImageResolution(normalized.Resolution) {
		return ImageRoutingCombination{}, fmt.Errorf("resolution is invalid")
	}
	if !validImageAspectRatio(normalized.AspectRatio) {
		return ImageRoutingCombination{}, fmt.Errorf("aspect_ratio is invalid")
	}
	if !validImageSize(normalized.Size) {
		return ImageRoutingCombination{}, fmt.Errorf("size is invalid")
	}
	if !validImageQuality(normalized.Quality) {
		return ImageRoutingCombination{}, fmt.Errorf("quality is invalid")
	}
	if !validImageOutputFormat(normalized.OutputFormat) {
		return ImageRoutingCombination{}, fmt.Errorf("output_format is invalid")
	}
	return normalized, nil
}

func (combination ImageRoutingCombination) matches(requirement ImageSelectionRequirement) bool {
	return (combination.Operation == "" || combination.Operation == requirement.Operation) &&
		(requirement.Resolution == "" || combination.Resolution == "" || combination.Resolution == requirement.Resolution) &&
		(requirement.AspectRatio == "" || combination.AspectRatio == "" || combination.AspectRatio == requirement.AspectRatio) &&
		(requirement.Size == "" || combination.Size == "" || combination.Size == requirement.Size) &&
		(requirement.Quality == "" || combination.Quality == "" || combination.Quality == requirement.Quality) &&
		(requirement.OutputFormat == "" || combination.OutputFormat == "" || combination.OutputFormat == requirement.OutputFormat)
}

func validateCanonicalImageValues(name string, values []string, normalize func(string) string, valid func(string) bool) error {
	if values == nil {
		return nil
	}
	if len(values) == 0 {
		return fmt.Errorf("%s must be omitted or contain at least one value", name)
	}
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := normalize(value)
		if normalized != value {
			return fmt.Errorf("%s value %q is not canonical", name, value)
		}
		if !valid(normalized) {
			return fmt.Errorf("%s contains invalid value %q", name, value)
		}
		if _, exists := seen[normalized]; exists {
			return fmt.Errorf("%s contains duplicate value %q", name, value)
		}
		seen[normalized] = struct{}{}
	}
	return nil
}

func validateDeclaredImageValue(name string, declared []string, value string) error {
	if value == "" {
		return nil
	}
	for _, candidate := range declared {
		if candidate == value {
			return nil
		}
	}
	return fmt.Errorf("%s %q is not declared by the profile", name, value)
}

func validateImageRoutingUpstreamPath(protocol ImageRoutingProtocol, path string) error {
	if path == "" || strings.TrimSpace(path) != path || !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		return fmt.Errorf("must be an absolute path beginning with /")
	}
	if strings.ContainsAny(path, "?#") {
		return fmt.Errorf("must not include query or fragment")
	}
	switch protocol {
	case ImageRoutingProtocolImagesGenerations:
		if !strings.HasSuffix(path, "/images/generations") {
			return fmt.Errorf("must target an images generations endpoint")
		}
	case ImageRoutingProtocolImagesEdits:
		if !strings.HasSuffix(path, "/images/edits") {
			return fmt.Errorf("must target an images edits endpoint")
		}
	case ImageRoutingProtocolResponsesSSE:
		if !strings.HasSuffix(path, "/responses") {
			return fmt.Errorf("must target a responses endpoint")
		}
	case ImageRoutingProtocolGeminiGenerate:
		if !strings.Contains(path, "/models/") || !strings.HasSuffix(path, ":generateContent") {
			return fmt.Errorf("must target a Gemini generateContent endpoint")
		}
	case ImageRoutingProtocolImagenPredict:
		if !strings.Contains(path, "/models/") || !strings.HasSuffix(path, ":predict") {
			return fmt.Errorf("must target an Imagen predict endpoint")
		}
	case ImageRoutingProtocolAdapter:
		return nil
	}
	return nil
}

// ValidateImageRoutingEndpoint validates the protocol/path pair stored in a
// channel profile or durable async task snapshot.
func ValidateImageRoutingEndpoint(protocol ImageRoutingProtocol, path string) error {
	if !isImageRoutingProtocolAllowed(protocol) {
		return fmt.Errorf("unsupported image routing protocol %q", protocol)
	}
	return validateImageRoutingUpstreamPath(protocol, path)
}

func matchesOptionalImageValue(allowed []string, value string) bool {
	if value == "" {
		return true
	}
	if allowed == nil {
		return false
	}
	for _, candidate := range allowed {
		if candidate == value {
			return true
		}
	}
	return false
}

func containsImageString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

func (profile *ImageRoutingProfile) imageRoutingParameter(name string) (ImageRoutingParameter, bool) {
	if profile == nil {
		return ImageRoutingParameter{}, false
	}
	for _, parameter := range profile.Parameters {
		if canonicalImageOptionalParameterName(parameter.Name) == name {
			return parameter, true
		}
	}
	return ImageRoutingParameter{}, false
}

func normalizeImageOptionalParameters(values []string) ([]string, error) {
	if len(values) == 0 {
		return nil, nil
	}
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = canonicalImageOptionalParameterName(value)
		if value == "" || !imageOptionalParamPattern.MatchString(value) {
			return nil, fmt.Errorf("optional parameter %q is invalid", value)
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	sort.Strings(normalized)
	return normalized, nil
}

func normalizeImageOptionalValues(values map[string]json.RawMessage) (map[string]json.RawMessage, []string, error) {
	if len(values) == 0 {
		return nil, nil, nil
	}
	normalized := make(map[string]json.RawMessage, len(values))
	names := make([]string, 0, len(values))
	for name, raw := range values {
		normalizedName := canonicalImageOptionalParameterName(name)
		if normalizedName == "" || !imageOptionalParamPattern.MatchString(normalizedName) {
			return nil, nil, fmt.Errorf("optional parameter %q is invalid", name)
		}
		trimmed := bytes.TrimSpace(raw)
		if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
			continue
		}
		if _, exists := normalized[normalizedName]; exists {
			return nil, nil, fmt.Errorf("optional parameter aliases collide at %q", normalizedName)
		}
		normalized[normalizedName] = append(json.RawMessage(nil), trimmed...)
		names = append(names, normalizedName)
	}
	if len(normalized) == 0 {
		return nil, nil, nil
	}
	sort.Strings(names)
	return normalized, names, nil
}

func canonicalImageOptionalParameterName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	var builder strings.Builder
	builder.Grow(len(value) + 4)
	previousWasUnderscore := false
	for index, char := range value {
		switch {
		case char >= 'a' && char <= 'z', char >= '0' && char <= '9':
			builder.WriteRune(char)
			previousWasUnderscore = false
		case char >= 'A' && char <= 'Z':
			if index > 0 && !previousWasUnderscore {
				builder.WriteByte('_')
			}
			builder.WriteRune(char + ('a' - 'A'))
			previousWasUnderscore = false
		case char == '_' || char == '-':
			if builder.Len() > 0 && !previousWasUnderscore {
				builder.WriteByte('_')
				previousWasUnderscore = true
			}
		default:
			return ""
		}
	}
	return strings.TrimSuffix(builder.String(), "_")
}

// CanonicalImageRoutingParameterName returns the model-neutral lookup key used
// for provider parameter aliases while profiles retain their original JSON
// field names for upstream materialization.
func CanonicalImageRoutingParameterName(value string) string {
	return canonicalImageOptionalParameterName(value)
}

func validateImageRoutingOptionalParameters(prefix string, values []string, parameters []ImageRoutingParameter, status ImageRoutingVerificationStatus) error {
	if values != nil && len(values) == 0 {
		return fmt.Errorf("%s.optional_parameters must be omitted or contain at least one value", prefix)
	}
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := strings.ToLower(strings.TrimSpace(value))
		if value != normalized || !imageOptionalParamPattern.MatchString(value) {
			return fmt.Errorf("%s.optional_parameters value %q is not canonical snake_case", prefix, value)
		}
		if _, exists := seen[value]; exists {
			return fmt.Errorf("%s.optional_parameters contains duplicate value %q", prefix, value)
		}
		seen[value] = struct{}{}
		for _, parameter := range parameters {
			if canonicalImageOptionalParameterName(parameter.Name) == value {
				return fmt.Errorf("%s.optional_parameters duplicates parameters entry %q", prefix, value)
			}
		}
		if status == ImageRoutingVerificationProductionVerified {
			if _, known := verifiedImageOptionalParameters[value]; !known {
				return fmt.Errorf("%s.optional_parameters contains unsupported verified parameter %q", prefix, value)
			}
		}
	}
	return nil
}

var imageRoutingCoreParameterNames = map[string]struct{}{
	"model": {}, "prompt": {}, "image_input": {}, "aspect_ratio": {}, "resolution": {},
	"size": {}, "quality": {}, "n": {}, "output_format": {},
	"response_format": {}, "webhook_url": {}, "webhook_secret": {},
}

func validateImageRoutingParameters(prefix string, parameters []ImageRoutingParameter, status ImageRoutingVerificationStatus) error {
	if parameters != nil && len(parameters) == 0 {
		return fmt.Errorf("%s.parameters must be omitted or contain at least one value", prefix)
	}
	seen := make(map[string]struct{}, len(parameters))
	for i, parameter := range parameters {
		parameterPrefix := fmt.Sprintf("%s.parameters[%d]", prefix, i)
		if parameter.Name != strings.TrimSpace(parameter.Name) || !imageProviderParamPattern.MatchString(parameter.Name) {
			return fmt.Errorf("%s.name must be a JSON field name without surrounding whitespace", parameterPrefix)
		}
		canonicalName := canonicalImageOptionalParameterName(parameter.Name)
		if _, reserved := imageRoutingCoreParameterNames[canonicalName]; reserved {
			return fmt.Errorf("%s.name %q is a core image parameter", parameterPrefix, parameter.Name)
		}
		if _, exists := seen[canonicalName]; exists {
			return fmt.Errorf("%s.name duplicates %q", parameterPrefix, parameter.Name)
		}
		seen[canonicalName] = struct{}{}
		switch parameter.Type {
		case "string", "boolean", "integer", "number", "enum", "array", "object":
		default:
			return fmt.Errorf("%s.type %q is unsupported", parameterPrefix, parameter.Type)
		}
		if parameter.Type == "enum" {
			if len(parameter.EnumValues) == 0 {
				return fmt.Errorf("%s.enum_values requires at least one value", parameterPrefix)
			}
			values := make(map[string]struct{}, len(parameter.EnumValues))
			for _, value := range parameter.EnumValues {
				if value == "" || strings.TrimSpace(value) != value {
					return fmt.Errorf("%s.enum_values contains an invalid value", parameterPrefix)
				}
				if _, exists := values[value]; exists {
					return fmt.Errorf("%s.enum_values contains duplicate value %q", parameterPrefix, value)
				}
				values[value] = struct{}{}
			}
		} else if len(parameter.EnumValues) > 0 {
			return fmt.Errorf("%s.enum_values requires type enum", parameterPrefix)
		}
		if parameter.Min != nil || parameter.Max != nil {
			if parameter.Type != "integer" && parameter.Type != "number" {
				return fmt.Errorf("%s min/max requires an integer or number type", parameterPrefix)
			}
			if parameter.Min != nil && parameter.Max != nil && *parameter.Min > *parameter.Max {
				return fmt.Errorf("%s.min must not exceed max", parameterPrefix)
			}
		}
		if parameter.MaxItems != nil {
			if parameter.Type != "array" || *parameter.MaxItems <= 0 {
				return fmt.Errorf("%s.max_items requires an array type and a positive value", parameterPrefix)
			}
		}
		if status == ImageRoutingVerificationProductionVerified && strings.TrimSpace(parameter.Description) == "" {
			return fmt.Errorf("%s.description is required for a production_verified profile", parameterPrefix)
		}
		if raw := bytes.TrimSpace(parameter.Default); len(raw) > 0 && common.GetJsonType(raw) != "null" && !parameter.matches(raw) {
			return fmt.Errorf("%s.default does not satisfy its declared type or bounds", parameterPrefix)
		}
	}
	return nil
}

func (parameter ImageRoutingParameter) matches(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || common.GetJsonType(trimmed) == "null" {
		return false
	}
	switch parameter.Type {
	case "string":
		return common.GetJsonType(trimmed) == "string"
	case "boolean":
		return common.GetJsonType(trimmed) == "boolean"
	case "integer", "number":
		if common.GetJsonType(trimmed) != "number" {
			return false
		}
		var value float64
		if err := common.Unmarshal(trimmed, &value); err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
			return false
		}
		if parameter.Type == "integer" && math.Trunc(value) != value {
			return false
		}
		if parameter.Min != nil && value < float64(*parameter.Min) {
			return false
		}
		return parameter.Max == nil || value <= float64(*parameter.Max)
	case "enum":
		if common.GetJsonType(trimmed) != "string" {
			return false
		}
		var value string
		if err := common.Unmarshal(trimmed, &value); err != nil {
			return false
		}
		return containsImageString(parameter.EnumValues, value)
	case "array":
		if common.GetJsonType(trimmed) != "array" {
			return false
		}
		if parameter.MaxItems == nil {
			return true
		}
		var values []json.RawMessage
		return common.Unmarshal(trimmed, &values) == nil && len(values) <= *parameter.MaxItems
	case "object":
		return common.GetJsonType(trimmed) == "object"
	default:
		return false
	}
}

func imageRoutingDefaultValue(configured string, allowed []string) string {
	if configured != "" {
		return configured
	}
	if len(allowed) == 1 {
		return allowed[0]
	}
	return ""
}

func containsImageOperation(operations []ImageOperation, operation ImageOperation) bool {
	for _, candidate := range operations {
		if candidate == operation {
			return true
		}
	}
	return false
}

func normalizeImageRoutingModel(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}

func normalizeImageOperation(operation ImageOperation) ImageOperation {
	return ImageOperation(strings.ToLower(strings.TrimSpace(string(operation))))
}

func normalizeImageResolution(resolution string) string {
	resolution = strings.TrimSpace(resolution)
	if strings.EqualFold(resolution, "auto") {
		return "auto"
	}
	return strings.ToUpper(resolution)
}

func normalizeImageAspectRatio(aspectRatio string) string {
	aspectRatio = strings.TrimSpace(aspectRatio)
	if strings.EqualFold(aspectRatio, "auto") {
		return "auto"
	}
	return aspectRatio
}

func normalizeImageSize(size string) string {
	return strings.ToLower(strings.TrimSpace(size))
}

func normalizeImageQuality(quality string) string {
	return strings.ToLower(strings.TrimSpace(quality))
}

func normalizeImageOutputFormat(outputFormat string) string {
	outputFormat = strings.ToLower(strings.TrimSpace(outputFormat))
	if outputFormat == "jpg" {
		return "jpeg"
	}
	return outputFormat
}

func validImageResolution(resolution string) bool {
	return resolution == "" || resolution == "auto" || imageResolutionPattern.MatchString(resolution)
}

func validImageAspectRatio(aspectRatio string) bool {
	return aspectRatio == "" || aspectRatio == "auto" || imageAspectRatioPattern.MatchString(aspectRatio)
}

func validImageSize(size string) bool {
	return size == "" || size == "auto" || imageSizePattern.MatchString(size)
}

func validImageQuality(quality string) bool {
	return quality == "" || imageQualityPattern.MatchString(quality)
}

func validImageOutputFormat(outputFormat string) bool {
	return outputFormat == "" || imageOutputFormatPattern.MatchString(outputFormat)
}

func isImageOperationAllowed(operation ImageOperation) bool {
	return operation == ImageOperationGeneration || operation == ImageOperationEdit
}

func isImageRoutingProtocolAllowed(protocol ImageRoutingProtocol) bool {
	switch protocol {
	case ImageRoutingProtocolImagesGenerations,
		ImageRoutingProtocolImagesEdits,
		ImageRoutingProtocolResponsesSSE,
		ImageRoutingProtocolGeminiGenerate,
		ImageRoutingProtocolImagenPredict,
		ImageRoutingProtocolAdapter:
		return true
	default:
		return false
	}
}

func isImageRoutingVerificationStatusAllowed(status ImageRoutingVerificationStatus) bool {
	switch status {
	case ImageRoutingVerificationUnverified,
		ImageRoutingVerificationCodeMapped,
		ImageRoutingVerificationDocsClaimed,
		ImageRoutingVerificationProductionVerified,
		ImageRoutingVerificationFailed,
		ImageRoutingVerificationStale:
		return true
	default:
		return false
	}
}
