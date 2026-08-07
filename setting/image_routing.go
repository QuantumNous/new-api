package setting

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

// ImageRoutingConfigOption stores one complete JSON document. Keeping the
// configuration in one option makes a change atomic from a request's point of
// view: it reads and validates one immutable plan at request start.
const ImageRoutingConfigOption = "image_routing_setting.config"

// ErrImageRoutingUnavailable is returned for the public image-auto alias when
// its authoritative routing document is absent or explicitly disabled. The
// alias must fail closed instead of falling through to ordinary channel
// selection, which would lose route-specific billing and breaker isolation.
var ErrImageRoutingUnavailable = errors.New("image-auto routing is unavailable")

func ValidateImageRoutingConfigJSON(raw string) (types.ImageRoutingConfig, error) {
	if strings.TrimSpace(raw) == "" {
		return types.ImageRoutingConfig{}, fmt.Errorf("image routing configuration is required")
	}
	var config types.ImageRoutingConfig
	if err := common.Unmarshal([]byte(raw), &config); err != nil {
		return types.ImageRoutingConfig{}, fmt.Errorf("invalid image routing configuration: %w", err)
	}
	if config.Version != 1 {
		return types.ImageRoutingConfig{}, fmt.Errorf("image routing version must be 1")
	}
	if config.Revision < 1 {
		return types.ImageRoutingConfig{}, fmt.Errorf("image routing revision must be positive")
	}
	if config.PublicModel != "image-auto" || config.PublicGroup != "imageauto" {
		return types.ImageRoutingConfig{}, fmt.Errorf("image routing public model/group must be image-auto/imageauto")
	}
	if config.MaxN == 0 || config.MaxN > 4 {
		return types.ImageRoutingConfig{}, fmt.Errorf("image routing max_n must be between 1 and 4")
	}
	// Validate the complete profile even while disabled. Enabling a previously
	// saved config must never reveal a route missing high-quality bounds.
	validationConfig := config
	validationConfig.Enabled = true
	for _, quality := range []string{"low", "medium", "high"} {
		if _, err := validationConfig.BuildPlan(quality, 1); err != nil {
			return types.ImageRoutingConfig{}, err
		}
	}
	return config, nil
}

func GetImageRoutingConfig() (*types.ImageRoutingConfig, error) {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[ImageRoutingConfigOption]
	common.OptionMapRWMutex.RUnlock()
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	config, err := ValidateImageRoutingConfigJSON(raw)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// BuildImageRoutingPlan returns a request-scoped routing snapshot. A false
// enabled result means this model is not handled by image-auto and should use
// the normal New API relay path.
func BuildImageRoutingPlan(model, quality string, n uint, referenceCounts ...int) (*types.ImageRoutingPlan, bool, error) {
	config, err := GetImageRoutingConfig()
	if err != nil {
		return nil, false, err
	}
	if config == nil {
		if model == "image-auto" {
			return nil, false, ErrImageRoutingUnavailable
		}
		return nil, false, nil
	}
	if !config.Enabled {
		if model == config.PublicModel && model == "image-auto" {
			return nil, false, ErrImageRoutingUnavailable
		}
		return nil, false, nil
	}
	if config.PublicModel != model {
		return nil, false, nil
	}
	plan, err := config.BuildPlan(quality, n, referenceCounts...)
	if err != nil {
		return nil, false, err
	}
	return plan, true, nil
}
