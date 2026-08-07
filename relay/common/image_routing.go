package common

import (
	"fmt"
	"sync/atomic"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/types"
)

const ImageRoutingPublicErrorMessage = "Image generation failed."

// ImageRoutingPriceSnapshot contains every mutable pricing input needed to
// settle one metered route. It is populated before the first upstream attempt
// and cloned again when activated, so a concurrent admin price update cannot
// change an in-flight request.
type ImageRoutingPriceSnapshot struct {
	PriceData             types.PriceData
	TieredBillingSnapshot *billingexpr.BillingSnapshot
	BillingRequestInput   *billingexpr.RequestInput
}

// ImageRoutingState is request-local. It intentionally owns a plan snapshot
// rather than a pointer to live configuration so a request cannot mix route
// order or prices from two revisions.
type ImageRoutingState struct {
	Plan                  *types.ImageRoutingPlan
	ActiveRouteIndex      int
	AttemptedChannelIDs   []int
	FinalQuotaOverride    int
	FinalQuotaOverrideSet bool
	MissingUsageFallback  bool
	ReserveBreach         bool
	ReturnedImages        uint
	ReturnedImagesKnown   bool
	BillingModel          string
	BillingGroup          string
	RoutePricing          map[int]ImageRoutingPriceSnapshot
	activatedChannelIDs   []int
	downstreamPayloadSize atomic.Int64
}

// RecordDownstreamPayload records only application payload bytes. Transport
// keepalives intentionally do not call this method, so a PING cannot make a
// rejected route look as if an image result was already delivered.
func (s *ImageRoutingState) RecordDownstreamPayload(written int) {
	if s == nil || written <= 0 {
		return
	}
	s.downstreamPayloadSize.Add(int64(written))
}

func (s *ImageRoutingState) DownstreamPayloadStarted() bool {
	return s != nil && s.downstreamPayloadSize.Load() > 0
}

func NewImageRoutingState(plan *types.ImageRoutingPlan) *ImageRoutingState {
	return &ImageRoutingState{
		Plan:             plan,
		ActiveRouteIndex: -1,
		RoutePricing:     make(map[int]ImageRoutingPriceSnapshot),
	}
}

func cloneImageRoutingPriceSnapshot(snapshot ImageRoutingPriceSnapshot) ImageRoutingPriceSnapshot {
	cloned := snapshot
	cloned.PriceData = snapshot.PriceData.Clone()
	if snapshot.TieredBillingSnapshot != nil {
		value := *snapshot.TieredBillingSnapshot
		cloned.TieredBillingSnapshot = &value
	}
	if snapshot.BillingRequestInput != nil {
		value := &billingexpr.RequestInput{
			Body: append([]byte(nil), snapshot.BillingRequestInput.Body...),
		}
		if len(snapshot.BillingRequestInput.Headers) > 0 {
			value.Headers = make(map[string]string, len(snapshot.BillingRequestInput.Headers))
			for key, header := range snapshot.BillingRequestInput.Headers {
				value.Headers[key] = header
			}
		}
		cloned.BillingRequestInput = value
	}
	return cloned
}

func (s *ImageRoutingState) SetRoutePricing(index int, snapshot ImageRoutingPriceSnapshot) error {
	if s == nil || s.Plan == nil || index < 0 || index >= len(s.Plan.Routes) {
		return fmt.Errorf("image routing route index %d is unavailable", index)
	}
	if s.RoutePricing == nil {
		s.RoutePricing = make(map[int]ImageRoutingPriceSnapshot)
	}
	s.RoutePricing[index] = cloneImageRoutingPriceSnapshot(snapshot)
	return nil
}

func (s *ImageRoutingState) ActiveRoutePricing() (ImageRoutingPriceSnapshot, error) {
	if s == nil || s.Plan == nil || s.ActiveRouteIndex < 0 || s.ActiveRouteIndex >= len(s.Plan.Routes) {
		return ImageRoutingPriceSnapshot{}, fmt.Errorf("image routing has no active route")
	}
	snapshot, ok := s.RoutePricing[s.ActiveRouteIndex]
	if !ok {
		return ImageRoutingPriceSnapshot{}, fmt.Errorf("image routing route %s has no request-start pricing snapshot", s.Plan.Routes[s.ActiveRouteIndex].ID)
	}
	return cloneImageRoutingPriceSnapshot(snapshot), nil
}

func (s *ImageRoutingState) ActiveRoute() (*types.ImageRoutingRoute, error) {
	if s == nil || s.Plan == nil {
		return nil, fmt.Errorf("image routing plan is unavailable")
	}
	if s.ActiveRouteIndex < 0 || s.ActiveRouteIndex >= len(s.Plan.Routes) {
		return nil, fmt.Errorf("image routing has no active route")
	}
	return &s.Plan.Routes[s.ActiveRouteIndex], nil
}

func (s *ImageRoutingState) ActivateRoute(index int) error {
	if s == nil || s.Plan == nil {
		return fmt.Errorf("image routing plan is unavailable")
	}
	if index < 0 || index >= len(s.Plan.Routes) {
		return fmt.Errorf("image routing route index %d is unavailable", index)
	}
	route := s.Plan.Routes[index]
	for _, channelID := range s.activatedChannelIDs {
		if channelID == route.ChannelID {
			return fmt.Errorf("image routing route %s was already attempted", route.ID)
		}
	}
	s.ActiveRouteIndex = index
	s.activatedChannelIDs = append(s.activatedChannelIDs, route.ChannelID)
	s.FinalQuotaOverride = 0
	s.FinalQuotaOverrideSet = false
	s.MissingUsageFallback = false
	s.ReserveBreach = false
	s.ReturnedImages = 0
	s.ReturnedImagesKnown = false
	s.BillingModel = route.BillingModel
	s.BillingGroup = route.BillingGroup
	return nil
}

// RecordActiveRouteAttempt is called immediately before http.Client.Do so audit
// metadata distinguishes a selected route from one handed to the transport.
func (s *ImageRoutingState) RecordActiveRouteAttempt() error {
	route, err := s.ActiveRoute()
	if err != nil {
		return err
	}
	for _, channelID := range s.AttemptedChannelIDs {
		if channelID == route.ChannelID {
			return fmt.Errorf("image routing route %s was already dispatched", route.ID)
		}
	}
	s.AttemptedChannelIDs = append(s.AttemptedChannelIDs, route.ChannelID)
	return nil
}

// RecordReturnedImages stores the validated image output count for settlement.
// The separate known bit is required because zero completed outputs is a valid
// observation and must not fall back to the requested image count.
func (s *ImageRoutingState) RecordReturnedImages(count uint) {
	if s == nil {
		return
	}
	s.ReturnedImages = count
	s.ReturnedImagesKnown = true
}

// PrepareSettlement derives the known final charge for fixed routes and for a
// metered route with absent usage. Metered routes with usage keep zero here so
// normal pricing calculates their actual quota from the frozen PriceData.
func (s *ImageRoutingState) PrepareSettlement(returnedImages uint, hasUsage bool) error {
	route, err := s.ActiveRoute()
	if err != nil {
		return err
	}
	s.MissingUsageFallback = false
	s.FinalQuotaOverride = 0
	s.FinalQuotaOverrideSet = false
	if returnedImages == 0 {
		s.FinalQuotaOverrideSet = true
		return nil
	}
	switch route.BillingMode {
	case types.ImageRoutingBillingFixed:
		quota, err := route.FixedQuota(returnedImages)
		if err != nil {
			return err
		}
		s.FinalQuotaOverride = quota
		s.FinalQuotaOverrideSet = true
	case types.ImageRoutingBillingMetered:
		if !hasUsage {
			quota, err := route.MissingUsageQuota(s.Plan.Quality, returnedImages)
			if err != nil {
				return err
			}
			s.FinalQuotaOverride = quota
			s.FinalQuotaOverrideSet = true
			s.MissingUsageFallback = true
		}
	default:
		return fmt.Errorf("image routing route %s has unsupported billing mode", route.ID)
	}
	return nil
}

// CapActualQuota ensures the final billing can never exceed the request-start
// reservation. The caller records and disables a dedicated metered route when
// this guard trips so the discrepancy is visible rather than silently billing
// beyond the user's authorization.
func (s *ImageRoutingState) CapActualQuota(actualQuota int) (int, bool) {
	if s == nil || s.Plan == nil {
		return actualQuota, false
	}
	reserveQuota := s.Plan.ReserveQuota
	if route, err := s.ActiveRoute(); err == nil {
		if activeRouteReserve, reserveErr := route.ReserveQuota(s.Plan.Quality, s.Plan.N); reserveErr == nil {
			reserveQuota = activeRouteReserve
		}
	}
	if actualQuota <= reserveQuota {
		return actualQuota, false
	}
	s.ReserveBreach = true
	return reserveQuota, true
}

func (s *ImageRoutingState) BillingMode() string {
	route, err := s.ActiveRoute()
	if err != nil {
		return ""
	}
	return route.BillingMode
}
