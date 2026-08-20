package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	intelligentrouting "github.com/QuantumNous/new-api/service/intelligent_routing"
	"github.com/gin-gonic/gin"
)

func ListIntelligentRoutingPolicies(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	policies, total, err := model.ListIntelligentRoutingPolicies((page-1)*pageSize, pageSize)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": policies, "total": total, "page": page, "page_size": pageSize})
}

func GetIntelligentRoutingPolicy(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid policy id"})
		return
	}
	policy, err := model.GetIntelligentRoutingPolicy(id)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": policy})
}

func CreateIntelligentRoutingPolicy(c *gin.Context) {
	var request dto.IntelligentRoutingDraftRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	policy, issues, err := intelligentrouting.DefaultPolicyControl.CreateDraft(c, request.Config, c.GetInt("id"))
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	if len(issues) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "issues": issues})
		return
	}
	recordManageAudit(c, "intelligent_routing.policy.create", map[string]interface{}{"id": policy.Id})
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": policy})
}

func UpdateIntelligentRoutingPolicy(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid policy id"})
		return
	}
	var request dto.IntelligentRoutingDraftUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	policy, issues, err := intelligentrouting.DefaultPolicyControl.UpdateDraft(c, id, request.UpdatedAt, request.Config)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	if len(issues) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "issues": issues})
		return
	}
	recordManageAudit(c, "intelligent_routing.policy.update", map[string]interface{}{"id": policy.Id})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": policy})
}

func ValidateIntelligentRoutingPolicy(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid policy id"})
		return
	}
	policy, err := model.GetIntelligentRoutingPolicy(id)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	validated, issues := intelligentrouting.ValidatePolicyDocument(policy.Config)
	c.JSON(http.StatusOK, gin.H{"success": len(issues) == 0, "data": gin.H{"checksum": validated.Checksum, "issues": issues}})
}

func PublishIntelligentRoutingPolicy(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid policy id"})
		return
	}
	var request dto.IntelligentRoutingPublishRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	policy, issues, err := intelligentrouting.DefaultPolicyControl.Publish(c, id, c.GetInt("id"), request.ChangeNote)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	if len(issues) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "issues": issues})
		return
	}
	recordManageAudit(c, "intelligent_routing.policy.publish", map[string]interface{}{"id": policy.Id, "version": policy.Version})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": policy})
}

func RollbackIntelligentRoutingPolicy(c *gin.Context) {
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid policy version"})
		return
	}
	var request dto.IntelligentRoutingPublishRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	policy, issues, err := intelligentrouting.DefaultPolicyControl.Rollback(c, version, c.GetInt("id"), request.ChangeNote)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	if len(issues) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "issues": issues})
		return
	}
	recordManageAudit(c, "intelligent_routing.policy.rollback", map[string]interface{}{"source_version": version, "version": policy.Version})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": policy})
}

func GetIntelligentRoutingRollout(c *gin.Context) {
	rollout, err := model.GetIntelligentRoutingRollout()
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rollout})
}

func UpdateIntelligentRoutingRollout(c *gin.Context) {
	var request dto.IntelligentRoutingRolloutUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	userGroups, err := common.Marshal(request.UserGroups)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	tokenGroups, err := common.Marshal(request.TokenGroups)
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	rollout, issues, err := intelligentrouting.DefaultPolicyControl.UpdateRollout(c, request.Revision, model.IntelligentRoutingRollout{
		PolicyVersion: request.PolicyVersion, Enabled: request.Enabled, Mode: request.Mode, TrafficPercent: request.TrafficPercent,
		UserGroups: string(userGroups), TokenGroups: string(tokenGroups), UpdatedBy: c.GetInt("id"),
	})
	if err != nil {
		intelligentRoutingError(c, err)
		return
	}
	if len(issues) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "issues": issues})
		return
	}
	recordManageAudit(c, "intelligent_routing.rollout.update", map[string]interface{}{"revision": rollout.Revision, "policy_version": rollout.PolicyVersion, "mode": rollout.Mode, "traffic_percent": rollout.TrafficPercent})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rollout})
}

func intelligentRoutingError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrIntelligentRoutingPolicyNotFound), errors.Is(err, model.ErrIntelligentRoutingRolloutNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "resource not found"})
	case errors.Is(err, model.ErrIntelligentRoutingRevisionConflict):
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "revision conflict"})
	case errors.Is(err, model.ErrIntelligentRoutingPolicyImmutable):
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "published policy is immutable"})
	default:
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "intelligent routing service unavailable"})
	}
}
