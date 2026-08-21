package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	assetTaskWorkerLeaseSeconds     = 120
	assetTaskWorkerBatchSize        = 10
	assetTaskAssetReadyTimeout      = 5 * time.Minute
	assetTaskAssetReadyPollInterval = time.Second
)

var (
	assetTaskWorkerNowUnix           = func() int64 { return time.Now().Unix() }
	assetTaskPreparationLeaseSeconds = int64(assetTaskWorkerLeaseSeconds)
	runLeasedAssetTaskFunc           = runLeasedAssetTask
)

type AssetTaskWorkerConfig struct {
	Owner    string
	Interval time.Duration
	Limit    int
}

type taskPreparationLease struct {
	taskID       string
	owner        string
	attemptCount int
	ttlSeconds   int64
	stopOnce     sync.Once
	stopRenewal  chan struct{}
	renewalDone  chan struct{}
	cancel       context.CancelFunc
	mu           sync.RWMutex
	expiresAt    int64
	renewalError error
}

func startTaskPreparationLease(parent context.Context, taskID string, owner string, attemptCount int, leaseExpiresAt int64) (context.Context, *taskPreparationLease) {
	if parent == nil {
		parent = context.Background()
	}
	ctx, cancel := context.WithCancel(parent)
	lease := &taskPreparationLease{
		taskID:       taskID,
		owner:        owner,
		attemptCount: attemptCount,
		ttlSeconds:   assetTaskPreparationLeaseSeconds,
		stopRenewal:  make(chan struct{}),
		renewalDone:  make(chan struct{}),
		cancel:       cancel,
		expiresAt:    leaseExpiresAt,
	}
	go lease.runHeartbeat(ctx)
	return ctx, lease
}

func (l *taskPreparationLease) runHeartbeat(ctx context.Context) {
	defer close(l.renewalDone)
	interval := time.Duration(l.ttlSeconds) * time.Second / 3
	if interval < 100*time.Millisecond {
		interval = 100 * time.Millisecond
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-l.stopRenewal:
			return
		case <-ticker.C:
			currentExpiresAt, _ := l.snapshot()
			now := assetTaskWorkerNowUnix()
			nextExpiresAt := now + l.ttlSeconds
			if nextExpiresAt <= currentExpiresAt {
				continue
			}
			won, err := model.RenewTaskPreparationLease(l.taskID, l.owner, currentExpiresAt, now, nextExpiresAt)
			if err != nil {
				l.lose(fmt.Errorf("renew task preparation lease: %w", err))
				return
			}
			if !won {
				l.lose(fmt.Errorf("task preparation lease lost"))
				return
			}
			l.setExpiresAt(nextExpiresAt)
		}
	}
}

func (l *taskPreparationLease) setExpiresAt(expiresAt int64) {
	l.mu.Lock()
	l.expiresAt = expiresAt
	l.mu.Unlock()
}

func (l *taskPreparationLease) lose(err error) {
	l.mu.Lock()
	if l.renewalError == nil {
		l.renewalError = err
	}
	l.mu.Unlock()
	l.cancel()
}

func (l *taskPreparationLease) snapshot() (int64, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.expiresAt, l.renewalError
}

func (l *taskPreparationLease) freeze() (int64, error) {
	l.stopOnce.Do(func() { close(l.stopRenewal) })
	<-l.renewalDone
	return l.snapshot()
}

func (l *taskPreparationLease) shutdown() {
	_, _ = l.freeze()
	l.cancel()
}

func hasQueuedAssetReferences(c *gin.Context) bool {
	references, ok := common.GetContextKeyType[service.AssetReferenceSet](c, constant.ContextKeyAssetReferenceSet)
	return ok && references.HasReferences()
}

func queueAssetTaskForPreparation(c *gin.Context, info *relaycommon.RelayInfo, preflight *relay.TaskPreflightResult) (*dto.OpenAIVideo, *dto.TaskError) {
	if info == nil || info.TaskRelayInfo == nil || preflight == nil {
		return nil, service.TaskErrorWrapperLocal(fmt.Errorf("missing task preflight"), "task_preflight_required", http.StatusInternalServerError)
	}
	payload, err := normalizedTaskPayload(c)
	if err != nil {
		return nil, service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	specificChannelID, err := queuedAssetTaskSpecificChannelID(c)
	if err != nil {
		return nil, service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	now := time.Now().Unix()
	taskID := info.PublicTaskID
	if strings.TrimSpace(taskID) == "" {
		taskID = model.GenerateTaskID()
		info.PublicTaskID = taskID
	}
	video := dto.NewOpenAIVideo()
	video.ID = taskID
	video.TaskID = taskID
	video.Model = info.OriginModelName
	video.Progress = 0
	video.CreatedAt = now
	responseData, err := common.Marshal(video)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "marshal_task_response_failed", http.StatusInternalServerError)
	}
	task := &model.Task{
		TaskID:                    taskID,
		UserId:                    info.UserId,
		Group:                     info.UsingGroup,
		ChannelId:                 0,
		Platform:                  preflight.Platform,
		Quota:                     preflight.Quota,
		Action:                    info.Action,
		Status:                    model.TaskStatusQueued,
		PreparationStatus:         model.TaskPreparationStatusPreparingAssets,
		NormalizedRequestPayload:  payload,
		Data:                      responseData,
		Progress:                  "0%",
		CreatedAt:                 now,
		UpdatedAt:                 now,
		PreparationLeaseExpiresAt: 0,
		Properties: model.Properties{
			OriginModelName:   info.OriginModelName,
			UpstreamModelName: taskUpstreamModelName(info),
		},
		PrivateData: model.TaskPrivateData{
			BillingSource:     info.BillingSource,
			SubscriptionId:    info.SubscriptionId,
			TokenId:           info.TokenId,
			SpecificChannelId: specificChannelID,
			BillingContext:    taskBillingContextSnapshot(info),
		},
	}
	if err := task.Insert(); err != nil {
		return nil, service.TaskErrorWrapper(err, "queue_task_failed", http.StatusInternalServerError)
	}
	return video, nil
}

func queuedAssetTaskSpecificChannelID(c *gin.Context) (int, error) {
	raw := strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyTokenSpecificChannelId))
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, service.ErrAssetInvalidSpecificChannel
	}
	return value, nil
}

func normalizedTaskPayload(c *gin.Context) ([]byte, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	raw, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	var payload any
	if err := common.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	return common.Marshal(payload)
}

func taskUpstreamModelName(info *relaycommon.RelayInfo) string {
	if info == nil || info.ChannelMeta == nil {
		return ""
	}
	return info.UpstreamModelName
}

func taskBillingContextSnapshot(info *relaycommon.RelayInfo) *model.TaskBillingContext {
	snapshot := &model.TaskBillingContext{
		ModelPrice:           info.PriceData.ModelPrice,
		GroupRatio:           info.PriceData.GroupRatioInfo.GroupRatio,
		GroupModelRatio:      info.PriceData.GroupRatioInfo.GroupModelRatio,
		GroupModelRatioGroup: info.PriceData.GroupRatioInfo.GroupModelRatioGroup,
		GroupModelRatioModel: info.PriceData.GroupRatioInfo.GroupModelRatioModel,
		ModelRatio:           info.PriceData.ModelRatio,
		OtherRatios:          info.PriceData.OtherRatios,
		OriginModelName:      info.OriginModelName,
		PerCallBilling:       common.StringsContains(constant.TaskPricePatches, info.OriginModelName) || info.PriceData.UsePrice,
	}
	if info.BillingSource == service.BillingSourceSubscription {
		if bs, ok := info.Billing.(*service.BillingSession); ok && bs != nil {
			weight, _ := bs.SubscriptionTaskSnapshot()
			snapshot.SubscriptionWeight = weight
		}
	}
	return snapshot
}

func StartAssetTaskWorker() {
	StartAssetTaskWorkerWithConfig(context.Background(), AssetTaskWorkerConfig{})
}

func StartAssetTaskWorkerWithConfig(ctx context.Context, cfg AssetTaskWorkerConfig) {
	owner := assetTaskWorkerOwner(cfg.Owner)
	interval := cfg.Interval
	if interval <= 0 {
		interval = 5 * time.Second
	}
	limit := cfg.Limit
	if limit <= 0 {
		limit = assetTaskWorkerBatchSize
	}
	gopool.Go(func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			if _, err := RunAssetTaskWorkerOnce(ctx, owner, limit); err != nil {
				common.SysError("asset task worker error: " + err.Error())
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	})
}

func assetTaskWorkerOwner(configured string) string {
	owner := strings.TrimSpace(configured)
	if owner == "" {
		owner = strings.TrimSpace(os.Getenv("ASSET_TASK_WORKER_OWNER"))
	}
	if owner == "" {
		owner, _ = os.Hostname()
	}
	if owner == "" {
		owner = fmt.Sprintf("asset-worker-%d", time.Now().UnixNano())
	}
	return owner
}

func RunAssetTaskWorkerOnce(ctx context.Context, owner string, limit int) (int, error) {
	if limit <= 0 {
		limit = assetTaskWorkerBatchSize
	}
	now := assetTaskWorkerNowUnix()
	expiredFences, err := model.GetExpiredAssetTaskSubmissionFences(now, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	for _, task := range expiredFences {
		now = assetTaskWorkerNowUnix()
		publicIDs := extractStrictAssetPublicIDsFromPayload(task.NormalizedRequestPayload)
		retentionUntil := now + int64(service.CurrentAssetStorageConfig().SourceRetention.Seconds())
		won, err := model.MarkExpiredAssetTaskSubmissionUnknown(task.TaskID, task.PreparationLeaseOwner, task.PreparationLeaseExpiresAt, task.PreparationAttemptCount, now, publicIDs, retentionUntil)
		if err != nil {
			return processed, err
		}
		if won {
			processed++
		}
	}

	remaining := limit - processed
	if remaining <= 0 {
		remaining = 0
	}
	tasks := make([]*model.Task, 0)
	if remaining > 0 {
		tasks, err = model.GetQueuedAssetPreparationTasks(assetTaskWorkerNowUnix(), remaining)
		if err != nil {
			return processed, err
		}
	}
	for _, task := range tasks {
		now = assetTaskWorkerNowUnix()
		leaseExpiresAt := now + assetTaskPreparationLeaseSeconds
		won, err := model.ClaimTaskPreparationLease(task.TaskID, owner, task.PreparationAttemptCount, now, leaseExpiresAt)
		if err != nil {
			return processed, err
		}
		if !won {
			continue
		}
		processed++
		leaseCtx, lease := startTaskPreparationLease(ctx, task.TaskID, owner, task.PreparationAttemptCount+1, leaseExpiresAt)
		runErr := runLeasedAssetTaskFunc(leaseCtx, task.TaskID, owner, lease)
		lease.shutdown()
		if runErr != nil {
			logger.LogError(ctx, fmt.Sprintf("asset task %s preparation failed: %s", task.TaskID, runErr.Error()))
		}
	}
	now = assetTaskWorkerNowUnix()
	accountingTasks, err := model.GetAcceptedAccountingTasks(now, limit)
	if err != nil {
		return processed, err
	}
	for _, task := range accountingTasks {
		now = assetTaskWorkerNowUnix()
		leaseExpiresAt := now + assetTaskPreparationLeaseSeconds
		won, err := model.ClaimAcceptedAccountingLease(task.TaskID, owner, now, leaseExpiresAt)
		if err != nil {
			return processed, err
		}
		if !won {
			continue
		}
		processed++
		if err := runAcceptedTaskAccounting(ctx, task.TaskID, owner, leaseExpiresAt); err != nil {
			logger.LogError(ctx, fmt.Sprintf("asset task %s accepted accounting failed: %s", task.TaskID, err.Error()))
		}
	}
	return processed, nil
}

func runLeasedAssetTask(ctx context.Context, taskID string, owner string, lease *taskPreparationLease) error {
	task, ok, err := model.GetByOnlyTaskId(taskID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("task not found")
	}
	if task.Status != model.TaskStatusQueued || task.PreparationLeaseOwner != owner || task.PreparationAttemptCount != lease.attemptCount {
		return fmt.Errorf("task preparation lease lost")
	}
	c, info, err := rebuildAssetTaskContext(task)
	if err != nil {
		now := assetTaskWorkerNowUnix()
		if assetTaskShouldWaitForAssets(task, err, now) {
			return requeueLeasedAssetTaskForAssetPreparation(ctx, task, owner, lease, now)
		}
		return failLeasedAssetTaskPreparation(ctx, task, owner, lease, err)
	}
	c.Request = c.Request.WithContext(ctx)
	retryParam := &service.RetryParam{
		Ctx:        c,
		TokenGroup: info.TokenGroup,
		ModelName:  task.Properties.OriginModelName,
		Retry:      common.GetPointer(0),
	}
	var lastErr error
	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		if err := ctx.Err(); err != nil {
			return err
		}
		channel, channelErr := getChannel(c, info, retryParam)
		if channelErr != nil {
			if err := ctx.Err(); err != nil {
				return err
			}
			now := assetTaskWorkerNowUnix()
			if assetTaskShouldWaitForAssets(task, channelErr, now) {
				return requeueLeasedAssetTaskForAssetPreparation(ctx, task, owner, lease, now)
			}
			lastErr = channelErr.Err
			break
		}
		if task.PrivateData.SpecificChannelId > 0 {
			if setupErr := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName); setupErr != nil {
				releaseChannelConcurrencyForRequest(c)
				lastErr = setupErr.Err
				break
			}
			if rewriteErr := middleware.RefreshAssetRewriteMapForSelectedChannel(c, channel); rewriteErr != nil {
				releaseChannelConcurrencyForRequest(c)
				lastErr = rewriteErr.Err
				break
			}
		}
		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			releaseChannelConcurrencyForRequest(c)
			lastErr = bodyErr
			break
		}
		c.Request.Body = io.NopCloser(bodyStorage)
		preflight, taskErr := relay.PrepareTaskAttempt(c, info)
		submitAttempted := false
		pollingKey := ""
		var result *relay.TaskSubmitResult
		if taskErr == nil {
			if err := ctx.Err(); err != nil {
				releaseChannelConcurrencyForRequest(c)
				return err
			}
			pollingKey = taskPollingKey(channel, info)
			fenced, fenceErr := model.MarkQueuedTaskSubmittingWithPollingKey(task.TaskID, owner, lease.attemptCount, assetTaskWorkerNowUnix(), channel.Id, preflight.Platform, preflight.Quota, pollingKey)
			if fenceErr != nil {
				releaseChannelConcurrencyForRequest(c)
				return fmt.Errorf("mark task submission fence: %w", fenceErr)
			}
			if !fenced {
				releaseChannelConcurrencyForRequest(c)
				return fmt.Errorf("task preparation lease lost before provider submit")
			}
			submitAttempted = true
			result, taskErr = relay.ExecutePreparedTaskSubmit(c, info, preflight)
		}
		releaseChannelConcurrencyForRequest(c)
		if taskErr == nil {
			return acceptLeasedAssetTask(c, info, task, owner, lease, channel, result)
		}
		if result != nil && result.OutcomeMayBeUnknown {
			return quarantineLeasedAssetTaskSubmissionUnknown(task, lease, channel, result, pollingKey, taskErr.Error)
		}
		if err := ctx.Err(); err != nil {
			if submitAttempted {
				return quarantineLeasedAssetTaskSubmissionUnknown(task, lease, channel, &relay.TaskSubmitResult{
					Platform: preflight.Platform,
					Quota:    preflight.Quota,
				}, pollingKey, err)
			}
			return err
		}
		lastErr = taskErr.Error
		if !shouldRetryTaskRelay(c, channel.Id, taskErr, common.RetryTimes-retryParam.GetRetry()) {
			break
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("asset preparation failed")
	}
	return failLeasedAssetTaskPreparation(ctx, task, owner, lease, lastErr)
}

func assetTaskShouldWaitForAssets(task *model.Task, err error, now int64) bool {
	if task == nil || err == nil || now >= task.CreatedAt+int64(assetTaskAssetReadyTimeout/time.Second) {
		return false
	}
	var apiErr *types.NewAPIError
	if errors.As(err, &apiErr) && apiErr.GetErrorCode() == types.ErrorCodeAssetNotReady {
		return true
	}
	return service.IsRetryableAssetMaterializeError(err)
}

func rebuildAssetTaskContext(task *model.Task) (*gin.Context, *relaycommon.RelayInfo, error) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptestRequestFromPayload(task.NormalizedRequestPayload)
	common.SetContextKey(c, constant.ContextKeyUserId, task.UserId)
	common.SetContextKey(c, constant.ContextKeyUserGroup, task.Group)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, task.Group)
	common.SetContextKey(c, constant.ContextKeyAssetMaterializeEnabled, true)
	identityGroup := task.Group
	userQuota := 0
	userSetting := dto.UserSetting{}
	user, err := model.GetUserById(task.UserId, false)
	if err != nil {
		return nil, nil, fmt.Errorf("queued task user unavailable: %w", err)
	}
	if user == nil || user.Status != common.UserStatusEnabled {
		return nil, nil, fmt.Errorf("queued task user %d is disabled", task.UserId)
	}
	userQuota = user.Quota
	userSetting = user.GetSetting()
	identityGroup = strings.TrimSpace(user.Group)
	if identityGroup == "" || identityGroup == plgGroup {
		identityGroup = plgGroup
	}
	common.SetContextKey(c, constant.ContextKeyUserGroup, identityGroup)
	common.SetContextKey(c, constant.ContextKeyUserQuota, user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserSetting, userSetting)
	tokenKey := ""
	tokenName := ""
	routingGroup := identityGroup
	if task.PrivateData.TokenId > 0 {
		token, err := model.GetTokenById(task.PrivateData.TokenId)
		if err != nil {
			return nil, nil, fmt.Errorf("%w: %v", model.ErrTokenInvalid, err)
		}
		if token.UserId != task.UserId {
			return nil, nil, fmt.Errorf("%w: token does not belong to queued task user", model.ErrTokenInvalid)
		}
		switch model.GetEffectiveTokenStatus(token, common.GetTimestamp()) {
		case common.TokenStatusEnabled:
		case common.TokenStatusExpired:
			return nil, nil, model.ErrTokenExpired
		case common.TokenStatusExhausted:
			return nil, nil, model.ErrTokenExhausted
		default:
			return nil, nil, model.ErrTokenUnavailable
		}
		tokenKey = token.Key
		tokenName = token.Name
		tokenGroup := strings.TrimSpace(token.Group)
		crossGroupRetry := token.CrossGroupRetry
		if identityGroup == plgGroup {
			tokenGroup = plgGroup
			crossGroupRetry = false
		}
		if identityGroup != plgGroup && tokenGroup != "" {
			if !service.GroupInUserUsableGroups(identityGroup, tokenGroup) {
				return nil, nil, fmt.Errorf("queued task token group %s is not usable by user group %s", tokenGroup, identityGroup)
			}
			if !ratio_setting.ContainsGroupRatio(tokenGroup) && tokenGroup != "auto" {
				return nil, nil, fmt.Errorf("queued task token group %s is deprecated", tokenGroup)
			}
		}
		routingGroup = tokenGroup
		if routingGroup == "" {
			routingGroup = identityGroup
		}
		common.SetContextKey(c, constant.ContextKeyTokenKey, token.Key)
		common.SetContextKey(c, constant.ContextKeyTokenId, token.Id)
		common.SetContextKey(c, constant.ContextKeyTokenGroup, tokenGroup)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, token.ModelLimitsEnabled)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, token.GetModelLimitsMap())
		common.SetContextKey(c, constant.ContextKeyTokenModelBlacklistEnabled, token.ModelBlacklistEnabled)
		common.SetContextKey(c, constant.ContextKeyTokenModelBlacklist, token.GetModelBlacklistMap())
		common.SetContextKey(c, constant.ContextKeyTokenCrossGroupRetry, crossGroupRetry)
		c.Set("token_name", token.Name)
	}
	common.SetContextKey(c, constant.ContextKeyUsingGroup, routingGroup)
	if task.PrivateData.SpecificChannelId > 0 {
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, strconv.Itoa(task.PrivateData.SpecificChannelId))
		common.SetContextKey(c, constant.ContextKeyChannelId, task.PrivateData.SpecificChannelId)
	}
	if err := enforceQueuedAssetTaskTokenModelAccess(c, task.Properties.OriginModelName); err != nil {
		return nil, nil, err
	}
	var seedanceReq dto.SeedanceVideoRequest
	if err := common.Unmarshal(task.NormalizedRequestPayload, &seedanceReq); err != nil {
		return nil, nil, err
	}
	refs, apiErr := service.ResolveAssetReferences(c, task.UserId, &seedanceReq)
	if apiErr != nil {
		return nil, nil, apiErr
	}
	common.SetContextKey(c, constant.ContextKeyAssetReferenceSet, refs)
	info := &relaycommon.RelayInfo{
		UserId:                task.UserId,
		TokenId:               task.PrivateData.TokenId,
		TokenKey:              tokenKey,
		UsingGroup:            routingGroup,
		UserGroup:             identityGroup,
		TokenGroup:            routingGroup,
		OriginModelName:       task.Properties.OriginModelName,
		BillingSource:         task.PrivateData.BillingSource,
		SubscriptionId:        task.PrivateData.SubscriptionId,
		UserQuota:             userQuota,
		UserSetting:           userSetting,
		ForcePreConsume:       true,
		FinalPreConsumedQuota: task.Quota,
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:       task.Action,
			PublicTaskID: task.TaskID,
		},
		PriceData: types.PriceData{Quota: task.Quota},
	}
	if task.PrivateData.SpecificChannelId == 0 {
		info.ChannelMeta = &relaycommon.ChannelMeta{}
	}
	if tokenName != "" {
		c.Set("token_name", tokenName)
	}
	return c, info, nil
}

func enforceQueuedAssetTaskTokenModelAccess(c *gin.Context, modelName string) error {
	if common.GetContextKeyBool(c, constant.ContextKeyTokenModelBlacklistEnabled) {
		if value, exists := common.GetContextKey(c, constant.ContextKeyTokenModelBlacklist); exists {
			if blacklist, ok := value.(map[string]bool); ok && service.TokenBlocksModel(blacklist, modelName) {
				return fmt.Errorf("queued task token is not allowed to use model %s", modelName)
			}
		}
	}
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return nil
	}
	value, exists := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
	if !exists {
		return fmt.Errorf("queued task token has no model access")
	}
	allowlist, ok := value.(map[string]bool)
	if !ok {
		allowlist = map[string]bool{}
	}
	if !service.TokenAllowsModel(allowlist, modelName) {
		return fmt.Errorf("queued task token is not allowed to use model %s", modelName)
	}
	return nil
}

func httptestRequestFromPayload(payload []byte) *http.Request {
	req, _ := http.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func acceptAssetTask(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task, owner string, leaseExpiresAt int64, channel *model.Channel, result *relay.TaskSubmitResult) error {
	return acceptAssetTaskGeneration(c, info, task, owner, leaseExpiresAt, task.PreparationAttemptCount, channel, result)
}

func acceptAssetTaskGeneration(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task, owner string, leaseExpiresAt int64, attemptCount int, channel *model.Channel, result *relay.TaskSubmitResult) error {
	now := assetTaskWorkerNowUnix()
	publicIDs := extractStrictAssetPublicIDsFromPayload(task.NormalizedRequestPayload)
	retentionUntil := now + int64(service.CurrentAssetStorageConfig().SourceRetention.Seconds())
	pollingKey := taskPollingKey(channel, info)
	won, err := model.MarkQueuedTaskAcceptedWithPollingKey(task.TaskID, owner, leaseExpiresAt, now, now, channel.Id, result.Platform, result.Quota, result.UpstreamTaskID, result.TaskData, pollingKey, publicIDs, now, retentionUntil)
	if err != nil {
		return quarantineAssetTaskSubmissionUnknown(task, attemptCount, channel, result, pollingKey, publicIDs, now, retentionUntil, fmt.Errorf("mark task accepted: %w", err))
	}
	if !won {
		return quarantineAssetTaskSubmissionUnknown(task, attemptCount, channel, result, pollingKey, publicIDs, now, retentionUntil, fmt.Errorf("task preparation lease lost"))
	}
	if info != nil {
		info.ChannelId = channel.Id
		if info.ChannelMeta == nil {
			info.ChannelMeta = &relaycommon.ChannelMeta{}
		}
		info.ChannelMeta.ChannelId = channel.Id
		info.ChannelMeta.ChannelType = channel.Type
		info.PriceData.Quota = result.Quota
	}
	accountingLeaseExpiresAt := now + assetTaskPreparationLeaseSeconds
	accountingWon, err := model.ClaimAcceptedAccountingLease(task.TaskID, owner, now, accountingLeaseExpiresAt)
	if err != nil {
		return err
	}
	if !accountingWon {
		return nil
	}
	return runAcceptedTaskAccounting(c, task.TaskID, owner, accountingLeaseExpiresAt)
}

func quarantineAssetTaskSubmissionUnknown(task *model.Task, attemptCount int, channel *model.Channel, result *relay.TaskSubmitResult, pollingKey string, publicIDs []string, now int64, retentionUntil int64, cause error) error {
	message := "asset task submission unknown outcome without an upstream task id"
	if result.UpstreamTaskID != "" {
		message = fmt.Sprintf("asset task acceptance unknown outcome for upstream task %q", result.UpstreamTaskID)
	}
	unknownErr := fmt.Errorf("%s: %w", message, cause)
	quarantined, err := model.MarkQueuedTaskSubmissionUnknownWithPollingKey(task.TaskID, attemptCount, now, now, channel.Id, result.Platform, result.Quota, result.UpstreamTaskID, result.TaskData, pollingKey, publicIDs, now, retentionUntil)
	if err != nil {
		return fmt.Errorf("%w; manual reconciliation quarantine failed: %v", unknownErr, err)
	}
	if !quarantined {
		return fmt.Errorf("%w; preparation generation changed before manual reconciliation quarantine", unknownErr)
	}
	return fmt.Errorf("%w; task quarantined for manual reconciliation", unknownErr)
}

func quarantineLeasedAssetTaskSubmissionUnknown(task *model.Task, lease *taskPreparationLease, channel *model.Channel, result *relay.TaskSubmitResult, pollingKey string, cause error) error {
	_, renewalErr := lease.freeze()
	if renewalErr != nil {
		cause = fmt.Errorf("%w; lease renewal failed: %v", cause, renewalErr)
	}
	now := assetTaskWorkerNowUnix()
	publicIDs := extractStrictAssetPublicIDsFromPayload(task.NormalizedRequestPayload)
	retentionUntil := now + int64(service.CurrentAssetStorageConfig().SourceRetention.Seconds())
	return quarantineAssetTaskSubmissionUnknown(task, lease.attemptCount, channel, result, pollingKey, publicIDs, now, retentionUntil, cause)
}

func taskPollingKey(channel *model.Channel, info *relaycommon.RelayInfo) string {
	if channel == nil || info == nil || info.ChannelMeta == nil {
		return ""
	}
	if model.TaskChannelTypePersistsPollingKey(channel.Type) {
		return strings.TrimSpace(info.ChannelMeta.ApiKey)
	}
	return ""
}

func acceptLeasedAssetTask(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task, owner string, lease *taskPreparationLease, channel *model.Channel, result *relay.TaskSubmitResult) error {
	leaseExpiresAt, renewalErr := lease.freeze()
	acceptErr := acceptAssetTaskGeneration(c, info, task, owner, leaseExpiresAt, lease.attemptCount, channel, result)
	if acceptErr != nil && renewalErr != nil {
		return fmt.Errorf("lease renewal failed before final acceptance: %v; %w", renewalErr, acceptErr)
	}
	return acceptErr
}

func runAcceptedTaskAccounting(ctx context.Context, taskID string, owner string, leaseExpiresAt int64) error {
	task, ok, err := model.GetByOnlyTaskId(taskID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("task not found")
	}
	if !acceptedAccountingLeaseCurrent(task, owner, leaseExpiresAt, assetTaskWorkerNowUnix()) {
		return fmt.Errorf("accepted accounting lease lost")
	}
	actualQuota := task.AcceptedAccountingActualQuota
	if actualQuota == 0 {
		actualQuota = task.Quota
	}
	if err := service.SettleAcceptedTaskFundingOnce(ctx, task, actualQuota); err != nil {
		return markAcceptedAccountingRetryable(ctx, taskID, owner, leaseExpiresAt, err)
	}
	task, ok, err = model.GetByOnlyTaskId(taskID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("task not found")
	}
	if !acceptedAccountingLeaseCurrent(task, owner, leaseExpiresAt, assetTaskWorkerNowUnix()) {
		return fmt.Errorf("accepted accounting lease lost")
	}
	if err := service.SyncAcceptedTaskTokenCacheOnce(ctx, task); err != nil {
		return markAcceptedAccountingRetryable(ctx, taskID, owner, leaseExpiresAt, err)
	}
	if err := service.ApplyAcceptedTaskSubscriptionWindowOnce(ctx, task); err != nil {
		return markAcceptedAccountingRetryable(ctx, taskID, owner, leaseExpiresAt, err)
	}
	if err := service.LogAcceptedTaskConsumptionOnce(ctx, task); err != nil {
		return markAcceptedAccountingRetryable(ctx, taskID, owner, leaseExpiresAt, err)
	}
	if err := service.RecordAcceptedTaskTemporarySpendOnce(ctx, task); err != nil {
		return markAcceptedAccountingRetryable(ctx, taskID, owner, leaseExpiresAt, err)
	}
	now := assetTaskWorkerNowUnix()
	won, err := model.MarkAcceptedAccountingDone(taskID, owner, leaseExpiresAt, now)
	if err != nil {
		return err
	}
	if !won {
		return fmt.Errorf("accepted accounting lease lost")
	}
	return nil
}

func acceptedAccountingLeaseCurrent(task *model.Task, owner string, leaseExpiresAt int64, now int64) bool {
	return task != nil &&
		task.Status == model.TaskStatusSubmitted &&
		task.AcceptedAccountingStatus == model.TaskAcceptedAccountingProcessing &&
		task.AcceptedAccountingLeaseOwner == owner &&
		task.AcceptedAccountingLeaseExpiresAt == leaseExpiresAt &&
		task.AcceptedAccountingLeaseExpiresAt > now
}

func markAcceptedAccountingRetryable(ctx context.Context, taskID string, owner string, leaseExpiresAt int64, cause error) error {
	now := assetTaskWorkerNowUnix()
	reason := "accepted accounting failed"
	if cause != nil && strings.TrimSpace(cause.Error()) != "" {
		reason = cause.Error()
	}
	won, err := model.MarkAcceptedAccountingRetryable(taskID, owner, leaseExpiresAt, reason, now)
	if err != nil {
		return err
	}
	if !won {
		logger.LogWarn(ctx, fmt.Sprintf("accepted accounting failure for task %s lost lease fence", taskID))
	}
	return cause
}

func extractStrictAssetPublicIDsFromPayload(payload []byte) []string {
	var req dto.SeedanceVideoRequest
	if err := common.Unmarshal(payload, &req); err != nil {
		return nil
	}
	seen := make(map[string]struct{})
	ids := make([]string, 0)
	add := func(raw string) {
		if !service.IsStrictBytePlusAssetURI(raw) || !strings.HasPrefix(raw, "asset://") {
			return
		}
		publicID := strings.TrimPrefix(raw, "asset://")
		if _, ok := seen[publicID]; ok {
			return
		}
		seen[publicID] = struct{}{}
		ids = append(ids, publicID)
	}
	for _, item := range req.Content {
		if item.ImageURL != nil {
			add(item.ImageURL.URL)
		}
		if item.VideoURL != nil {
			add(item.VideoURL.URL)
		}
		if item.AudioURL != nil {
			add(item.AudioURL.URL)
		}
	}
	return ids
}

func failAssetTaskPreparation(ctx context.Context, task *model.Task, owner string, leaseExpiresAt int64, cause error) error {
	now := assetTaskWorkerNowUnix()
	reason := "asset preparation failed"
	if cause != nil && strings.TrimSpace(cause.Error()) != "" {
		reason = cause.Error()
	}
	won, err := model.MarkQueuedTaskFailed(task.TaskID, owner, leaseExpiresAt, reason, now)
	if err != nil {
		return err
	}
	if won {
		service.RefundTaskQuota(ctx, task, reason)
	}
	return cause
}

func failLeasedAssetTaskPreparation(ctx context.Context, task *model.Task, owner string, lease *taskPreparationLease, cause error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	leaseExpiresAt, err := lease.freeze()
	if err != nil {
		return err
	}
	return failAssetTaskPreparation(ctx, task, owner, leaseExpiresAt, cause)
}

func requeueLeasedAssetTaskForAssetPreparation(ctx context.Context, task *model.Task, owner string, lease *taskPreparationLease, now int64) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	leaseExpiresAt, err := lease.freeze()
	if err != nil {
		return err
	}
	retryAt := now + int64(assetTaskAssetReadyPollInterval/time.Second)
	won, err := model.RequeueQueuedTaskForAssetPreparation(task.TaskID, owner, leaseExpiresAt, now, retryAt)
	if err != nil {
		return err
	}
	if !won {
		return fmt.Errorf("task preparation lease lost before asset retry")
	}
	return nil
}
