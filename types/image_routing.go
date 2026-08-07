package types

import (
	"fmt"
	"sort"
	"strings"
)

const (
	ImageRoutingBillingFixed   = "fixed"
	ImageRoutingBillingMetered = "metered"
)

// ImageRoutingConfig is a revisioned, serializable description of the routes
// behind one public image model. Quotas are stored in New API quota units, not
// display points, to keep the request reservation integer and deterministic.
type ImageRoutingConfig struct {
	Version     int                 `json:"version"`
	Revision    int                 `json:"revision"`
	Enabled     bool                `json:"enabled"`
	PublicModel string              `json:"public_model"`
	PublicGroup string              `json:"public_group"`
	MaxN        uint                `json:"max_n"`
	Routes      []ImageRoutingRoute `json:"routes"`
}

type ImageRoutingRoute struct {
	ID                         string         `json:"id"`
	ChannelID                  int            `json:"channel_id"`
	Priority                   int            `json:"priority"`
	Enabled                    bool           `json:"enabled"`
	BillingMode                string         `json:"billing_mode"`
	UpstreamModel              string         `json:"upstream_model,omitempty"`
	BillingModel               string         `json:"billing_model,omitempty"`
	BillingGroup               string         `json:"billing_group,omitempty"`
	FixedQuotaPerImage         int            `json:"fixed_quota_per_image,omitempty"`
	ReserveQuotaByQuality      map[string]int `json:"reserve_quota_by_quality,omitempty"`
	MissingUsageQuotaByQuality map[string]int `json:"missing_usage_quota_by_quality,omitempty"`
	MaxReferenceImages         int            `json:"max_reference_images,omitempty"`
}

// ImageRoutingPlan is the immutable request-start snapshot derived from a
// routing configuration. The caller must keep this plan for the full request
// instead of rereading a configuration that may have changed mid-flight.
type ImageRoutingPlan struct {
	Version        int
	Revision       int
	PublicModel    string
	PublicGroup    string
	Quality        string
	N              uint
	ReferenceCount int
	ReserveQuota   int
	Routes         []ImageRoutingRoute
}

func NormalizeImageRoutingQuality(value string) (string, error) {
	quality := strings.ToLower(strings.TrimSpace(value))
	switch quality {
	case "":
		return "auto", nil
	case "standard":
		return "medium", nil
	case "auto", "low", "medium", "high":
		return quality, nil
	default:
		return "", fmt.Errorf("image-auto quality must be auto, low, medium, or high")
	}
}

func imageRoutingBillingQuality(quality string) string {
	if quality == "auto" {
		return "high"
	}
	return quality
}

func (c ImageRoutingConfig) BuildPlan(quality string, n uint, referenceCounts ...int) (*ImageRoutingPlan, error) {
	if !c.Enabled {
		return nil, fmt.Errorf("image routing is disabled")
	}
	if strings.TrimSpace(c.PublicModel) == "" || strings.TrimSpace(c.PublicGroup) == "" {
		return nil, fmt.Errorf("image routing public model and group are required")
	}
	if c.MaxN == 0 {
		return nil, fmt.Errorf("image routing max_n must be positive")
	}
	if n == 0 {
		n = 1
	}
	if n > c.MaxN {
		return nil, fmt.Errorf("image-auto n must be between 1 and %d", c.MaxN)
	}
	referenceCount := 0
	if len(referenceCounts) > 0 {
		referenceCount = referenceCounts[0]
	}
	if referenceCount < 0 || referenceCount > 16 {
		return nil, fmt.Errorf("image-auto reference count must be between 0 and 16")
	}
	normalizedQuality, err := NormalizeImageRoutingQuality(quality)
	if err != nil {
		return nil, err
	}

	routes := make([]ImageRoutingRoute, 0, len(c.Routes))
	seenChannels := make(map[int]struct{}, len(c.Routes))
	seenPriorities := make(map[int]struct{}, len(c.Routes))
	for _, route := range c.Routes {
		if !route.Enabled {
			continue
		}
		route = cloneImageRoutingRoute(route)
		if route.MaxReferenceImages == 0 {
			route.MaxReferenceImages = 1
		}
		if strings.TrimSpace(route.ID) == "" {
			return nil, fmt.Errorf("image routing route id is required")
		}
		if route.ChannelID <= 0 {
			return nil, fmt.Errorf("image routing route %s channel id is required", route.ID)
		}
		if _, exists := seenChannels[route.ChannelID]; exists {
			return nil, fmt.Errorf("image routing channel %d is configured more than once", route.ChannelID)
		}
		seenChannels[route.ChannelID] = struct{}{}
		if _, exists := seenPriorities[route.Priority]; exists {
			return nil, fmt.Errorf("image routing priority %d must be unique", route.Priority)
		}
		seenPriorities[route.Priority] = struct{}{}
		if err := validateImageRoutingRoute(route, normalizedQuality); err != nil {
			return nil, err
		}
		if referenceCount > route.MaxReferenceImages {
			continue
		}
		routes = append(routes, route)
	}
	if len(routes) == 0 {
		if referenceCount > 0 {
			return nil, fmt.Errorf("image routing has no enabled routes support %d reference images", referenceCount)
		}
		return nil, fmt.Errorf("image routing has no enabled routes")
	}
	sort.SliceStable(routes, func(i, j int) bool {
		return routes[i].Priority > routes[j].Priority
	})

	reserveQuota := 0
	for _, route := range routes {
		quota, err := route.ReserveQuota(normalizedQuality, n)
		if err != nil {
			return nil, err
		}
		if quota > reserveQuota {
			reserveQuota = quota
		}
	}
	if reserveQuota <= 0 {
		return nil, fmt.Errorf("image routing reserve quota must be positive")
	}
	return &ImageRoutingPlan{
		Version:        c.Version,
		Revision:       c.Revision,
		PublicModel:    c.PublicModel,
		PublicGroup:    c.PublicGroup,
		Quality:        normalizedQuality,
		N:              n,
		ReferenceCount: referenceCount,
		ReserveQuota:   reserveQuota,
		Routes:         routes,
	}, nil
}

func validateImageRoutingRoute(route ImageRoutingRoute, quality string) error {
	if route.MaxReferenceImages == 0 {
		route.MaxReferenceImages = 1
	}
	if route.MaxReferenceImages < 1 || route.MaxReferenceImages > 16 {
		return fmt.Errorf("image routing route %s max_reference_images must be between 1 and 16", route.ID)
	}
	if strings.TrimSpace(route.UpstreamModel) == "" {
		return fmt.Errorf("image routing route %s needs an upstream model", route.ID)
	}
	switch route.BillingMode {
	case ImageRoutingBillingFixed:
		if route.FixedQuotaPerImage <= 0 {
			return fmt.Errorf("image routing fixed route %s needs fixed quota", route.ID)
		}
	case ImageRoutingBillingMetered:
		if strings.TrimSpace(route.BillingModel) == "" || strings.TrimSpace(route.BillingGroup) == "" {
			return fmt.Errorf("image routing metered route %s needs billing model and group", route.ID)
		}
		billingQuality := imageRoutingBillingQuality(quality)
		reserve := route.ReserveQuotaByQuality[billingQuality]
		fallback := route.MissingUsageQuotaByQuality[billingQuality]
		if reserve <= 0 {
			return fmt.Errorf("image routing metered route %s needs reserve quota for %s", route.ID, billingQuality)
		}
		if fallback <= 0 || fallback > reserve {
			return fmt.Errorf("image routing metered route %s has invalid missing usage quota for %s", route.ID, billingQuality)
		}
	default:
		return fmt.Errorf("image routing route %s has unsupported billing mode", route.ID)
	}
	return nil
}

// ReserveQuota returns this route's request-start authorization for a quality
// and image count, using the same overflow-safe multiplication as settlement.
func (r ImageRoutingRoute) ReserveQuota(quality string, n uint) (int, error) {
	perImage := r.FixedQuotaPerImage
	if r.BillingMode == ImageRoutingBillingMetered {
		perImage = r.ReserveQuotaByQuality[imageRoutingBillingQuality(quality)]
	}
	return imageRoutingMultiplyQuota(perImage, n)
}

func (r ImageRoutingRoute) MissingUsageQuota(quality string, n uint) (int, error) {
	if r.BillingMode != ImageRoutingBillingMetered {
		return 0, fmt.Errorf("image routing route %s is not metered", r.ID)
	}
	return imageRoutingMultiplyQuota(r.MissingUsageQuotaByQuality[imageRoutingBillingQuality(quality)], n)
}

func (r ImageRoutingRoute) FixedQuota(n uint) (int, error) {
	if r.BillingMode != ImageRoutingBillingFixed {
		return 0, fmt.Errorf("image routing route %s is not fixed", r.ID)
	}
	return imageRoutingMultiplyQuota(r.FixedQuotaPerImage, n)
}

func imageRoutingMultiplyQuota(perImage int, n uint) (int, error) {
	if perImage <= 0 || n == 0 {
		return 0, fmt.Errorf("image routing quota must be positive")
	}
	maxInt := int(^uint(0) >> 1)
	if uint(perImage) > uint(maxInt)/n {
		return 0, fmt.Errorf("image routing quota exceeds integer range")
	}
	return perImage * int(n), nil
}

func cloneImageRoutingRoute(route ImageRoutingRoute) ImageRoutingRoute {
	cloned := route
	cloned.ReserveQuotaByQuality = cloneImageRoutingQuotaMap(route.ReserveQuotaByQuality)
	cloned.MissingUsageQuotaByQuality = cloneImageRoutingQuotaMap(route.MissingUsageQuotaByQuality)
	return cloned
}

func cloneImageRoutingQuotaMap(source map[string]int) map[string]int {
	if len(source) == 0 {
		return nil
	}
	cloned := make(map[string]int, len(source))
	for quality, quota := range source {
		cloned[quality] = quota
	}
	return cloned
}
