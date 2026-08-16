package controller

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type channelContributionTestResultResponse struct {
	Id              int64  `json:"id"`
	Model           string `json:"model"`
	EndpointType    string `json:"endpoint_type"`
	Stream          bool   `json:"stream"`
	Mode            string `json:"mode"`
	Success         bool   `json:"success"`
	PriceConfigured bool   `json:"price_configured"`
	LatencyMs       int64  `json:"latency_ms"`
	Error           string `json:"error"`
	CreatedAt       int64  `json:"created_at"`
}

type channelContributionTestRunResponse struct {
	Id             int64                                   `json:"id"`
	ContributionId int                                     `json:"contribution_id"`
	RevisionId     int                                     `json:"revision_id"`
	RevisionNumber int                                     `json:"revision_number"`
	ActorId        int                                     `json:"actor_id"`
	ActorType      string                                  `json:"actor_type"`
	Status         model.ChannelContributionTestRunStatus  `json:"status"`
	PricingReady   bool                                    `json:"pricing_ready"`
	Total          int                                     `json:"total"`
	Passed         int                                     `json:"passed"`
	Failed         int                                     `json:"failed"`
	Error          string                                  `json:"error"`
	StartedAt      int64                                   `json:"started_at"`
	CompletedAt    int64                                   `json:"completed_at"`
	CreatedAt      int64                                   `json:"created_at"`
	UpdatedAt      int64                                   `json:"updated_at"`
	Results        []channelContributionTestResultResponse `json:"results,omitempty"`
}

func buildChannelContributionTestRunResponse(run *model.ChannelContributionTestRun, includeResults bool) (*channelContributionTestRunResponse, error) {
	if run == nil {
		return nil, nil
	}
	revision, err := model.GetChannelContributionRevision(run.ContributionId, run.RevisionId)
	if err != nil {
		return nil, err
	}
	pricingReady, _ := channelContributionPriceStatus(channelContributionModels(revision.Models))
	response := &channelContributionTestRunResponse{
		Id:             run.Id,
		ContributionId: run.ContributionId,
		RevisionId:     run.RevisionId,
		RevisionNumber: revision.RevisionNumber,
		ActorId:        run.ActorId,
		ActorType:      run.ActorType,
		Status:         run.Status,
		PricingReady:   pricingReady,
		Total:          run.Total,
		Passed:         run.Passed,
		Failed:         run.Failed,
		Error:          run.Error,
		StartedAt:      run.StartedAt,
		CompletedAt:    run.CompletedAt,
		CreatedAt:      run.CreatedAt,
		UpdatedAt:      run.UpdatedAt,
	}
	if !includeResults {
		return response, nil
	}
	results, err := model.ListChannelContributionTestResults(run.Id)
	if err != nil {
		return nil, err
	}
	response.Results = make([]channelContributionTestResultResponse, 0, len(results))
	for _, result := range results {
		mode := "non_stream"
		if result.Stream {
			mode = "stream"
		}
		response.Results = append(response.Results, channelContributionTestResultResponse{
			Id:              result.Id,
			Model:           result.Model,
			EndpointType:    result.EndpointType,
			Stream:          result.Stream,
			Mode:            mode,
			Success:         result.Success,
			PriceConfigured: helper.HasModelBillingConfig(result.Model),
			LatencyMs:       result.LatencyMs,
			Error:           result.Error,
			CreatedAt:       result.CreatedAt,
		})
	}
	return response, nil
}

func validateChannelContributionSubmissionRun(runId int64, contribution *model.ChannelContribution, revision *model.ChannelContributionRevision, actorType string) error {
	if runId <= 0 {
		return errors.New("test_run_id is required")
	}
	run, err := model.GetChannelContributionTestRunForContribution(runId, contribution.Id)
	if err != nil {
		return err
	}
	if run.RevisionId != revision.Id || run.ConfigHash != revision.ConfigHash {
		return errors.New("test run does not match the submitted revision")
	}
	if run.ActorType != actorType {
		return fmt.Errorf("a %s test run is required", actorType)
	}
	if run.Status != model.ChannelContributionTestRunStatusSucceeded || run.Failed != 0 || run.Passed != run.Total || run.Total <= 0 {
		return errors.New("test run has not passed all required probes")
	}
	specs, err := resolveChannelContributionProbeSpecs(revision)
	if err != nil {
		return err
	}
	expected := 0
	for _, spec := range specs {
		expected += len(spec.Streams)
	}
	if run.Total != expected {
		return errors.New("test run does not cover every required model mode")
	}
	now := common.GetTimestamp()
	if run.CompletedAt <= 0 || run.CompletedAt > now+60 || now-run.CompletedAt > channelContributionTestResultTTLSeconds {
		return errors.New("test run has expired; run all model tests again")
	}
	return nil
}

func enqueueChannelContributionTestRun(contribution *model.ChannelContribution, revision *model.ChannelContributionRevision, actorId int, actorType string) (*model.ChannelContributionTestRun, error) {
	if contribution == nil || revision == nil {
		return nil, errors.New("contribution and revision are required")
	}
	if _, err := resolveChannelContributionProbeSpecs(revision); err != nil {
		return nil, err
	}
	run := &model.ChannelContributionTestRun{
		ContributionId: contribution.Id,
		RevisionId:     revision.Id,
		ConfigHash:     revision.ConfigHash,
		ActorId:        actorId,
		ActorType:      actorType,
		Status:         model.ChannelContributionTestRunStatusQueued,
	}
	if err := model.CreateChannelContributionTestRun(run); err != nil {
		return nil, err
	}
	if _, _, err := service.EnqueueSystemTask(model.SystemTaskTypeChannelContributionTest, nil); err != nil {
		common.SysError(fmt.Sprintf("failed to wake channel contribution test runner: run_id=%d err=%v", run.Id, err))
	}
	return run, nil
}

func CreateUserChannelContributionTestRun(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetUserChannelContributionById(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := loadChannelContributionRevision(contribution.CurrentRevisionId)
	if err != nil || revision == nil {
		if err == nil {
			err = errors.New("current revision is missing")
		}
		common.ApiError(c, err)
		return
	}
	if revision.Status == model.ChannelContributionRevisionStatusPending || revision.Status == model.ChannelContributionRevisionStatusApproved || revision.Status == model.ChannelContributionRevisionStatusSuperseded {
		common.ApiErrorMsg(c, "current revision is not editable or testable by the contributor")
		return
	}
	run, err := enqueueChannelContributionTestRun(contribution, revision, c.GetInt("id"), model.ChannelContributionTestActorUser)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionTestRunResponse(run, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func GetUserChannelContributionTestRun(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := model.GetUserChannelContributionById(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	runId, err := strconv.ParseInt(c.Param("runId"), 10, 64)
	if err != nil || runId <= 0 {
		common.ApiErrorMsg(c, "invalid test run id")
		return
	}
	run, err := model.GetChannelContributionTestRunForContribution(runId, id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionTestRunResponse(run, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func CreateAdminChannelContributionTestRun(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	contribution, err := model.GetChannelContributionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	revision, err := loadChannelContributionRevision(contribution.PendingRevisionId)
	if err != nil || revision == nil {
		if err == nil {
			err = errors.New("pending revision is missing")
		}
		common.ApiError(c, err)
		return
	}
	run, err := enqueueChannelContributionTestRun(contribution, revision, c.GetInt("id"), model.ChannelContributionTestActorAdmin)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionTestRunResponse(run, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

func GetAdminChannelContributionTestRun(c *gin.Context) {
	id, err := channelContributionId(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runId, err := strconv.ParseInt(c.Param("runId"), 10, 64)
	if err != nil || runId <= 0 {
		common.ApiErrorMsg(c, "invalid test run id")
		return
	}
	run, err := model.GetChannelContributionTestRunForContribution(runId, id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response, err := buildChannelContributionTestRunResponse(run, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, response)
}

type channelContributionTestTaskSummary struct {
	Runs      int `json:"runs"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
}

type channelContributionTestHandler struct{}

func (channelContributionTestHandler) Type() string {
	return model.SystemTaskTypeChannelContributionTest
}

func (channelContributionTestHandler) Enabled() bool {
	return model.HasUnfinishedChannelContributionTestRuns()
}

func (channelContributionTestHandler) Interval() time.Duration { return 15 * time.Second }

func (channelContributionTestHandler) NewPayload() any { return nil }

func (channelContributionTestHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	summary := channelContributionTestTaskSummary{}
	if requeued, err := model.RequeueRunningChannelContributionTestRuns(); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	} else if requeued > 0 {
		common.SysLog(fmt.Sprintf("requeued %d interrupted channel contribution test runs", requeued))
	}
	for ctx.Err() == nil {
		run, err := model.ClaimNextQueuedChannelContributionTestRun()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			break
		}
		if err != nil {
			finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
			return
		}
		summary.Runs++
		if err := executeChannelContributionTestRun(ctx, run); err != nil {
			summary.Failed++
			common.SysError(fmt.Sprintf("channel contribution test run failed: run_id=%d err=%v", run.Id, err))
		} else {
			reloaded, reloadErr := model.GetChannelContributionTestRun(run.Id)
			if reloadErr != nil || reloaded.Status != model.ChannelContributionTestRunStatusSucceeded {
				summary.Failed++
			} else {
				summary.Succeeded++
			}
		}
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

type channelContributionProbeJob struct {
	Index        int
	Model        string
	EndpointType string
	Stream       bool
}

func executeChannelContributionProbe(
	ctx context.Context,
	run *model.ChannelContributionTestRun,
	revision *model.ChannelContributionRevision,
	channel *model.Channel,
	job channelContributionProbeJob,
) model.ChannelContributionTestResult {
	probeCtx, cancel := context.WithTimeout(ctx, channelContributionProbeTimeoutSeconds*time.Second)
	defer cancel()
	started := time.Now()
	result := testChannelWithOptions(
		probeCtx,
		channel,
		run.ActorId,
		job.Model,
		job.EndpointType,
		job.Stream,
		channelTestOptions{
			UseSSRFProtectedClient: true,
			SkipConsumeLog:         true,
			SkipPricingValidation:  true,
			GroupOverride:          revision.Group,
		},
	)
	probeError := ""
	if result.localErr != nil {
		probeError = result.localErr.Error()
	} else if result.newAPIError != nil {
		probeError = result.newAPIError.Error()
	}
	if probeError != "" {
		probeError = sanitizeChannelCredentialError(errors.New(probeError), revision.Key, revision.BaseURL).Error()
		probeError = truncateChannelContributionError(probeError, 2_000)
	}
	return model.ChannelContributionTestResult{
		Model:        job.Model,
		EndpointType: job.EndpointType,
		Stream:       job.Stream,
		Success:      probeError == "",
		LatencyMs:    time.Since(started).Milliseconds(),
		Error:        probeError,
	}
}

func executeChannelContributionTestRun(ctx context.Context, run *model.ChannelContributionTestRun) error {
	revision, err := model.GetChannelContributionRevision(run.ContributionId, run.RevisionId)
	if err != nil {
		return finishFailedChannelContributionRun(run, nil, false, err)
	}
	if revision.ConfigHash != run.ConfigHash {
		return finishFailedChannelContributionRun(run, nil, false, errors.New("revision config hash changed"))
	}
	specs, err := resolveChannelContributionProbeSpecs(revision)
	if err != nil {
		return finishFailedChannelContributionRun(run, nil, false, err)
	}
	priceReady, _ := channelContributionPriceStatus(channelContributionModels(revision.Models))
	baseURL := revision.BaseURL
	mapping := revision.ModelMapping
	channel := &model.Channel{
		Type:         revision.Type,
		Key:          revision.Key,
		Status:       common.ChannelStatusEnabled,
		Name:         revision.Name,
		BaseURL:      &baseURL,
		Models:       revision.Models,
		Group:        revision.Group,
		ModelMapping: &mapping,
	}

	jobs := make([]channelContributionProbeJob, 0, len(specs)*2)
	for _, spec := range specs {
		for _, stream := range spec.Streams {
			jobs = append(jobs, channelContributionProbeJob{
				Index:        len(jobs),
				Model:        spec.Model,
				EndpointType: string(spec.EndpointType),
				Stream:       stream,
			})
		}
	}
	results := make([]model.ChannelContributionTestResult, len(jobs))
	completed := make([]bool, len(jobs))
	jobQueue := make(chan channelContributionProbeJob, len(jobs))
	for _, job := range jobs {
		jobQueue <- job
	}
	close(jobQueue)
	workerCount := 4
	if len(jobs) < workerCount {
		workerCount = len(jobs)
	}
	var workers sync.WaitGroup
	workers.Add(workerCount)
	for range workerCount {
		go func() {
			defer workers.Done()
			for {
				if ctx.Err() != nil {
					return
				}
				select {
				case <-ctx.Done():
					return
				case job, ok := <-jobQueue:
					if !ok {
						return
					}
					results[job.Index] = executeChannelContributionProbe(ctx, run, revision, channel, job)
					completed[job.Index] = true
				}
			}
		}()
	}
	workers.Wait()

	allPassed := ctx.Err() == nil
	cancellationError := ""
	if ctx.Err() != nil {
		cancellationError = sanitizeChannelCredentialError(ctx.Err(), revision.Key, revision.BaseURL).Error()
	}
	for index, job := range jobs {
		if !completed[index] {
			results[index] = model.ChannelContributionTestResult{
				Model:        job.Model,
				EndpointType: job.EndpointType,
				Stream:       job.Stream,
				Success:      false,
				Error:        cancellationError,
			}
		}
		if !results[index].Success {
			allPassed = false
		}
	}
	status := model.ChannelContributionTestRunStatusSucceeded
	runError := ""
	if !allPassed {
		status = model.ChannelContributionTestRunStatusFailed
		if cancellationError != "" {
			runError = cancellationError
		} else {
			runError = "one or more model probes failed"
		}
	}
	return model.FinishChannelContributionTestRun(run.Id, status, priceReady, results, runError)
}

func finishFailedChannelContributionRun(run *model.ChannelContributionTestRun, results []model.ChannelContributionTestResult, priceReady bool, runErr error) error {
	message := runErr.Error()
	message = truncateChannelContributionError(message, 2_000)
	if err := model.FinishChannelContributionTestRun(run.Id, model.ChannelContributionTestRunStatusFailed, priceReady, results, message); err != nil {
		return fmt.Errorf("%v; failed to persist terminal state: %w", runErr, err)
	}
	return runErr
}

func channelContributionTestRunPathId(c *gin.Context) (int64, error) {
	runId, err := strconv.ParseInt(strings.TrimSpace(c.Param("runId")), 10, 64)
	if err != nil || runId <= 0 {
		return 0, errors.New("invalid test run id")
	}
	return runId, nil
}
