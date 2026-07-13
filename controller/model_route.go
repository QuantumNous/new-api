package controller

import (
	"net/http"
	"sort"
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
	ids := make([]int64, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].ChannelID)
	}
	channels := channelDisplayMap(ids)
	type policyView struct {
		model.ChannelModelPolicy
		ChannelName    string `json:"channel_name"`
		BaseURL        string `json:"base_url"`
		EffectiveModel string `json:"effective_model"`
	}
	out := make([]policyView, 0, len(rows))
	for i := range rows {
		info := channels[rows[i].ChannelID]
		out = append(out, policyView{
			ChannelModelPolicy: rows[i],
			ChannelName:        info.Name,
			BaseURL:            info.BaseURL,
			EffectiveModel:     resolvePolicyEffectiveModel(rows[i].RequestedModel, info.ModelMapping),
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": out})
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
	// attach runtime role + channel display + reverse requested models
	ids := make([]int64, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].ChannelID)
	}
	channels := channelDisplayMap(ids)
	requestedByMetrics := buildRequestedModelsByMetricsKey(ids, channels)
	type rowView struct {
		model.ChannelModelMetrics
		Role            string   `json:"role"`
		IsStale         bool     `json:"is_stale"`
		ChannelName     string   `json:"channel_name"`
		BaseURL         string   `json:"base_url"`
		RequestedModels []string `json:"requested_models"`
	}
	out := make([]rowView, 0, len(rows))
	for i := range rows {
		mk := model.MetricsKey{ChannelID: rows[i].ChannelID, EffectiveModel: rows[i].EffectiveModel}
		info := channels[rows[i].ChannelID]
		requested := requestedByMetrics[metricsViewKey(rows[i].ChannelID, rows[i].EffectiveModel)]
		if requested == nil {
			requested = []string{}
		}
		out = append(out, rowView{
			ChannelModelMetrics: rows[i],
			Role:                string(modelroute.GlobalRoles.Get(mk)),
			IsStale:             modelroute.IsRouteStale(&rows[i], false),
			ChannelName:         info.Name,
			BaseURL:             info.BaseURL,
			RequestedModels:     requested,
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

type channelDisplayInfo struct {
	Name         string
	BaseURL      string
	ModelMapping string
}

// channelDisplayMap returns id -> channel name/base_url/mapping for admin display (best-effort).
func channelDisplayMap(ids []int64) map[int64]channelDisplayInfo {
	out := make(map[int64]channelDisplayInfo, len(ids))
	if len(ids) == 0 {
		return out
	}
	uniq := make(map[int64]struct{}, len(ids))
	intIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, ok := uniq[id]; ok {
			continue
		}
		uniq[id] = struct{}{}
		intIDs = append(intIDs, int(id))
	}
	if len(intIDs) == 0 {
		return out
	}
	chs, err := model.GetChannelsByIds(intIDs)
	if err != nil {
		return out
	}
	for _, ch := range chs {
		if ch == nil {
			continue
		}
		out[int64(ch.Id)] = channelDisplayInfo{
			Name:         ch.Name,
			BaseURL:      ch.GetBaseURL(),
			ModelMapping: ch.GetModelMapping(),
		}
	}
	return out
}

// resolvePolicyEffectiveModel applies current channel mapping; falls back to requested on error.
func resolvePolicyEffectiveModel(requestedModel, modelMappingJSON string) string {
	effective, _, err := modelroute.ResolveEffectiveModel(requestedModel, modelMappingJSON)
	if err != nil || effective == "" {
		return requestedModel
	}
	return effective
}

func metricsViewKey(channelID int64, effectiveModel string) string {
	return strconv.FormatInt(channelID, 10) + "\x00" + effectiveModel
}

// buildRequestedModelsByMetricsKey reverse-maps policies to metrics keys via current mapping.
// key: channelID\x00effective_model → sorted unique requested_model list.
func buildRequestedModelsByMetricsKey(channelIDs []int64, channels map[int64]channelDisplayInfo) map[string][]string {
	out := make(map[string][]string)
	if len(channelIDs) == 0 {
		return out
	}
	need := make(map[int64]struct{}, len(channelIDs))
	for _, id := range channelIDs {
		if id > 0 {
			need[id] = struct{}{}
		}
	}
	if len(need) == 0 {
		return out
	}

	// Prefer per-channel loads when filtered to one channel; otherwise one full scan.
	var policies []model.ChannelModelPolicy
	if len(need) == 1 {
		for id := range need {
			rows, err := model.ListChannelModelPoliciesByChannel(id)
			if err == nil {
				policies = rows
			}
		}
	} else {
		rows, err := model.ListAllChannelModelPolicies()
		if err == nil {
			for i := range rows {
				if _, ok := need[rows[i].ChannelID]; ok {
					policies = append(policies, rows[i])
				}
			}
		}
	}

	seen := make(map[string]map[string]struct{}) // metricsKey -> requested set
	for i := range policies {
		p := policies[i]
		if _, ok := need[p.ChannelID]; !ok {
			continue
		}
		info := channels[p.ChannelID]
		effective := resolvePolicyEffectiveModel(p.RequestedModel, info.ModelMapping)
		key := metricsViewKey(p.ChannelID, effective)
		if seen[key] == nil {
			seen[key] = make(map[string]struct{})
		}
		if p.RequestedModel == "" {
			continue
		}
		seen[key][p.RequestedModel] = struct{}{}
	}
	for key, set := range seen {
		list := make([]string, 0, len(set))
		for req := range set {
			list = append(list, req)
		}
		sort.Strings(list)
		out[key] = list
	}
	return out
}

