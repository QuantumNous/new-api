package model

import (
	"reflect"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// pricingCapabilityModel resolves the same public-model -> upstream-model
// mapping chain used by the relay. Pricing stays on the public name when a
// mapping is malformed or cyclic because that route cannot be relayed safely.
func pricingCapabilityModel(publicModel string, ability AbilityWithChannel) string {
	if strings.TrimSpace(ability.Model) != "" {
		publicModel = ability.Model
	}
	if ability.ChannelModelMapping == nil || *ability.ChannelModelMapping == "" || *ability.ChannelModelMapping == "{}" {
		return publicModel
	}

	modelMap := make(map[string]string)
	if err := common.UnmarshalJsonStr(*ability.ChannelModelMapping, &modelMap); err != nil {
		return publicModel
	}

	currentModel := publicModel
	visitedModels := map[string]bool{currentModel: true}
	for {
		mappedModel, exists := modelMap[currentModel]
		if !exists || mappedModel == "" {
			return currentModel
		}
		if visitedModels[mappedModel] {
			if mappedModel == currentModel {
				return currentModel
			}
			return publicModel
		}
		visitedModels[mappedModel] = true
		currentModel = mappedModel
	}
}

func pricingImageCapabilities(publicModel string, ability AbilityWithChannel) common.ImageModelCapabilities {
	effectiveModel := pricingCapabilityModel(publicModel, ability)
	capabilities := common.ImageModelCapabilitiesForChannel(effectiveModel, ability.ChannelType)
	if ability.ChannelType == constant.ChannelTypeAli &&
		capabilities.Family == common.ImageModelFamilyAliImage &&
		common.StringsContains(capabilities.Operations, "generation") &&
		!model_setting.IsSyncImageModel(effectiveModel) {
		capabilities.MaxReferenceImages = 0
		capabilities.ReferenceImagesRequired = false
	}
	return capabilities
}

// imageAPIProfileForPricing publishes only explicitly verified channel
// capabilities once image routing is configured for a model. A request can be
// routed to any matching channel, so verified capabilities are combined as a
// union. Legacy channels keep the conservative intersection until they are
// migrated to explicit routing profiles.
func imageAPIProfileForPricing(model string, abilities []AbilityWithChannel) *common.ImageAPIProfile {
	if len(abilities) == 0 {
		return common.ImageAPIProfileForModel(model)
	}

	verifiedCapabilities, _, configured := verifiedPricingImageCapabilities(model, abilities)
	if configured {
		if verifiedCapabilities == nil {
			return nil
		}
		profile := common.ImageAPIProfileForCapabilities(*verifiedCapabilities)
		for i := range profile.Parameters {
			parameter := &profile.Parameters[i]
			if parameter.Default == nil && len(parameter.EnumValues) > 0 && imageVariantParameterRequiresExplicitSelection(parameter.Name) {
				parameter.Required = true
			}
		}
		return profile
	}

	capabilities := pricingImageCapabilities(model, abilities[0])
	for _, ability := range abilities[1:] {
		channelCapabilities := pricingImageCapabilities(model, ability)
		capabilities = common.IntersectImageModelCapabilities(capabilities, channelCapabilities)
	}
	return common.ImageAPIProfileForCapabilities(capabilities)
}

func pricingAbilityHasVerifiedImageRoute(ability AbilityWithChannel) bool {
	if strings.TrimSpace(ability.ChannelOtherSettingsJSON) == "" {
		return false
	}
	settings := dto.ChannelOtherSettings{}
	if err := common.UnmarshalJsonStr(ability.ChannelOtherSettingsJSON, &settings); err != nil || settings.ImageRouting == nil {
		return false
	}
	if err := settings.ImageRouting.Validate(); err != nil {
		return false
	}
	profile, ok := settings.ImageRouting.ProfileForModel(ability.Model)
	if !ok || profile.VerificationStatus != dto.ImageRoutingVerificationProductionVerified {
		return false
	}
	for _, operation := range profile.Operations {
		protocol, _, routeOK := profile.RouteForOperation(operation)
		if !routeOK || !imageRoutingProtocolCompatibleWithChannel(protocol, operation, ability.ChannelType) {
			return false
		}
	}
	return true
}

func imageVariantParameterRequiresExplicitSelection(name string) bool {
	switch name {
	case "aspect_ratio", "resolution", "size", "quality", "output_format":
		return true
	default:
		return false
	}
}

func verifiedPricingImageCapabilities(model string, abilities []AbilityWithChannel) (*common.ImageModelCapabilities, map[string]struct{}, bool) {
	configured := false
	groupCapabilities := make(map[string]*common.ImageModelCapabilities)
	groupOrder := make([]string, 0)
	for _, ability := range abilities {
		if strings.TrimSpace(ability.ChannelOtherSettingsJSON) == "" {
			continue
		}

		settings := dto.ChannelOtherSettings{}
		if err := common.UnmarshalJsonStr(ability.ChannelOtherSettingsJSON, &settings); err != nil {
			configured = true
			continue
		}
		if settings.ImageRouting == nil {
			continue
		}
		if err := settings.ImageRouting.Validate(); err != nil {
			configured = true
			continue
		}
		profile, ok := settings.ImageRouting.ProfileForModel(model)
		if !ok {
			continue
		}
		configured = true
		if profile.VerificationStatus != dto.ImageRoutingVerificationProductionVerified {
			continue
		}
		if !verifiedImageProfileHasCompleteResolutionPricing(model, *profile) {
			continue
		}

		capabilities := verifiedPricingImageProfileCapabilities(*profile)
		groupCapabilitiesValue, exists := groupCapabilities[ability.Group]
		if !exists {
			groupCapabilities[ability.Group] = &capabilities
			groupOrder = append(groupOrder, ability.Group)
			continue
		}
		if groupCapabilitiesValue == nil {
			continue
		}
		if !unionVerifiedPricingImageCapabilities(groupCapabilitiesValue, capabilities) {
			groupCapabilities[ability.Group] = nil
		}
	}

	verifiedGroups := make(map[string]struct{})
	var combined *common.ImageModelCapabilities
	for _, group := range groupOrder {
		capabilities := groupCapabilities[group]
		if capabilities == nil || len(capabilities.Operations) == 0 || len(capabilities.ResolutionAspectVariants) == 0 {
			continue
		}
		if combined == nil {
			copyValue := *capabilities
			combined = &copyValue
			verifiedGroups[group] = struct{}{}
			continue
		}
		if !verifiedImageCapabilityDefaultsEqual(*combined, *capabilities) {
			return nil, map[string]struct{}{}, configured
		}
		intersection := common.IntersectImageModelCapabilities(*combined, *capabilities)
		combined = &intersection
		verifiedGroups[group] = struct{}{}
	}
	if combined == nil || len(combined.Operations) == 0 || len(combined.ResolutionAspectVariants) == 0 {
		return nil, map[string]struct{}{}, configured
	}
	return combined, verifiedGroups, configured
}

func verifiedImageCapabilityDefaultsEqual(left, right common.ImageModelCapabilities) bool {
	return left.DefaultResolution == right.DefaultResolution &&
		left.DefaultAspectRatio == right.DefaultAspectRatio &&
		left.DefaultSize == right.DefaultSize &&
		left.DefaultQuality == right.DefaultQuality &&
		left.DefaultOutputFormat == right.DefaultOutputFormat
}

func verifiedPricingImageProfileCapabilities(profile dto.ImageRoutingProfile) common.ImageModelCapabilities {
	operations := make([]string, 0, len(profile.Operations))
	maxReferenceImages := profile.MaxReferenceImages
	for _, operation := range profile.Operations {
		operations = appendUniquePricingImageString(operations, string(operation))
		if operation == dto.ImageOperationEdit && maxReferenceImages == 0 {
			// The routing profile verifies edit support but does not promise a
			// provider-specific batch limit. One reference image is the safe
			// public contract until a richer verified capability is configured.
			maxReferenceImages = 1
		}
	}

	capabilities := common.ImageModelCapabilities{
		Family:                   common.ImageModelFamilyGeneric,
		Operations:               operations,
		Resolutions:              append([]string(nil), profile.Resolutions...),
		AspectRatios:             append([]string(nil), profile.AspectRatios...),
		Sizes:                    append([]string(nil), profile.Sizes...),
		Qualities:                append([]string(nil), profile.Qualities...),
		OutputFormats:            append([]string(nil), profile.OutputFormats...),
		DefaultResolution:        profile.DefaultResolution,
		DefaultAspectRatio:       profile.DefaultAspectRatio,
		DefaultSize:              profile.DefaultSize,
		DefaultQuality:           profile.DefaultQuality,
		DefaultOutputFormat:      profile.DefaultOutputFormat,
		MaxReferenceImages:       maxReferenceImages,
		MaxOutputImages:          profile.MaxOutputImages,
		HasResolutionParameter:   len(profile.Resolutions) > 0,
		HasAspectRatioParameter:  len(profile.AspectRatios) > 0,
		HasSizeParameter:         len(profile.Sizes) > 0,
		HasQualityParameter:      len(profile.Qualities) > 0,
		HasOutputFormatParameter: len(profile.OutputFormats) > 0,
		ReferenceImagesRequired:  len(operations) == 1 && operations[0] == string(dto.ImageOperationEdit),
	}
	for _, parameter := range profile.OptionalParameters {
		switch parameter {
		case "watermark":
			capabilities.HasWatermarkParameter = true
		case "output_compression":
			capabilities.HasOutputCompression = true
		case "background":
			capabilities.HasBackgroundParameter = true
		case "moderation":
			capabilities.HasModerationParameter = true
		}
	}
	for _, parameter := range profile.Parameters {
		capabilities.AdditionalParameters = appendUniquePricingImageParameter(
			capabilities.AdditionalParameters,
			pricingImageAPIParameter(parameter),
		)
	}
	if capabilities.DefaultResolution == "" && len(capabilities.Resolutions) == 1 {
		capabilities.DefaultResolution = capabilities.Resolutions[0]
	}
	if capabilities.DefaultAspectRatio == "" && len(capabilities.AspectRatios) == 1 {
		capabilities.DefaultAspectRatio = capabilities.AspectRatios[0]
	}
	if capabilities.DefaultSize == "" && len(capabilities.Sizes) == 1 {
		capabilities.DefaultSize = capabilities.Sizes[0]
	}
	if capabilities.DefaultQuality == "" && len(capabilities.Qualities) == 1 {
		capabilities.DefaultQuality = capabilities.Qualities[0]
	}
	if capabilities.DefaultOutputFormat == "" && len(capabilities.OutputFormats) == 1 {
		capabilities.DefaultOutputFormat = capabilities.OutputFormats[0]
	}
	if capabilities.MaxOutputImages == 0 {
		capabilities.MaxOutputImages = 1
	}
	for _, combination := range profile.AllowedCombinations {
		combinationOperations := []dto.ImageOperation{combination.Operation}
		if combination.Operation == "" {
			combinationOperations = profile.Operations
		}
		for _, operation := range combinationOperations {
			variant := common.ImageSizeCombination{
				Operation:    string(operation),
				Resolution:   combination.Resolution,
				AspectRatio:  combination.AspectRatio,
				Size:         combination.Size,
				Quality:      combination.Quality,
				OutputFormat: combination.OutputFormat,
			}
			capabilities.ResolutionAspectVariants = appendUniquePricingImageVariant(
				capabilities.ResolutionAspectVariants,
				variant,
			)
		}
	}
	return capabilities
}

func verifiedImageProfileHasCompleteResolutionPricing(model string, profile dto.ImageRoutingProfile) bool {
	if billing_setting.GetBillingMode(model) == billing_setting.BillingModeTieredExpr && len(profile.Resolutions) > 0 {
		return false
	}
	for _, resolution := range profile.Resolutions {
		if _, ok := ratio_setting.GetImageResolutionPrice(model, resolution); !ok {
			return false
		}
	}
	return true
}

func verifiedImageResolutionPricesForPricing(model string, capabilities *common.ImageModelCapabilities) map[string]float64 {
	if capabilities == nil || len(capabilities.Resolutions) == 0 {
		return nil
	}
	routableResolutions := make(map[string]struct{}, len(capabilities.ResolutionAspectVariants))
	for _, variant := range capabilities.ResolutionAspectVariants {
		if strings.TrimSpace(variant.Resolution) != "" {
			routableResolutions[variant.Resolution] = struct{}{}
		}
	}
	prices := make(map[string]float64, len(capabilities.Resolutions))
	for _, resolution := range capabilities.Resolutions {
		if _, routable := routableResolutions[resolution]; !routable {
			continue
		}
		if price, ok := ratio_setting.GetImageResolutionPrice(model, resolution); ok {
			prices[resolution] = price
		}
	}
	if len(prices) == 0 {
		return nil
	}
	return prices
}

func unionVerifiedPricingImageCapabilities(target *common.ImageModelCapabilities, source common.ImageModelCapabilities) bool {
	mergedParameters := append([]common.ImageAPIParameter(nil), target.AdditionalParameters...)
	sourceParameterNames := make(map[string]struct{}, len(source.AdditionalParameters))
	for _, parameter := range source.AdditionalParameters {
		sourceParameterNames[parameter.Name] = struct{}{}
		merged := false
		for index := range mergedParameters {
			if mergedParameters[index].Name != parameter.Name {
				continue
			}
			combined, ok := mergeVerifiedPricingImageParameter(mergedParameters[index], parameter)
			if !ok {
				return false
			}
			mergedParameters[index] = combined
			merged = true
			break
		}
		if !merged {
			parameter.Required = parameter.Default != nil
			parameter.Default = nil
			mergedParameters = append(mergedParameters, parameter)
		}
	}
	for index := range mergedParameters {
		if _, exists := sourceParameterNames[mergedParameters[index].Name]; exists {
			continue
		}
		mergedParameters[index].Required = mergedParameters[index].Required || mergedParameters[index].Default != nil
		mergedParameters[index].Default = nil
	}
	sort.Slice(mergedParameters, func(i, j int) bool {
		return mergedParameters[i].Name < mergedParameters[j].Name
	})
	for _, operation := range source.Operations {
		target.Operations = appendUniquePricingImageString(target.Operations, operation)
	}
	for _, value := range source.Resolutions {
		target.Resolutions = appendUniquePricingImageString(target.Resolutions, value)
	}
	for _, value := range source.AspectRatios {
		target.AspectRatios = appendUniquePricingImageString(target.AspectRatios, value)
	}
	for _, value := range source.Sizes {
		target.Sizes = appendUniquePricingImageString(target.Sizes, value)
	}
	for _, value := range source.Qualities {
		target.Qualities = appendUniquePricingImageString(target.Qualities, value)
	}
	for _, value := range source.OutputFormats {
		target.OutputFormats = appendUniquePricingImageString(target.OutputFormats, value)
	}
	for _, variant := range source.ResolutionAspectVariants {
		target.ResolutionAspectVariants = appendUniquePricingImageVariant(target.ResolutionAspectVariants, variant)
	}
	if source.MaxReferenceImages > target.MaxReferenceImages {
		target.MaxReferenceImages = source.MaxReferenceImages
	}
	if source.MaxOutputImages > target.MaxOutputImages {
		target.MaxOutputImages = source.MaxOutputImages
	}
	target.HasResolutionParameter = target.HasResolutionParameter || source.HasResolutionParameter
	target.HasAspectRatioParameter = target.HasAspectRatioParameter || source.HasAspectRatioParameter
	target.HasSizeParameter = target.HasSizeParameter || source.HasSizeParameter
	target.HasQualityParameter = target.HasQualityParameter || source.HasQualityParameter
	target.HasOutputFormatParameter = target.HasOutputFormatParameter || source.HasOutputFormatParameter
	target.HasWatermarkParameter = target.HasWatermarkParameter || source.HasWatermarkParameter
	target.HasOutputCompression = target.HasOutputCompression || source.HasOutputCompression
	target.HasBackgroundParameter = target.HasBackgroundParameter || source.HasBackgroundParameter
	target.HasModerationParameter = target.HasModerationParameter || source.HasModerationParameter
	target.AdditionalParameters = mergedParameters
	target.ReferenceImagesRequired = target.ReferenceImagesRequired && source.ReferenceImagesRequired
	if target.DefaultResolution != source.DefaultResolution {
		target.DefaultResolution = ""
	}
	if target.DefaultAspectRatio != source.DefaultAspectRatio {
		target.DefaultAspectRatio = ""
	}
	if target.DefaultSize != source.DefaultSize {
		target.DefaultSize = ""
	}
	if target.DefaultQuality != source.DefaultQuality {
		target.DefaultQuality = ""
	}
	if target.DefaultOutputFormat != source.DefaultOutputFormat {
		target.DefaultOutputFormat = ""
	}
	return true
}

func mergeVerifiedPricingImageParameter(left, right common.ImageAPIParameter) (common.ImageAPIParameter, bool) {
	if left.Name != right.Name || left.Type != right.Type {
		return common.ImageAPIParameter{}, false
	}
	if !samePricingImageParameterBound(left.Min, right.Min) ||
		!samePricingImageParameterBound(left.Max, right.Max) {
		return common.ImageAPIParameter{}, false
	}
	merged := left
	merged.Required = left.Required && right.Required
	if !reflect.DeepEqual(left.Default, right.Default) {
		merged.Default = nil
		merged.Required = true
	}
	if left.Description != right.Description {
		merged.Description = "Provider-specific image generation option."
	}
	switch left.Type {
	case "enum":
		merged.EnumValues = append([]string(nil), left.EnumValues...)
		for _, value := range right.EnumValues {
			merged.EnumValues = appendUniquePricingImageString(merged.EnumValues, value)
		}
		sort.Strings(merged.EnumValues)
	case "array":
		merged.MaxItems = unionPricingImageParameterMaxItems(left.MaxItems, right.MaxItems)
	default:
		if !samePricingImageParameterBound(left.MaxItems, right.MaxItems) {
			return common.ImageAPIParameter{}, false
		}
	}
	return merged, true
}

func samePricingImageParameterBound(left, right *int) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func unionPricingImageParameterMaxItems(left, right *int) *int {
	if left == nil || right == nil {
		return nil
	}
	if *right > *left {
		return right
	}
	return left
}

func appendUniquePricingImageString(values []string, value string) []string {
	if value == "" || common.StringsContains(values, value) {
		return values
	}
	return append(values, value)
}

func appendUniquePricingImageParameter(values []common.ImageAPIParameter, value common.ImageAPIParameter) []common.ImageAPIParameter {
	for _, existing := range values {
		if existing.Name == value.Name {
			return values
		}
	}
	return append(values, value)
}

func pricingImageAPIParameter(parameter dto.ImageRoutingParameter) common.ImageAPIParameter {
	result := common.ImageAPIParameter{
		Name:        parameter.Name,
		Type:        parameter.Type,
		Required:    parameter.Required,
		EnumValues:  append([]string(nil), parameter.EnumValues...),
		Min:         parameter.Min,
		Max:         parameter.Max,
		MaxItems:    parameter.MaxItems,
		Description: parameter.Description,
	}
	if len(parameter.Default) > 0 && common.GetJsonType(parameter.Default) != "null" {
		var defaultValue any
		if err := common.Unmarshal(parameter.Default, &defaultValue); err == nil {
			result.Default = defaultValue
		}
	}
	return result
}

func appendUniquePricingImageVariant(values []common.ImageSizeCombination, value common.ImageSizeCombination) []common.ImageSizeCombination {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}
