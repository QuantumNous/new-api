package controller

import (
	"errors"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type asyncRetryRequest struct {
	ConfirmRisk bool `json:"confirm_risk"`
}

type asyncTaskManagementDetail struct {
	Task             *dto.TaskDto                `json:"task"`
	UpstreamResponse any                         `json:"upstream_response,omitempty"`
	Artifacts        []dto.AsyncArtifactResponse `json:"artifacts"`
	Events           []model.TaskEvent           `json:"events"`
}

func GetAdminAsyncTaskDetail(c *gin.Context) { getManagedAsyncTaskDetail(c, true) }
func GetUserAsyncTaskDetail(c *gin.Context)  { getManagedAsyncTaskDetail(c, false) }
func CancelAdminAsyncTask(c *gin.Context)    { cancelManagedAsyncTask(c, true) }
func CancelUserAsyncTask(c *gin.Context)     { cancelManagedAsyncTask(c, false) }

func getManagedAsyncJob(c *gin.Context, administrator bool) *model.AsyncJob {
	job, err := model.GetAsyncJobForSession(c.Request.Context(), c.Param("task_id"), c.GetInt("id"), administrator)
	if err != nil {
		common.ApiError(c, err)
		return nil
	}
	if job == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "async task was not found"})
		return nil
	}
	return job
}

func getManagedAsyncTaskDetail(c *gin.Context, administrator bool) {
	job := getManagedAsyncJob(c, administrator)
	if job == nil {
		return
	}
	items, err := tasksToDto(c.Request.Context(), []*model.Task{&job.Task}, administrator)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	artifacts, err := managedAsyncArtifacts(c, job.TaskID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	events, err := model.ListTaskEvents(c.Request.Context(), job.TaskID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, asyncTaskManagementDetail{
		Task:             items[0],
		UpstreamResponse: job.ResultPayload,
		Artifacts:        artifacts,
		Events:           events,
	})
}

func managedAsyncArtifacts(c *gin.Context, taskID int64) ([]dto.AsyncArtifactResponse, error) {
	artifacts, err := model.ListArtifactsByTaskID(c.Request.Context(), taskID)
	if err != nil || len(artifacts) == 0 {
		return []dto.AsyncArtifactResponse{}, err
	}
	store, err := newAsyncArtifactStore(c.Request.Context())
	if err != nil {
		return nil, err
	}
	ttl := time.Duration(common.GetEnvOrDefault("ASYNC_SIGNED_URL_TTL_SECONDS", 900)) * time.Second
	result := make([]dto.AsyncArtifactResponse, 0, len(artifacts))
	for _, artifact := range artifacts {
		url, signErr := store.SignedURL(c.Request.Context(), artifact.ObjectKey, ttl)
		if signErr != nil {
			return nil, signErr
		}
		result = append(result, dto.AsyncArtifactResponse{
			ContentType: artifact.ContentType,
			SizeBytes:   artifact.SizeBytes,
			SHA256:      artifact.SHA256,
			ExpiresAt:   artifact.ExpiresAt,
			URL:         url,
		})
	}
	return result, nil
}

func cancelManagedAsyncTask(c *gin.Context, administrator bool) {
	job := getManagedAsyncJob(c, administrator)
	if job == nil {
		return
	}
	if job.ExecutionStatus == model.AsyncStatusRunning {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "the upstream has no cancellation API; the running request was not interrupted"})
		return
	}
	if job.ExecutionStatus != model.AsyncStatusQueued {
		common.ApiSuccess(c, asyncTaskStatusResponse(job))
		return
	}
	actorType := "user"
	if administrator {
		actorType = "admin"
	}
	cancelled, changed, err := model.CancelQueuedAsyncJobByID(c.Request.Context(), job.ID, actorType, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if changed {
		if _, err := model.RefundAsyncJobBilling(c.Request.Context(), cancelled.ID); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	latest, err := model.GetAsyncJobForSession(c.Request.Context(), job.Task.TaskID, c.GetInt("id"), administrator)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if latest == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "async task was not found after cancellation"})
		return
	}
	common.ApiSuccess(c, asyncTaskStatusResponse(latest))
}

func RetryAdminAsyncTask(c *gin.Context) {
	job := getManagedAsyncJob(c, true)
	if job == nil {
		return
	}
	var request asyncRetryRequest
	if err := c.ShouldBindJSON(&request); err != nil || !request.ConfirmRisk {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "manual retry requires explicit confirmation of duplicate generation and billing risk"})
		return
	}
	if job.ExecutionStatus != model.AsyncStatusFailure && job.ExecutionStatus != model.AsyncStatusUncertain {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "only FAILURE or UNCERTAIN tasks can be retried"})
		return
	}
	retried, changed, err := model.RetryAsyncJob(c.Request.Context(), job.ID, c.GetInt("id"))
	if err != nil {
		if errors.Is(err, model.ErrAsyncRetryQuotaInsufficient) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
			return
		}
		common.ApiError(c, err)
		return
	}
	if !changed {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "task state changed before it could be retried"})
		return
	}
	common.ApiSuccess(c, asyncTaskStatusResponse(retried))
}
