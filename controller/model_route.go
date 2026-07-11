package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/modelroute"
	"github.com/gin-gonic/gin"
)

// MigrateToModelPriority POST /api/model_route/migrate (PRD §4).
func MigrateToModelPriority(c *gin.Context) {
	res, err := modelroute.MigrateToModelPriority()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "model_route.migrate", map[string]interface{}{
		"policies": res.PoliciesTouched,
		"metrics":  res.MetricsTouched,
		"zeroed":   res.ChannelsZeroed,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": res})
}

type resetLearningRequest struct {
	ChannelID      int64  `json:"channel_id"`
	EffectiveModel string `json:"effective_model"`
	Confirm        bool   `json:"confirm"`
}

// ResetRuntimeLearning POST /api/model_route/reset-runtime-learning (PRD §18.1).
func ResetRuntimeLearning(c *gin.Context) {
	var req resetLearningRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid body"})
		return
	}
	n, err := modelroute.ResetRuntimeLearning(req.ChannelID, req.EffectiveModel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "model_route.reset_runtime", map[string]interface{}{
		"channel_id": req.ChannelID, "effective_model": req.EffectiveModel, "count": n,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"reset": n}})
}

// ResetAllLearning POST /api/model_route/reset-all-learning (PRD §18.2) requires confirm=true.
func ResetAllLearning(c *gin.Context) {
	var req resetLearningRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid body"})
		return
	}
	if !req.Confirm {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "confirm=true required"})
		return
	}
	n, err := modelroute.ResetAllLearning(req.ChannelID, req.EffectiveModel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "model_route.reset_all", map[string]interface{}{
		"channel_id": req.ChannelID, "effective_model": req.EffectiveModel, "count": n,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"reset": n}})
}

// ListModelRoutePolicies GET /api/model_route/policies
func ListModelRoutePolicies(c *gin.Context) {
	requested := c.Query("requested_model")
	var rows []model.ChannelModelPolicy
	var err error
	if requested != "" {
		rows, err = model.ListChannelModelPoliciesByRequestedModel(requested)
	} else if ch := c.Query("channel_id"); ch != "" {
		id, _ := strconv.ParseInt(ch, 10, 64)
		rows, err = model.ListChannelModelPoliciesByChannel(id)
	} else {
		rows, err = model.ListAllChannelModelPolicies()
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": rows})
}

type updatePolicyPriorityRequest struct {
	ChannelID      int64  `json:"channel_id"`
	RequestedModel string `json:"requested_model"`
	ManualPriority int    `json:"manual_priority"`
}

// UpdateModelRoutePolicyPriority PUT /api/model_route/policies/priority
func UpdateModelRoutePolicyPriority(c *gin.Context) {
	var req updatePolicyPriorityRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.ChannelID == 0 || req.RequestedModel == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id and requested_model required"})
		return
	}
	if err := model.UpdateChannelModelPolicyManualPriority(req.ChannelID, req.RequestedModel, req.ManualPriority); err != nil {
		common.ApiError(c, err)
		return
	}
	modelroute.InvalidateRoutePlan(req.RequestedModel)
	recordManageAudit(c, "model_route.policy_priority", map[string]interface{}{
		"channel_id": req.ChannelID, "requested_model": req.RequestedModel, "priority": req.ManualPriority,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// ListModelRouteMetrics GET /api/model_route/metrics
func ListModelRouteMetrics(c *gin.Context) {
	var rows []model.ChannelModelMetrics
	var err error
	if ch := c.Query("channel_id"); ch != "" {
		id, _ := strconv.ParseInt(ch, 10, 64)
		rows, err = model.ListChannelModelMetricsByChannel(id)
	} else {
		rows, err = model.ListAllChannelModelMetrics()
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// attach runtime role
	type rowView struct {
		model.ChannelModelMetrics
		Role    string `json:"role"`
		IsStale bool   `json:"is_stale"`
	}
	out := make([]rowView, 0, len(rows))
	for i := range rows {
		mk := model.MetricsKey{ChannelID: rows[i].ChannelID, EffectiveModel: rows[i].EffectiveModel}
		out = append(out, rowView{
			ChannelModelMetrics: rows[i],
			Role:                string(modelroute.GlobalRoles.Get(mk)),
			IsStale:             modelroute.IsRouteStale(&rows[i], false),
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": out})
}

type metricsActionRequest struct {
	ChannelID      int64  `json:"channel_id"`
	EffectiveModel string `json:"effective_model"`
	Action         string `json:"action"` // trip_open | force_probe | manual_disable | restore_auto
}

// ModelRouteMetricsAction POST /api/model_route/metrics/action (PRD §34 ops).
func ModelRouteMetricsAction(c *gin.Context) {
	var req metricsActionRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.ChannelID == 0 || req.EffectiveModel == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id, effective_model, action required"})
		return
	}
	var ev modelroute.TransitionEvent
	switch req.Action {
	case "trip_open":
		ev = modelroute.EventTripOpen
	case "force_probe":
		ev = modelroute.EventForceProbe
	case "manual_disable":
		ev = modelroute.EventManualDisable
	case "restore_auto":
		ev = modelroute.EventRestoreAuto
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "unknown action"})
		return
	}
	if err := modelroute.AdminForceState(req.ChannelID, req.EffectiveModel, ev); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Action == "force_probe" {
		m, _ := model.GetChannelModelMetrics(req.ChannelID, req.EffectiveModel)
		if m != nil {
			modelroute.EnqueueFromMetrics(m, 0)
		}
	}
	recordManageAudit(c, "model_route.metrics_action", map[string]interface{}{
		"channel_id": req.ChannelID, "effective_model": req.EffectiveModel, "action": req.Action,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
