package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type channelMonitorCreateRequest struct {
	Name                     string   `json:"name"`
	ApiURL                   string   `json:"api_url"`
	ApiKey                   string   `json:"api_key"`
	TestModel                string   `json:"test_model"`
	IntervalSeconds          int      `json:"interval_seconds"`
	TimeoutSeconds           int      `json:"timeout_seconds"`
	Enabled                  *bool    `json:"enabled"`
	Visible                  *bool    `json:"visible"`
	AvailabilityBoostPercent *float64 `json:"availability_boost_percent"`
}

type channelMonitorUpdateRequest struct {
	Name                     string   `json:"name"`
	ApiURL                   string   `json:"api_url"`
	ApiKey                   string   `json:"api_key"`
	TestModel                string   `json:"test_model"`
	IntervalSeconds          int      `json:"interval_seconds"`
	TimeoutSeconds           int      `json:"timeout_seconds"`
	Enabled                  *bool    `json:"enabled"`
	Visible                  *bool    `json:"visible"`
	AvailabilityBoostPercent *float64 `json:"availability_boost_percent"`
}

type channelMonitorResultResponse struct {
	Id           int64  `json:"id"`
	Success      bool   `json:"success"`
	LatencyMs    int    `json:"latency_ms"`
	StatusCode   int    `json:"status_code"`
	ErrorMessage string `json:"error_message,omitempty"`
	CheckedAt    int64  `json:"checked_at"`
}

type channelMonitorResponse struct {
	Id                       int                            `json:"id"`
	Name                     string                         `json:"name"`
	ApiURL                   string                         `json:"api_url"`
	TestModel                string                         `json:"test_model"`
	IntervalSeconds          int                            `json:"interval_seconds"`
	TimeoutSeconds           int                            `json:"timeout_seconds"`
	Enabled                  bool                           `json:"enabled"`
	Visible                  bool                           `json:"visible"`
	HasAPIKey                bool                           `json:"has_api_key"`
	Status                   string                         `json:"status"`
	LatestLatencyMs          *int                           `json:"latest_latency_ms"`
	LatestStatusCode         *int                           `json:"latest_status_code"`
	LatestError              string                         `json:"latest_error,omitempty"`
	LastCheckedAt            *int64                         `json:"last_checked_at"`
	NextCheckAt              *int64                         `json:"next_check_at"`
	RawAvailability7d        *float64                       `json:"raw_availability_7d"`
	RawAvailability30d       *float64                       `json:"raw_availability_30d"`
	Availability7d           *float64                       `json:"availability_7d"`
	Availability30d          *float64                       `json:"availability_30d"`
	AvailabilityBoostPercent float64                        `json:"availability_boost_percent"`
	RecentResults            []channelMonitorResultResponse `json:"recent_results"`
	CreatedAt                int64                          `json:"created_at"`
	UpdatedAt                int64                          `json:"updated_at"`
}

type groupStatusResponse struct {
	Id                  int                            `json:"id"`
	Name                string                         `json:"name"`
	ApiURL              string                         `json:"api_url"`
	TestModel           string                         `json:"test_model"`
	IntervalSeconds     int                            `json:"interval_seconds"`
	Status              string                         `json:"status"`
	LatestLatencyMs     *int                           `json:"latest_latency_ms"`
	LastCheckedAt       *int64                         `json:"last_checked_at"`
	NextCheckAt         *int64                         `json:"next_check_at"`
	Availability7d      *float64                       `json:"availability_7d"`
	Availability30d     *float64                       `json:"availability_30d"`
	CanTest             bool                           `json:"can_test"`
	UserTestAvailableAt *int64                         `json:"user_test_available_at"`
	RecentResults       []channelMonitorResultResponse `json:"recent_results"`
}

type groupStatusTestResultResponse struct {
	Success   bool  `json:"success"`
	LatencyMs int   `json:"latency_ms"`
	CheckedAt int64 `json:"checked_at"`
}

func channelMonitorResultToResponse(result *model.ChannelMonitorHistory, includeError bool) channelMonitorResultResponse {
	response := channelMonitorResultResponse{
		Id:         result.Id,
		Success:    result.Success,
		LatencyMs:  result.LatencyMs,
		StatusCode: result.StatusCode,
		CheckedAt:  result.CheckedAt,
	}
	if includeError {
		response.ErrorMessage = result.ErrorMessage
	}
	return response
}

func channelMonitorViewToResponse(view *service.ChannelMonitorView) channelMonitorResponse {
	monitor := view.Monitor
	response := channelMonitorResponse{
		Id:                       monitor.Id,
		Name:                     monitor.Name,
		ApiURL:                   monitor.ApiURL,
		TestModel:                monitor.TestModel,
		IntervalSeconds:          monitor.IntervalSeconds,
		TimeoutSeconds:           monitor.TimeoutSeconds,
		Enabled:                  monitor.Enabled,
		Visible:                  monitor.Visible,
		HasAPIKey:                monitor.ApiKeyEncrypted != "",
		Status:                   view.Status,
		LastCheckedAt:            monitor.LastCheckedAt,
		NextCheckAt:              monitor.NextCheckAt,
		RawAvailability7d:        view.RawAvailability7d,
		RawAvailability30d:       view.RawAvailability30d,
		Availability7d:           view.Availability7d,
		Availability30d:          view.Availability30d,
		AvailabilityBoostPercent: monitor.AvailabilityBoostPercent,
		RecentResults:            make([]channelMonitorResultResponse, 0, len(view.RecentResults)),
		CreatedAt:                monitor.CreatedAt,
		UpdatedAt:                monitor.UpdatedAt,
	}
	if view.Latest != nil {
		response.LatestLatencyMs = &view.Latest.LatencyMs
		response.LatestStatusCode = &view.Latest.StatusCode
		response.LatestError = view.Latest.ErrorMessage
	}
	for _, result := range view.RecentResults {
		response.RecentResults = append(response.RecentResults, channelMonitorResultToResponse(result, true))
	}
	return response
}

func channelMonitorViewToGroupStatus(view *service.ChannelMonitorView) groupStatusResponse {
	monitor := view.Monitor
	response := groupStatusResponse{
		Id:                  monitor.Id,
		Name:                monitor.Name,
		ApiURL:              monitor.ApiURL,
		TestModel:           monitor.TestModel,
		IntervalSeconds:     monitor.IntervalSeconds,
		Status:              view.Status,
		LastCheckedAt:       monitor.LastCheckedAt,
		NextCheckAt:         monitor.NextCheckAt,
		Availability7d:      view.Availability7d,
		Availability30d:     view.Availability30d,
		CanTest:             monitor.Enabled,
		UserTestAvailableAt: monitor.UserTestAvailableAt,
		RecentResults:       make([]channelMonitorResultResponse, 0, len(view.RecentResults)),
	}
	if view.Latest != nil {
		response.LatestLatencyMs = &view.Latest.LatencyMs
	}
	for _, result := range view.RecentResults {
		response.RecentResults = append(response.RecentResults, channelMonitorResultToResponse(result, false))
	}
	return response
}

func parseChannelMonitorId(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid monitor ID"})
		return 0, false
	}
	return id, true
}

func respondChannelMonitorError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "monitor not found"})
		return
	}
	common.ApiError(c, err)
}

func GetAllChannelMonitors(c *gin.Context) {
	views, err := service.ListChannelMonitorViews(false)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	items := make([]channelMonitorResponse, 0, len(views))
	for _, view := range views {
		items = append(items, channelMonitorViewToResponse(view))
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

func GetChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorId(c)
	if !ok {
		return
	}
	view, err := service.GetChannelMonitorView(id)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	common.ApiSuccess(c, channelMonitorViewToResponse(view))
}

func CreateChannelMonitor(c *gin.Context) {
	var request channelMonitorCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := true
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	visible := true
	if request.Visible != nil {
		visible = *request.Visible
	}
	availabilityBoostPercent := 0.0
	if request.AvailabilityBoostPercent != nil {
		availabilityBoostPercent = *request.AvailabilityBoostPercent
	}
	monitor, err := service.CreateChannelMonitor(service.ChannelMonitorInput{
		Name:                     request.Name,
		ApiURL:                   request.ApiURL,
		ApiKey:                   request.ApiKey,
		TestModel:                request.TestModel,
		IntervalSeconds:          request.IntervalSeconds,
		TimeoutSeconds:           request.TimeoutSeconds,
		Enabled:                  enabled,
		Visible:                  visible,
		AvailabilityBoostPercent: availabilityBoostPercent,
		CreatedBy:                c.GetInt("id"),
	})
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	view, err := service.GetChannelMonitorView(monitor.Id)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	common.ApiSuccess(c, channelMonitorViewToResponse(view))
}

func UpdateChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorId(c)
	if !ok {
		return
	}
	current, err := service.GetChannelMonitorView(id)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	var request channelMonitorUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := current.Monitor.Enabled
	if request.Enabled != nil {
		enabled = *request.Enabled
	}
	visible := current.Monitor.Visible
	if request.Visible != nil {
		visible = *request.Visible
	}
	availabilityBoostPercent := current.Monitor.AvailabilityBoostPercent
	if request.AvailabilityBoostPercent != nil {
		availabilityBoostPercent = *request.AvailabilityBoostPercent
	}
	_, err = service.UpdateChannelMonitor(id, service.ChannelMonitorInput{
		Name:                     request.Name,
		ApiURL:                   request.ApiURL,
		ApiKey:                   request.ApiKey,
		TestModel:                request.TestModel,
		IntervalSeconds:          request.IntervalSeconds,
		TimeoutSeconds:           request.TimeoutSeconds,
		Enabled:                  enabled,
		Visible:                  visible,
		AvailabilityBoostPercent: availabilityBoostPercent,
	})
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	view, err := service.GetChannelMonitorView(id)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	common.ApiSuccess(c, channelMonitorViewToResponse(view))
}

func DeleteChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorId(c)
	if !ok {
		return
	}
	if err := service.DeleteChannelMonitor(id); err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func RunChannelMonitor(c *gin.Context) {
	id, ok := parseChannelMonitorId(c)
	if !ok {
		return
	}
	result, err := service.RunChannelMonitorCheck(c.Request.Context(), id)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	view, err := service.GetChannelMonitorView(id)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"result":  channelMonitorResultToResponse(result, true),
		"monitor": channelMonitorViewToResponse(view),
	})
}

func GetChannelMonitorHistory(c *gin.Context) {
	id, ok := parseChannelMonitorId(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	history, err := service.ListChannelMonitorHistory(id, limit)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	items := make([]channelMonitorResultResponse, 0, len(history))
	for _, result := range history {
		items = append(items, channelMonitorResultToResponse(result, true))
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

func GetGroupStatus(c *gin.Context) {
	views, err := service.ListChannelMonitorViews(true)
	if err != nil {
		respondChannelMonitorError(c, err)
		return
	}
	items := make([]groupStatusResponse, 0, len(views))
	for _, view := range views {
		items = append(items, channelMonitorViewToGroupStatus(view))
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

func RunGroupStatusTest(c *gin.Context) {
	id, ok := parseChannelMonitorId(c)
	if !ok {
		return
	}
	result, err := service.RunUserChannelMonitorTest(c.Request.Context(), id)
	if err != nil {
		var cooldownErr *service.ChannelMonitorUserTestCooldownError
		if errors.As(err, &cooldownErr) {
			retryAfter := cooldownErr.NextTestAt - common.GetTimestamp()
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"message": "availability test is cooling down",
				"data": gin.H{
					"retry_after":  retryAfter,
					"next_test_at": cooldownErr.NextTestAt,
				},
			})
			return
		}
		if errors.Is(err, service.ErrChannelMonitorUserTestUnavailable) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "monitor not found"})
			return
		}
		respondChannelMonitorError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"result": groupStatusTestResultResponse{
			Success:   result.Success,
			LatencyMs: result.LatencyMs,
			CheckedAt: result.CheckedAt,
		},
		"cooldown_seconds": service.ChannelMonitorUserTestCooldownSeconds,
		"next_test_at":     result.NextTestAt,
	})
}
