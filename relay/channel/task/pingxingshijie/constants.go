package pingxingshijie

import (
	"fmt"
	"strings"
)

// AssetPlaceholderModel is the only model allowed for /v1/assets/upload routing and billing.
const AssetPlaceholderModel = "pingxingshijie-asset"

func ValidateAssetUploadModel(modelName string) error {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return fmt.Errorf("model is required for asset upload; use %s", AssetPlaceholderModel)
	}
	if modelName != AssetPlaceholderModel {
		return fmt.Errorf("invalid asset upload model %q; use %s", modelName, AssetPlaceholderModel)
	}
	return nil
}

// ModelList contains the PingXingShiJie models documented in docs/pingxingshijie-api-reference.md.
var ModelList = []string{
	AssetPlaceholderModel,
	"doubao-seedance-1-0-pro-fast-251015",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-fast-260128",
	"doubao-seedance-2-0-260128",
	"doubao-seedream-5-0-260128",
	"doubao-seedream-4-5-251128",
	"doubao-seedream-4-0-250828",
}

var ChannelName = "pingxingshijie-video"

// videoInputRatioMap discount when video input is present (with-video / without-video pricing).
// Admins should set ModelRatio to the higher "without video" rate;
// the system multiplies by this ratio when video input is detected.
var videoInputRatioMap = map[string]float64{
	"doubao-seedance-2-0-260128":      28.0 / 46.0, // ~0.6087
	"doubao-seedance-2-0-fast-260128": 22.0 / 37.0, // ~0.5946
}

const seedance20Model = "doubao-seedance-2-0-260128"

var seedance20ResolutionRatioMap = map[string]float64{
	"1080p": 51.0 / 46.0,
}

var seedance20VideoInputResolutionRatioMap = map[string]float64{
	"1080p": 31.0 / 51.0,
}

func GetVideoInputRatio(modelName string) (float64, bool) {
	r, ok := videoInputRatioMap[modelName]
	return r, ok
}

func GetVideoInputRatioForResolution(modelName, resolution string) (float64, bool) {
	if modelName == seedance20Model {
		if r, ok := seedance20VideoInputResolutionRatioMap[resolution]; ok {
			return r, true
		}
	}
	return GetVideoInputRatio(modelName)
}

func GetResolutionRatio(modelName, resolution string) (float64, bool) {
	if modelName != seedance20Model {
		return 0, false
	}
	r, ok := seedance20ResolutionRatioMap[resolution]
	return r, ok
}
