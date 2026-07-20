package dto

import (
	"fmt"
	"regexp"
	"strings"
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
	AllowedCombinations []ImageRoutingCombination      `json:"allowed_combinations,omitempty"`
	VerificationStatus  ImageRoutingVerificationStatus `json:"verification_status"`
}

type ImageRoutingCombination struct {
	Operation   ImageOperation `json:"operation,omitempty"`
	Resolution  string         `json:"resolution,omitempty"`
	AspectRatio string         `json:"aspect_ratio,omitempty"`
	Size        string         `json:"size,omitempty"`
	Quality     string         `json:"quality,omitempty"`
}

// ImageSelectionRequirement is the canonical capability input shared by
// automatic selection, retries, and explicitly pinned channels.
type ImageSelectionRequirement struct {
	Operation   ImageOperation `json:"operation"`
	Resolution  string         `json:"resolution,omitempty"`
	AspectRatio string         `json:"aspect_ratio,omitempty"`
	Size        string         `json:"size,omitempty"`
	Quality     string         `json:"quality,omitempty"`
}

var (
	imageResolutionPattern  = regexp.MustCompile(`^[1-9][0-9]*(?:K)?$`)
	imageAspectRatioPattern = regexp.MustCompile(`^[1-9][0-9]*:[1-9][0-9]*$`)
	imageSizePattern        = regexp.MustCompile(`^[1-9][0-9]*x[1-9][0-9]*$`)
	imageQualityPattern     = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)
)

func (requirement ImageSelectionRequirement) Normalize() (ImageSelectionRequirement, error) {
	normalized := ImageSelectionRequirement{
		Operation:   normalizeImageOperation(requirement.Operation),
		Resolution:  normalizeImageResolution(requirement.Resolution),
		AspectRatio: normalizeImageAspectRatio(requirement.AspectRatio),
		Size:        normalizeImageSize(requirement.Size),
		Quality:     normalizeImageQuality(requirement.Quality),
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

func (config *ImageRoutingConfig) Supports(model string, requirement ImageSelectionRequirement) bool {
	profile, ok := config.ProfileForModel(model)
	if !ok || profile.VerificationStatus != ImageRoutingVerificationProductionVerified {
		return false
	}
	normalized, err := requirement.Normalize()
	if err != nil {
		return false
	}
	if !containsImageOperation(profile.Operations, normalized.Operation) ||
		!matchesOptionalImageValue(profile.Resolutions, normalized.Resolution) ||
		!matchesOptionalImageValue(profile.AspectRatios, normalized.AspectRatio) ||
		!matchesOptionalImageValue(profile.Sizes, normalized.Size) ||
		!matchesOptionalImageValue(profile.Qualities, normalized.Quality) {
		return false
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

func (profile *ImageRoutingProfile) validate(index int) error {
	prefix := fmt.Sprintf("image_routing.profiles[%d]", index)
	if profile.Model == "" || strings.TrimSpace(profile.Model) != profile.Model {
		return fmt.Errorf("%s.model is required and must not have surrounding whitespace", prefix)
	}
	if len(profile.Model) > 255 {
		return fmt.Errorf("%s.model is too long", prefix)
	}
	if !isImageRoutingProtocolAllowed(profile.Protocol) {
		return fmt.Errorf("%s.protocol is invalid: %s", prefix, profile.Protocol)
	}
	if err := validateImageRoutingUpstreamPath(profile.Protocol, profile.UpstreamPath); err != nil {
		return fmt.Errorf("%s.upstream_path: %w", prefix, err)
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
	if profile.AllowedCombinations != nil && len(profile.AllowedCombinations) == 0 {
		return fmt.Errorf("%s.allowed_combinations must be omitted or contain at least one combination", prefix)
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
		if _, exists := seenCombinations[normalized]; exists {
			return fmt.Errorf("%s is duplicated", combinationPrefix)
		}
		seenCombinations[normalized] = struct{}{}
	}
	return nil
}

func (combination ImageRoutingCombination) normalize() (ImageRoutingCombination, error) {
	normalized := ImageRoutingCombination{
		Operation:   normalizeImageOperation(combination.Operation),
		Resolution:  normalizeImageResolution(combination.Resolution),
		AspectRatio: normalizeImageAspectRatio(combination.AspectRatio),
		Size:        normalizeImageSize(combination.Size),
		Quality:     normalizeImageQuality(combination.Quality),
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
	return normalized, nil
}

func (combination ImageRoutingCombination) matches(requirement ImageSelectionRequirement) bool {
	return (combination.Operation == "" || combination.Operation == requirement.Operation) &&
		(requirement.Resolution == "" || combination.Resolution == "" || combination.Resolution == requirement.Resolution) &&
		(requirement.AspectRatio == "" || combination.AspectRatio == "" || combination.AspectRatio == requirement.AspectRatio) &&
		(requirement.Size == "" || combination.Size == "" || combination.Size == requirement.Size) &&
		(requirement.Quality == "" || combination.Quality == "" || combination.Quality == requirement.Quality)
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
	if value == "" || declared == nil {
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

func matchesOptionalImageValue(allowed []string, value string) bool {
	if value == "" || allowed == nil {
		return true
	}
	for _, candidate := range allowed {
		if candidate == value {
			return true
		}
	}
	return false
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

func isImageOperationAllowed(operation ImageOperation) bool {
	return operation == ImageOperationGeneration || operation == ImageOperationEdit
}

func isImageRoutingProtocolAllowed(protocol ImageRoutingProtocol) bool {
	switch protocol {
	case ImageRoutingProtocolImagesGenerations,
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
