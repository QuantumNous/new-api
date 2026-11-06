package dto

// Deprecated model compatibility: OpenAI removed DALL·E 2 and DALL·E 3 from
// its API on 2026-05-12. Retain these rules for existing configurations and
// compatible upstreams; do not extend them for current image models.
// https://developers.openai.com/api/docs/deprecations#2025-11-14-dalle-model-snapshots

import (
	"errors"
	"strings"
)

// NormalizeLegacyDalleImageRequest preserves the retired models' request
// validation and defaults. Other models, including aliases, are unchanged.
func (i *ImageRequest) NormalizeLegacyDalleImageRequest() error {
	switch i.Model {
	case "dall-e-2", "dall-e":
		if i.Size != "" && i.Size != "256x256" && i.Size != "512x512" && i.Size != "1024x1024" {
			return errors.New("size must be one of 256x256, 512x512, or 1024x1024 for dall-e-2 or dall-e")
		}
		if i.Size == "" {
			i.Size = "1024x1024"
		}
	case "dall-e-3":
		if i.Size != "" && i.Size != "1024x1024" && i.Size != "1024x1792" && i.Size != "1792x1024" {
			return errors.New("size must be one of 1024x1024, 1024x1792 or 1792x1024 for dall-e-3")
		}
		if i.Quality == "" {
			i.Quality = "standard"
		}
		if i.Size == "" {
			i.Size = "1024x1024"
		}
	}
	return nil
}

func (i *ImageRequest) legacyDallePriceRatio() float64 {
	if i.IsXAIImagineImageModel() {
		return i.xAIImagePriceRatio()
	}
	if !strings.HasPrefix(i.Model, "dall-e") {
		return 1
	}
	sizeRatio, qualityRatio := 1.0, 1.0
	switch i.Size {
	case "256x256":
		sizeRatio = 0.4
	case "512x512":
		sizeRatio = 0.45
	case "1024x1792", "1792x1024":
		sizeRatio = 2
	}
	if i.Model == "dall-e-3" && i.Quality == "hd" {
		qualityRatio = 2
		if i.Size == "1024x1792" || i.Size == "1792x1024" {
			qualityRatio = 1.5
		}
	}
	return sizeRatio * qualityRatio
}

// xAI image pricing is represented as a ratio against the base $0.04/1K-low
// output price. Successful xAI responses replace this estimate with the exact
// usage.cost_in_usd_ticks value.
func (i *ImageRequest) xAIImagePriceRatio() float64 {
	count := 1
	if i.N != nil && *i.N > 0 && *i.N <= MaxXAIImageN {
		count = int(*i.N)
	}
	resolution := strings.ToLower(i.Resolution)
	if resolution == "" {
		resolution = "1k"
	}
	quality := strings.ToLower(i.Quality)
	if quality == "" || quality == "auto" {
		if i.CountInputImages() > 0 {
			quality = "medium"
		} else {
			quality = "low"
		}
	}
	outputPrice := 0.04
	inputPricePerImage := 0.01
	if i.Model == "grok-imagine-image" {
		outputPrice = 0.02
		inputPricePerImage = 0.002
	}
	if i.Model == "grok-imagine-image-pro" {
		inputPricePerImage = 0.01
	}
	if i.Model != "grok-imagine-image-2.0" {
		return (float64(count)*outputPrice + float64(i.CountInputImages())*inputPricePerImage) / (float64(count) * 0.04)
	}
	switch resolution {
	case "1.5k":
		outputPrice = 0.05
	case "2k":
		outputPrice = 0.06
	}
	if quality == "medium" {
		outputPrice += 0.02
	}
	inputPrice := float64(i.CountInputImages()) * inputPricePerImage
	return (float64(count)*outputPrice + inputPrice) / (float64(count) * 0.04)
}
