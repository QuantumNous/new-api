package controller

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	notifydto "github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	upstreamSettingsBodyLimit = 256 << 10
	upstreamSnapshotBodyLimit = 2 << 20
)

func GetUpstreamOrchestrationOverview(c *gin.Context) {
	sources, err := model.ListUpstreamSources()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups, err := model.ListUpstreamGroups()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	routes, err := service.ListUpstreamRouteOverviews()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	devices, err := service.ListUpstreamSyncDevices()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	commands, err := model.ListUpstreamSyncCommands(50)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rootSetting := model.GetRootUser().GetSetting()
	common.ApiSuccess(c, gin.H{
		"settings":        operation_setting.GetUpstreamOrchestrationSetting(),
		"sources":         sources,
		"groups":          groups,
		"routes":          routes,
		"devices":         devices,
		"commands":        commands,
		"bark_configured": rootSetting.NotifyType == notifydto.NotifyTypeBark && strings.TrimSpace(rootSetting.BarkUrl) != "",
	})
}

func UpdateUpstreamOrchestrationSettings(c *gin.Context) {
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, upstreamSettingsBodyLimit))
	if err != nil {
		common.ApiErrorMsg(c, "invalid upstream settings request")
		return
	}
	var request operation_setting.UpstreamRoutingPolicy
	if len(body) == 0 || common.Unmarshal(body, &request) != nil {
		common.ApiErrorMsg(c, "invalid upstream settings request")
		return
	}
	policy, err := operation_setting.NormalizeUpstreamRoutingPolicy(request)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err := model.UpdateUpstreamOrchestrationPolicy(policy); err != nil {
		common.SysError("failed to save upstream settings")
		common.ApiErrorMsg(c, "failed to save upstream settings")
		return
	}
	common.ApiSuccess(c, operation_setting.GetUpstreamOrchestrationSetting())
}

func ListUpstreamOrchestrationRoutes(c *gin.Context) {
	routes, err := service.ListUpstreamRouteOverviews()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, routes)
}

func ListUpstreamOrchestrationMetrics(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "500"))
	if limit <= 0 || limit > 5000 {
		limit = 500
	}
	query := model.DB.Order("observed_at desc, id desc").Limit(limit)
	if sourceID, err := strconv.ParseInt(c.Query("source_id"), 10, 64); err == nil && sourceID > 0 {
		query = query.Where("source_id = ?", sourceID)
	}
	if modelName := strings.TrimSpace(c.Query("model")); modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	var metrics []model.UpstreamMetricSnapshot
	if err := query.Find(&metrics).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, metrics)
}

func ListUpstreamPriceEvidence(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "200"))
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	query := model.DB.Order("captured_at desc, id desc").Limit(limit)
	if vendor := strings.TrimSpace(c.Query("vendor")); vendor != "" {
		query = query.Where("vendor = ?", strings.ToLower(vendor))
	}
	var evidence []model.UpstreamPriceEvidence
	if err := query.Find(&evidence).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, evidence)
}

func CreateUpstreamPairingCode(c *gin.Context) {
	var request struct {
		DeviceName string `json:"device_name"`
	}
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&request); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	device, code, err := service.CreateUpstreamPairingCode(request.DeviceName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, dto.UpstreamPairingCodeResponse{
		DeviceID:    device.DeviceID,
		PairingCode: code,
		ExpiresAt:   device.PairingExpiresAt,
	})
}

func PairUpstreamDevice(c *gin.Context) {
	var request dto.UpstreamPairDeviceRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	device, token, err := service.PairUpstreamSyncDevice(request.PairingCode, request.DeviceName)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": err.Error()})
		return
	}
	common.ApiSuccess(c, dto.UpstreamPairDeviceResponse{DeviceID: device.DeviceID, Token: token})
}

func RevokeUpstreamDevice(c *gin.Context) {
	if err := service.RevokeUpstreamSyncDevice(c.Param("device_id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func UpdateUpstreamSource(c *gin.Context) {
	sourceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || sourceID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid source id"})
		return
	}
	var request dto.UpstreamSourceUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if request.LowBalanceThreshold != nil {
		if *request.LowBalanceThreshold < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "low balance threshold must be non-negative"})
			return
		}
	}
	if request.StaticEgressIPs != nil {
		for _, value := range request.StaticEgressIPs {
			if net.ParseIP(strings.TrimSpace(value)) == nil {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid egress IP"})
				return
			}
		}
	}
	if err := model.UpdateUpstreamSourceWithOptions(model.UpstreamSourceMutation{
		SourceID:                sourceID,
		Enabled:                 request.Enabled,
		LowBalanceThreshold:     request.LowBalanceThreshold,
		StaticEgressIPs:         request.StaticEgressIPs,
		ModelAliases:            request.ModelAliases,
		ModelExclusions:         request.ModelExclusions,
		ProtocolModelExclusions: request.ProtocolModelExclusions,
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func IngestUpstreamSnapshot(c *gin.Context) {
	device, ok := authenticateUpstreamDevice(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, upstreamSnapshotBodyLimit)
	var snapshot dto.UpstreamSyncSnapshot
	if err := c.ShouldBindJSON(&snapshot); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid upstream snapshot"})
		return
	}
	result, err := service.IngestUpstreamSnapshot(device, snapshot)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if operation_setting.GetUpstreamOrchestrationSetting().Enabled {
		_, _, _ = service.EnqueueSystemTask(model.SystemTaskTypeUpstreamReconcile, nil)
	}
	common.ApiSuccess(c, result)
}

func ListUpstreamDeviceCommands(c *gin.Context) {
	device, ok := authenticateUpstreamDevice(c)
	if !ok {
		return
	}
	commands, err := model.ClaimPendingUpstreamSyncCommands(device.DeviceID, 20)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for i := range commands {
		if commands[i].DeviceID == "" {
			commands[i].DeviceID = device.DeviceID
		}
	}
	common.ApiSuccess(c, commands)
}

func CompleteUpstreamEnrollment(c *gin.Context) {
	device, ok := authenticateUpstreamDevice(c)
	if !ok {
		return
	}
	var result dto.UpstreamEnrollmentResult
	if err := c.ShouldBindJSON(&result); err != nil {
		common.ApiError(c, err)
		return
	}
	if result.CommandID != c.Param("command_id") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "command id mismatch"})
		return
	}
	if err := service.ApplyUpstreamEnrollmentResult(device.DeviceID, result); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func CompleteUpstreamDeviceCommand(c *gin.Context) {
	device, ok := authenticateUpstreamDevice(c)
	if !ok {
		return
	}
	var result struct {
		Success bool   `json:"success"`
		Result  string `json:"result,omitempty"`
		Error   string `json:"error,omitempty"`
	}
	if err := c.ShouldBindJSON(&result); err != nil {
		common.ApiError(c, err)
		return
	}
	status := model.UpstreamSyncCommandSucceeded
	if !result.Success {
		status = model.UpstreamSyncCommandFailed
	}
	command, err := model.GetUpstreamSyncCommand(c.Param("command_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if command.DeviceID != device.DeviceID {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "command belongs to another device"})
		return
	}
	if err := model.CompleteUpstreamSyncCommand(
		c.Param("command_id"),
		status,
		common.LocalLogPreview(result.Result),
		common.LocalLogPreview(result.Error),
	); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func RequestUpstreamSync(c *gin.Context) {
	command, err := model.CreateUpstreamSyncCommand("", "sync", "", map[string]any{
		"requested_at": common.GetTimestamp(),
		"full":         true,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, command)
}

func ReconcileUpstreamRoutes(c *gin.Context) {
	if !operation_setting.GetUpstreamOrchestrationSetting().Enabled {
		summary, err := service.PrepareManagedUpstreamShadows(time.Now())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, gin.H{"prepared": true, "summary": summary})
		return
	}
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeUpstreamReconcile, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"task": task.ToResponse(), "created": created})
}

func ProbeUpstreamRoute(c *gin.Context) {
	routeID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || routeID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid route id"})
		return
	}
	now := common.GetTimestamp()
	result := model.DB.Model(&model.UpstreamManagedRoute{}).
		Where("id = ? AND detached = ?", routeID, false).
		Updates(map[string]any{"next_probe_at": now, "updated_at": now})
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	if result.RowsAffected != 1 {
		common.ApiError(c, gorm.ErrRecordNotFound)
		return
	}
	_, _, _ = service.EnqueueSystemTask(model.SystemTaskTypeUpstreamProbe, nil)
	common.ApiSuccess(c, nil)
}

func PauseUpstreamRoute(c *gin.Context) {
	upstreamRouteAction(c, service.PauseManagedRoute)
}

func ResumeUpstreamRoute(c *gin.Context) {
	upstreamRouteAction(c, func(routeID int64, _ string) error {
		return service.ResumeManagedRoute(routeID)
	})
}

func DetachUpstreamRoute(c *gin.Context) {
	upstreamRouteAction(c, func(routeID int64, _ string) error {
		return service.DetachManagedRoute(routeID)
	})
}

func upstreamRouteAction(c *gin.Context, action func(int64, string) error) {
	routeID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || routeID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid route id"})
		return
	}
	var request dto.UpstreamRouteActionRequest
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&request); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := action(routeID, request.Reason); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func authenticateUpstreamDevice(c *gin.Context) (*model.UpstreamSyncDevice, bool) {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "message": service.ErrUpstreamDeviceUnauthorized.Error()})
		return nil, false
	}
	device, err := service.AuthenticateUpstreamSyncDevice(parts[1])
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrUpstreamDeviceUnauthorized) {
			status = http.StatusUnauthorized
		}
		c.AbortWithStatusJSON(status, gin.H{"success": false, "message": err.Error()})
		return nil, false
	}
	return device, true
}

func upstreamSnapshotIsStale(observedAt int64) bool {
	return observedAt < time.Now().Add(-5*time.Hour).Unix()
}

type upstreamProbeSummary struct {
	Tested    int `json:"tested"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
	Enabled   int `json:"enabled"`
	Disabled  int `json:"disabled"`
}

func runDueUpstreamProbeTask(ctx context.Context) (upstreamProbeSummary, error) {
	summary := upstreamProbeSummary{}
	now := common.GetTimestamp()
	var routes []model.UpstreamManagedRoute
	if err := model.DB.Where(
		"detached = ? AND next_probe_at > 0 AND next_probe_at <= ? AND state IN ?",
		false,
		now,
		[]string{
			model.UpstreamRouteStateActive,
			model.UpstreamRouteStateShadow,
			model.UpstreamRouteStateQuarantined,
		},
	).Order("source_id asc, next_probe_at asc, id asc").Find(&routes).Error; err != nil {
		return summary, err
	}
	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		return summary, err
	}
	timeout := time.Duration(operation_setting.GetUpstreamOrchestrationSetting().ProbeTimeoutSeconds) * time.Second
	for _, route := range routes {
		if ctx.Err() != nil {
			return summary, ctx.Err()
		}
		channel, err := model.GetChannelById(route.ChannelID, true)
		if err != nil {
			return summary, err
		}
		endpointType := string(constant.EndpointTypeOpenAI)
		if route.Protocol == model.UpstreamProtocolAnthropic {
			endpointType = string(constant.EndpointTypeAnthropic)
		}
		probeCtx, cancel := context.WithTimeout(ctx, timeout)
		started := time.Now()
		result := testChannel(probeCtx, channel, testUserID, "", endpointType, false)
		cancel()
		latency := time.Since(started).Milliseconds()
		summary.Tested++
		if result.localErr == nil && result.newAPIError == nil {
			before := route.State
			if route.State == model.UpstreamRouteStateActive {
				_, err = model.RecordUpstreamRouteSuccess(route.ChannelID, now, latency)
				if err == nil {
					err = model.DB.Model(&model.UpstreamManagedRoute{}).Where("id = ?", route.ID).
						Updates(map[string]any{"last_probe_at": now, "next_probe_at": int64(0), "updated_at": now}).Error
				}
			} else {
				err = service.MarkManagedRouteProbeResult(route.ID, true, latency, "")
			}
			if err != nil {
				return summary, err
			}
			summary.Succeeded++
			if before != model.UpstreamRouteStateActive {
				var current model.UpstreamManagedRoute
				if model.DB.First(&current, route.ID).Error == nil && current.State == model.UpstreamRouteStateActive {
					summary.Enabled++
				}
			}
			continue
		}

		message := "upstream probe failed"
		statusCode := http.StatusServiceUnavailable
		if result.newAPIError != nil {
			message = result.newAPIError.ErrorWithStatusCode()
			statusCode = result.newAPIError.StatusCode
		} else if result.localErr != nil {
			message = result.localErr.Error()
		}
		if route.State == model.UpstreamRouteStateActive {
			_, disabled, recordErr := service.RecordManagedChannelFailure(
				*relaytypes.NewChannelError(
					channel.Id,
					channel.Type,
					channel.Name,
					channel.ChannelInfo.IsMultiKey,
					"",
					channel.GetAutoBan(),
				),
				message,
			)
			if recordErr != nil {
				return summary, recordErr
			}
			if disabled {
				summary.Disabled++
			} else {
				_ = model.DB.Model(&model.UpstreamManagedRoute{}).Where("id = ?", route.ID).
					Updates(map[string]any{"last_probe_at": now, "next_probe_at": now + 60, "updated_at": now}).Error
			}
		} else if err := service.MarkManagedRouteProbeResult(route.ID, false, latency, message); err != nil {
			return summary, err
		}
		_ = statusCode
		summary.Failed++
	}
	if summary.Enabled > 0 {
		if _, err := service.ReconcileManagedUpstreams(time.Now()); err != nil {
			return summary, err
		}
	}
	return summary, nil
}
