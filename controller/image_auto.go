package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const imageAutoPublicModel = "image-auto"

const imageAutoMaxPointsHeader = "X-Chimera-Image-Max-Points"

const (
	imageAutoMinInputDimension = 32
	imageAutoMaxInputDimension = 4096
)

var imageAutoChannelLoader = func(id int) (*model.Channel, error) {
	// Image breaker updates are database-authoritative. Reading the dedicated
	// image route live avoids the normal channel-cache sync delay after a trip.
	return model.GetChannelById(id, true)
}

// ImageAutoRouteSnapshot captures the price-relevant material for a selected
// route. It is intentionally a value type so later channel/config edits cannot
// mutate a request already in flight.
type ImageAutoRouteSnapshot struct {
	ChannelID     int
	Priority      int
	UpstreamModel string
	BillingModel  string
	BillingGroup  string
	PriceData     types.PriceData
}

type ImageAutoBillingPlan struct {
	Revision int64
	Routes   []ImageAutoRouteSnapshot
}

func NewImageAutoBillingPlan(revision int64, routes []ImageAutoRouteSnapshot) ImageAutoBillingPlan {
	snapshot := ImageAutoBillingPlan{
		Revision: revision,
		Routes:   make([]ImageAutoRouteSnapshot, len(routes)),
	}
	for index, route := range routes {
		route.PriceData = route.PriceData.Clone()
		snapshot.Routes[index] = route
	}
	return snapshot
}

func NormalizeAndValidateImageAutoRequest(request *dto.ImageRequest) error {
	if request == nil {
		return fmt.Errorf("image-auto request is required")
	}
	quality, err := types.NormalizeImageRoutingQuality(request.Quality)
	if err != nil {
		return fmt.Errorf("quality must be one of auto, low, medium, high")
	}
	request.Quality = quality
	normalizedSize, err := normalizeImageAutoSize(request.Size, quality)
	if err != nil {
		return err
	}
	request.Size = normalizedSize
	if request.N == nil {
		one := uint(1)
		request.N = &one
	}
	if *request.N == 0 || *request.N > 4 {
		return fmt.Errorf("n must be an integer between 1 and 4")
	}
	return nil
}

func normalizeImageAutoSize(rawSize, _ string) (string, error) {
	width, height := 1024, 1024
	size := strings.ToLower(strings.TrimSpace(rawSize))
	if size != "" && size != "auto" {
		parts := strings.Split(size, "x")
		if len(parts) != 2 {
			return "", fmt.Errorf("size must be auto or WIDTHxHEIGHT")
		}
		parsedWidth, err := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 32)
		if err != nil {
			return "", fmt.Errorf("size width must be an integer")
		}
		parsedHeight, err := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 32)
		if err != nil {
			return "", fmt.Errorf("size height must be an integer")
		}
		if parsedWidth < imageAutoMinInputDimension || parsedWidth > imageAutoMaxInputDimension ||
			parsedHeight < imageAutoMinInputDimension || parsedHeight > imageAutoMaxInputDimension {
			return "", fmt.Errorf("size width and height must be between %d and %d", imageAutoMinInputDimension, imageAutoMaxInputDimension)
		}
		width, height = int(parsedWidth), int(parsedHeight)
		if width*9 > height*16 || height*9 > width*16 {
			return "", fmt.Errorf("size aspect ratio must be between 9:16 and 16:9")
		}
	}

	return fmt.Sprintf("%dx%d", width, height), nil
}

func validateImageAutoReserveCap(c *gin.Context, reserveQuota int) error {
	if c == nil || reserveQuota <= 0 {
		return nil
	}
	raw := strings.TrimSpace(c.GetHeader(imageAutoMaxPointsHeader))
	if raw == "" {
		return nil
	}
	points, err := decimal.NewFromString(raw)
	if err != nil || !points.GreaterThan(decimal.Zero) {
		return fmt.Errorf("%s must be a positive decimal number", imageAutoMaxPointsHeader)
	}
	rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	if rate <= 0 {
		rate = 1
	}
	quotaDecimal := points.Div(decimal.NewFromFloat(rate)).Mul(decimal.NewFromInt(int64(common.QuotaPerUnit)))
	capQuota, clamp := common.QuotaFromDecimalChecked(quotaDecimal)
	if clamp != nil || capQuota <= 0 {
		return fmt.Errorf("%s is outside the supported range", imageAutoMaxPointsHeader)
	}
	if reserveQuota > capQuota {
		return fmt.Errorf("image-auto request reserve exceeds %s", imageAutoMaxPointsHeader)
	}
	return nil
}

func validateImageRoutingOptionUpdate(key, value string) error {
	if key != setting.ImageRoutingConfigOption {
		return nil
	}
	_, err := setting.ValidateImageRoutingConfigJSON(value)
	return err
}

func validateImageAutoBillingRequestID(requestID string) error {
	if len(requestID) == 0 || len(requestID) > 64 {
		return fmt.Errorf("request id is invalid")
	}
	for _, char := range requestID {
		if !(char >= 'a' && char <= 'z') && !(char >= 'A' && char <= 'Z') && !(char >= '0' && char <= '9') {
			return fmt.Errorf("request id is invalid")
		}
	}
	return nil
}

func readImageAutoBillingSettlementStatus(raw string) string {
	var payload struct {
		AdminInfo struct {
			ImageAutoBilling struct {
				SettlementStatus string `json:"settlement_status"`
			} `json:"image_auto_billing"`
		} `json:"admin_info"`
	}
	if err := common.Unmarshal([]byte(raw), &payload); err != nil {
		return ""
	}
	switch payload.AdminInfo.ImageAutoBilling.SettlementStatus {
	case "settled", "settlement_pending":
		return payload.AdminInfo.ImageAutoBilling.SettlementStatus
	default:
		return ""
	}
}

// prepareImageAutoRequest switches only the configured public alias into the
// dedicated route/billing path. Other image models retain the upstream relay
// behavior unchanged.
func prepareImageAutoRequest(c *gin.Context, info *relaycommon.RelayInfo) (bool, error) {
	if info == nil {
		return false, nil
	}
	request, ok := info.Request.(*dto.ImageRequest)
	if info.OriginModelName == "" && ok {
		info.OriginModelName = request.Model
	}
	if info.OriginModelName != imageAutoPublicModel {
		return false, nil
	}
	if !ok {
		return false, fmt.Errorf("image-auto requires an image request")
	}
	if err := NormalizeAndValidateImageAutoRequest(request); err != nil {
		return false, err
	}
	referenceCount, err := countImageAutoReferenceImages(c)
	if err != nil {
		return false, err
	}
	plan, enabled, err := setting.BuildImageRoutingPlan(info.OriginModelName, request.Quality, *request.N, referenceCount)
	if err != nil {
		return false, fmt.Errorf("%w: %v", setting.ErrImageRoutingUnavailable, err)
	}
	if !enabled {
		return false, setting.ErrImageRoutingUnavailable
	}
	plan, err = filterImageAutoPlanCooldowns(plan, imageAutoCooldowns)
	if err != nil {
		return false, fmt.Errorf("%w: %v", setting.ErrImageRoutingUnavailable, err)
	}
	if err := validateImageAutoReserveCap(c, plan.ReserveQuota); err != nil {
		return false, err
	}
	request.Quality = plan.Quality
	n := plan.N
	request.N = &n
	info.ImageRouting = relaycommon.NewImageRoutingState(plan)
	// The highest possible price is reserved before any upstream request. This
	// also prevents the trusted-quota bypass from making a later Enterprise
	// fallback unreserved.
	info.ForcePreConsume = true
	info.PriceData = types.PriceData{
		QuotaToPreConsume: plan.ReserveQuota,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}
	return true, nil
}

func countImageAutoReferenceImages(c *gin.Context) (int, error) {
	if c == nil || c.Request == nil || !strings.HasPrefix(strings.ToLower(c.Request.Header.Get("Content-Type")), "multipart/form-data") {
		return 0, nil
	}
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return 0, fmt.Errorf("failed to parse image-auto references: %w", err)
	}
	c.Request.MultipartForm = form
	count := 0
	for field, files := range form.File {
		isImage := field == "image" || field == "image[]"
		if !isImage && strings.HasPrefix(field, "image[") && strings.HasSuffix(field, "]") {
			index := strings.TrimSuffix(strings.TrimPrefix(field, "image["), "]")
			parsedIndex, parseErr := strconv.Atoi(index)
			isImage = index != "" && parseErr == nil && parsedIndex >= 0
		}
		if isImage {
			count += len(files)
		}
	}
	return count, nil
}

func snapshotImageAutoRoutePricing(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) error {
	if info == nil || info.ImageRouting == nil || info.ImageRouting.Plan == nil {
		return nil
	}
	if meta == nil {
		meta = &types.TokenCountMeta{}
	}
	for index, route := range info.ImageRouting.Plan.Routes {
		if route.BillingMode != types.ImageRoutingBillingMetered {
			continue
		}
		pricingInfo := *info
		pricingInfo.ImageRouting = nil
		pricingInfo.OriginModelName = route.BillingModel
		pricingInfo.UsingGroup = route.BillingGroup
		pricingInfo.PriceData = types.PriceData{}
		pricingInfo.TieredBillingSnapshot = nil
		pricingInfo.BillingRequestInput = nil

		// Distributor middleware may have left an auto_group selection in the
		// request context. Metered fallback pricing must use the route's explicit
		// billing group, so isolate the pricing call in a copied context.
		pricingContext := c.Copy()
		pricingContext.Set("auto_group", route.BillingGroup)
		priceData, err := helper.ModelPriceHelper(pricingContext, &pricingInfo, promptTokens, meta)
		if err != nil {
			return fmt.Errorf("image-auto route %s pricing snapshot failed: %w", route.ID, err)
		}
		if err := validateImageAutoMeteredReserveSnapshot(route, info.ImageRouting.Plan.Quality, info.ImageRouting.Plan.N, priceData); err != nil {
			return err
		}
		if err := info.ImageRouting.SetRoutePricing(index, relaycommon.ImageRoutingPriceSnapshot{
			PriceData:             priceData,
			TieredBillingSnapshot: pricingInfo.TieredBillingSnapshot,
			BillingRequestInput:   pricingInfo.BillingRequestInput,
		}); err != nil {
			return err
		}
	}
	return nil
}

func getImageAutoChannel(c *gin.Context, info *relaycommon.RelayInfo, routeIndex int) (*model.Channel, *types.NewAPIError) {
	if info == nil || info.ImageRouting == nil || info.ImageRouting.Plan == nil {
		return nil, types.NewError(fmt.Errorf("image-auto routing plan is unavailable"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if err := info.ImageRouting.ActivateRoute(routeIndex); err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
	}
	route, err := info.ImageRouting.ActiveRoute()
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
	}
	channel, err := imageAutoChannelLoader(route.ChannelID)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("image-auto route %s channel unavailable: %w", route.ID, err), types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
	}
	if channel.Status != common.ChannelStatusEnabled {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("image-auto route %s channel is disabled", route.ID), types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
	}
	if !channelSupportsImageAutoRoute(channel, info.ImageRouting.Plan.PublicGroup, info.ImageRouting.Plan.PublicModel, route.UpstreamModel) {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("image-auto route %s channel is not dedicated to %s", route.ID, info.ImageRouting.Plan.PublicModel), types.ErrorCodeGetChannelFailed, http.StatusServiceUnavailable)
	}
	if apiErr := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName); apiErr != nil {
		return nil, apiErr
	}
	return channel, nil
}

func channelIsDedicatedImageAutoRoute(channel *model.Channel, group, publicModel string) bool {
	if channel == nil || strings.TrimSpace(channel.Group) != group {
		return false
	}
	return strings.TrimSpace(channel.Models) == publicModel
}

func channelSupportsImageAutoRoute(channel *model.Channel, group, publicModel, upstreamModel string) bool {
	if !channelIsDedicatedImageAutoRoute(channel, group, publicModel) {
		return false
	}
	var mapping map[string]string
	if err := common.Unmarshal([]byte(channel.GetModelMapping()), &mapping); err != nil {
		return false
	}
	current := publicModel
	visited := map[string]bool{current: true}
	for {
		next := strings.TrimSpace(mapping[current])
		if next == "" {
			break
		}
		if visited[next] {
			return false
		}
		visited[next] = true
		current = next
	}
	return current == strings.TrimSpace(upstreamModel)
}

func validateImageAutoMeteredReserveSnapshot(route types.ImageRoutingRoute, quality string, n uint, priceData types.PriceData) error {
	if route.BillingMode != types.ImageRoutingBillingMetered {
		return nil
	}
	if priceData.QuotaToPreConsume <= 0 {
		return fmt.Errorf("image-auto route %s pricing snapshot needs a positive pre-consume estimate", route.ID)
	}
	configuredReserve, err := route.ReserveQuota(quality, n)
	if err != nil {
		return fmt.Errorf("image-auto route %s has an invalid configured reserve", route.ID)
	}
	if priceData.QuotaToPreConsume > configuredReserve {
		return fmt.Errorf("image-auto route %s pricing snapshot exceeds configured reserve", route.ID)
	}
	return nil
}

func activateImageAutoRoutePricing(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil || info.ImageRouting == nil {
		return nil
	}
	route, err := info.ImageRouting.ActiveRoute()
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
	}
	if info.ImageRouting.BillingModel == "" {
		info.ImageRouting.BillingModel = info.ImageRouting.Plan.PublicModel
	}
	if info.ImageRouting.BillingGroup == "" {
		info.ImageRouting.BillingGroup = info.ImageRouting.Plan.PublicGroup
	}

	switch route.BillingMode {
	case types.ImageRoutingBillingFixed:
		pricingInfo := *info
		pricingInfo.UsingGroup = info.ImageRouting.Plan.PublicGroup
		pricingContext := c.Copy()
		pricingContext.Set("auto_group", info.ImageRouting.Plan.PublicGroup)
		groupRatioInfo := helper.HandleGroupRatio(pricingContext, &pricingInfo)
		priceData := types.PriceData{
			UsePrice:       true,
			GroupRatioInfo: groupRatioInfo,
		}
		priceData.AddOtherRatio("n", float64(info.ImageRouting.Plan.N))
		info.PriceData = priceData
		info.TieredBillingSnapshot = nil
		info.BillingRequestInput = nil
		return nil
	case types.ImageRoutingBillingMetered:
		if route.BillingModel == "" || route.BillingGroup == "" {
			return types.NewError(fmt.Errorf("image-auto metered route %s needs billing_model and billing_group", route.ID), types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
		}
		pricing, err := info.ImageRouting.ActiveRoutePricing()
		if err != nil {
			return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
		}
		info.PriceData = pricing.PriceData
		info.TieredBillingSnapshot = pricing.TieredBillingSnapshot
		info.BillingRequestInput = pricing.BillingRequestInput
		return nil
	default:
		return types.NewError(fmt.Errorf("image-auto route %s has unsupported billing mode", route.ID), types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
	}
}

func isImageAutoRetryable(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError, routeIndex int) bool {
	if c == nil || c.Request == nil || c.Request.Context().Err() != nil || info == nil || info.ImageRouting == nil || err == nil {
		return false
	}
	hasUnusedRoute := routeIndex+1 < len(info.ImageRouting.Plan.Routes)
	return types.IsImageRoutingErrorRetryable(err, info.ImageRouting.DownstreamPayloadStarted(), hasUnusedRoute)
}

func shouldRetryImageAutoPreDispatchFailure(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError, routeIndex int) bool {
	if c == nil || c.Request == nil || c.Request.Context().Err() != nil || info == nil || info.ImageRouting == nil || err == nil {
		return false
	}
	return routeIndex+1 < len(info.ImageRouting.Plan.Routes)
}

func imageAutoRetryLimit(info *relaycommon.RelayInfo) int {
	if info == nil || info.ImageRouting == nil || info.ImageRouting.Plan == nil {
		return -1
	}
	return len(info.ImageRouting.Plan.Routes) - 1
}

func writeImageAutoTerminalStreamError(c *gin.Context, info *relaycommon.RelayInfo) {
	if c == nil || c.Writer == nil || info == nil || info.ImageRouting == nil || !info.IsStream ||
		!c.Writer.Written() || info.ImageRouting.DownstreamPayloadStarted() {
		return
	}
	payload := struct {
		Type  string `json:"type"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}{Type: "error"}
	payload.Error.Message = relaycommon.ImageRoutingPublicErrorMessage
	data, err := common.Marshal(payload)
	if err != nil {
		return
	}
	_ = helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: "error"}, string(data))
	_ = helper.StringData(c, "[DONE]")
}
