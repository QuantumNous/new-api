package service

import (
	"context"
	"errors"
	"fmt"
	"hash"
	"hash/crc32"
	"io"
	"sort"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/storage"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/bytedance/gopkg/util/gopool"
)

// GCS 视频任务结果转存：异步转存 worker（gcs-video-transfer-design.md 4.4 / 实现清单项 3、12）。
//
// 单写者模型（4.4）：转存阶段字段（UpstreamDoneAt/UpstreamAssets/SettleTokens/progress、
// 超截止 FAILURE）归 master 轮询循环独占；worker 只做一种写——全部资产就绪后的终态 CAS
// （IN_PROGRESS → SUCCESS），且 CAS 赢了才结算。worker 失败时不写库，只清 inflight 标记并
// 记录内存退避；重试由下一轮轮询的 re-Submit 驱动（无持久化失败计数——轮询 15s 一轮，
// 任何按轮递增的计数器都无法区分"正在正常转存"与"已失败"；止损由 GCS_TRANSFER_DEADLINE
// 墙钟在轮询侧兜底）。
//
// 幂等是逐对象语义：每次尝试遍历任务的全部资产，对每个对象独立做条件写/复用判断，
// 全部对象就绪后才允许 CAS 翻 SUCCESS——天然覆盖多文件部分成功后崩溃的续传、
// 多实例并发与进程重启的重复触发。

const (
	gcsTransferBackoffMin = 15 * time.Second
	gcsTransferBackoffMax = 5 * time.Minute
)

// errGCSAssetOversize 资产超过 GCS_MAX_OBJECT_SIZE 体积上限。
// 由 gcsCountingReader 在读流中途返回，使 GCSUploadObject 的 io.Copy 失败、
// 经 cancel context 放弃上传——绝不能把超限文件静默截断 finalize 成"成功"对象。
var errGCSAssetOversize = errors.New("asset exceeds GCS_MAX_OBJECT_SIZE")

// gcsAllowedContentTypes Content-Type 白名单：仅用于上传时的对象 metadata；
// 对象扩展名一律取自暂存时定死的 asset.Ext，禁止把上游响应字段拼进对象名（设计 4.2）。
var gcsAllowedContentTypes = map[string]struct{}{
	"video/mp4":                {},
	"video/webm":               {},
	"video/quicktime":          {},
	"video/mpeg":               {},
	"image/jpeg":               {},
	"image/png":                {},
	"image/webp":               {},
	"application/octet-stream": {},
}

// gcsObjectContentType 按白名单收口上传 Content-Type；上游值不在白名单内时
// 按暂存时定死的扩展名静态映射，绝不透传任意上游值。
func gcsObjectContentType(upstreamCT string, ext string) string {
	ct := strings.ToLower(strings.TrimSpace(upstreamCT))
	if i := strings.Index(ct, ";"); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	if _, ok := gcsAllowedContentTypes[ct]; ok {
		return ct
	}
	switch strings.TrimPrefix(strings.ToLower(ext), ".") {
	case taskcommon.AssetExtVideo:
		return "video/mp4"
	case taskcommon.AssetExtImage:
		return "image/jpeg"
	default:
		return "application/octet-stream"
	}
}

// gcsCountingReader 体积上限检测：包装 io.LimitReader(src, max+1) 并做字节计数
// （仓库既有模式 common/body_storage.go newDiskStorageFromReader）。
// 裸 io.LimitReader(r, N) 在 N 字节处静默 EOF 不报错，会把超限文件静默截断成
// "成功"对象（红线 6），因此超限时主动返回 errGCSAssetOversize 使上传中止。
// 同时累计 CRC32C（Castagnoli，与 GCS 对象校验和同算法），供 exists 竞态分支
// 复用前的完整性校验。
type gcsCountingReader struct {
	r   io.Reader // io.LimitReader(src, max+1)
	max int64
	n   int64
	crc hash.Hash32
	eof bool // 是否完整读到了源流 EOF（且未超限）——此时 n/crc 可作为精确校验输入
}

func newGCSCountingReader(src io.Reader, maxBytes int64) *gcsCountingReader {
	return &gcsCountingReader{
		r:   io.LimitReader(src, maxBytes+1),
		max: maxBytes,
		crc: crc32.New(crc32.MakeTable(crc32.Castagnoli)),
	}
}

func (c *gcsCountingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	if n > 0 {
		c.n += int64(n)
		_, _ = c.crc.Write(p[:n])
		if c.n > c.max {
			return n, errGCSAssetOversize
		}
	}
	if err == io.EOF && c.n <= c.max {
		c.eof = true
	}
	return n, err
}

type gcsTransferBackoff struct {
	nextAttemptAt time.Time
	delay         time.Duration
}

// gcsTransferManager 转存 worker 管理器：进程内 inflight 去重 + 内存退避 + 并发信号量。
type gcsTransferManager struct {
	inflight sync.Map // taskID -> struct{}（同一任务同进程内只有一个 worker，含排队中）
	backoff  sync.Map // taskID -> gcsTransferBackoff（失败退避，进程重启归零，可接受）
	semOnce  sync.Once
	sem      chan struct{}
}

// GCSTransfer 全局转存管理器。转存触发与重试驱动只来自 master 轮询循环的 Submit。
var GCSTransfer = &gcsTransferManager{}

func (m *gcsTransferManager) semaphore() chan struct{} {
	m.semOnce.Do(func() {
		n := setting.GCSTransferConcurrency
		if n <= 0 {
			n = 4
		}
		m.sem = make(chan struct{}, n)
	})
	return m.sem
}

// Forget 清除任务的退避记录（任务已被轮询侧翻终态，不会再 re-Submit，避免条目泄漏）。
func (m *gcsTransferManager) Forget(taskID string) {
	m.backoff.Delete(taskID)
}

// Submit 提交一个转存阶段任务（taskID 为对外公开 task_id）。立即返回，不阻塞轮询循环：
//   - inflight 去重：同一任务同进程内只有一个 worker（含信号量排队中的）；
//   - 内存退避：上次失败后的退避期内不启动新尝试；
//   - 信号量满时 goroutine 排队等槽（任务已占 inflight 标记，不会重复入队）。
//
// 排队时长不计入单次转存超时（超时从实际开始取流起算），整体受 transferDeadline 兜底。
func (m *gcsTransferManager) Submit(taskID string) {
	if taskID == "" || !GCSStorageReady() {
		return
	}
	if v, ok := m.backoff.Load(taskID); ok {
		if time.Now().Before(v.(gcsTransferBackoff).nextAttemptAt) {
			return
		}
	}
	if _, loaded := m.inflight.LoadOrStore(taskID, struct{}{}); loaded {
		return
	}
	gopool.Go(func() {
		// 失败只清 inflight + 记退避，不写库；重试由下一轮轮询 re-Submit 驱动
		defer m.inflight.Delete(taskID)
		gcsMetrics.inflight.Add(1)
		defer gcsMetrics.inflight.Add(-1)
		queuedAt := time.Now()
		sem := m.semaphore()
		sem <- struct{}{}
		defer func() { <-sem }()
		gcsMetrics.recordQueueWait(time.Since(queuedAt))

		ctx := context.Background()
		start := time.Now()
		if err := m.transferTask(ctx, taskID, start); err != nil {
			m.recordFailure(taskID)
			kind := gcsTransferFailKind(err)
			gcsMetrics.recordTransferFailure(kind)
			logger.LogError(ctx, fmt.Sprintf("gcs-transfer fail kind=%s task=%s duration=%s err=%s",
				kind, taskID, time.Since(start).Round(time.Millisecond), err.Error()))
		}
	})
}

// recordFailure 记录内存退避：15s 起步、指数翻倍、上限 5min（红线 13）。
func (m *gcsTransferManager) recordFailure(taskID string) {
	delay := gcsTransferBackoffMin
	if v, ok := m.backoff.Load(taskID); ok {
		delay = v.(gcsTransferBackoff).delay * 2
		if delay > gcsTransferBackoffMax {
			delay = gcsTransferBackoffMax
		}
		if delay < gcsTransferBackoffMin {
			delay = gcsTransferBackoffMin
		}
	}
	m.backoff.Store(taskID, gcsTransferBackoff{
		nextAttemptAt: time.Now().Add(delay),
		delay:         delay,
	})
}

// transferTask 执行一次完整的转存尝试：重新加载任务 → 状态预检 → 逐资产取流上传 →
// 终态 CAS（赢者才结算）。返回非 nil error 表示本次尝试失败（调用方记退避并按
// gcsTransferFailKind 分类计数）。attemptStart 为本次尝试开始时刻（信号量取得后），
// 供成功时的转存耗时直方图使用。
func (m *gcsTransferManager) transferTask(ctx context.Context, taskID string, attemptStart time.Time) error {
	// 1. 重新从 DB 加载任务——禁止捕获轮询循环的 *model.Task 指针（data race，设计 4.4）
	task, exist, err := model.GetByOnlyTaskId(taskID)
	if err != nil {
		return fmt.Errorf("%w: reload task failed: %w", errGCSInternal, err)
	}
	if !exist || task == nil {
		m.backoff.Delete(taskID)
		return nil
	}
	// 2. 状态预检：非 IN_PROGRESS 或 UpstreamDoneAt==0 即退出，不取流
	//（已被 sweep/超截止退款/降级完成等翻终态，或根本不在转存阶段）
	if task.Status != model.TaskStatusInProgress || task.PrivateData.UpstreamDoneAt == 0 {
		m.backoff.Delete(taskID)
		return nil
	}
	// 紧急开关已关闭：存量任务的直链降级完成由轮询循环驱动（设计 4.6），worker 直接退出
	if !GCSStorageReady() {
		return nil
	}

	assets, err := taskcommon.UnmarshalUpstreamAssets(task.PrivateData.UpstreamAssets)
	if err != nil || len(assets) == 0 {
		// 资产清单缺失/损坏无法转存：持续失败由轮询侧 transferDeadline 兜底退款
		return fmt.Errorf("%w: unusable upstream assets for task %s: %v", errGCSInternal, taskID, err)
	}
	sort.Slice(assets, func(i, j int) bool { return assets[i].Index < assets[j].Index })

	if GetTaskAdaptorFunc == nil {
		return fmt.Errorf("%w: task adaptor factory not wired", errGCSInternal)
	}
	adaptor := GetTaskAdaptorFunc(task.Platform)
	if adaptor == nil {
		return fmt.Errorf("%w: task adaptor not found for platform %s", errGCSInternal, task.Platform)
	}

	// worker 自行 CacheGetChannel：渠道可能已删——直链渠道容忍 ch==nil；
	// 带鉴权取流的渠道（Sora/Gemini/Vertex）要求非 nil channel，FetchResultContent
	// 自行报错 → 按转存失败处理，最终由 transferDeadline 退款兜底（设计 4.4）。
	ch, chErr := model.CacheGetChannel(task.ChannelId)
	if chErr != nil {
		logger.LogWarn(ctx, fmt.Sprintf("gcs-transfer task=%s channel #%d unavailable, fallback to channel-less fetch: %s",
			taskID, task.ChannelId, chErr.Error()))
		ch = nil
	}
	// 重建并 Init adaptor（不复用轮询循环的实例——部分 adaptor 有状态，如 hailuo 持有 apiKey/baseURL）。
	// 取流凭证 PrivateData.Key 优先、ch.Key 兜底（taskcommon.ResolveTaskFetchKey 口径）。
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}
	if ch != nil {
		info.ChannelMeta.ChannelType = ch.Type
		info.ChannelMeta.ChannelBaseUrl = ch.GetBaseURL()
	}
	info.ChannelMeta.ApiKey = taskcommon.ResolveTaskFetchKey(task, ch)
	adaptor.Init(info)

	// 3. 单次转存（整任务全部对象）超时：经 context 强制——RelayTimeout=0 时共享
	// client 无 Timeout，不能依赖 client.Timeout（红线 7）。
	transferCtx := ctx
	if setting.GCSTransferTimeout > 0 {
		var cancel context.CancelFunc
		transferCtx, cancel = context.WithTimeout(ctx, setting.GCSTransferTimeout)
		defer cancel()
	}

	// 4. 逐对象条件写/复用判断；任一对象失败即本次尝试失败
	for _, asset := range assets {
		if err := m.transferAsset(transferCtx, adaptor, task, ch, asset); err != nil {
			return fmt.Errorf("asset %d transfer failed: %w", asset.Index, err)
		}
	}

	// 5. 全部对象就绪 → 终态 CAS 翻 SUCCESS，CAS 赢才结算
	return m.finalizeSuccess(ctx, adaptor, task, assets, attemptStart)
}

// transferAsset 转存单个资产：已存在则校验后复用，否则取流并以 If-GenerationMatch:0 条件写上传。
func (m *gcsTransferManager) transferAsset(ctx context.Context, adaptor TaskPollingAdaptor, task *model.Task, ch *model.Channel, asset taskcommon.UpstreamAsset) error {
	objectName := GCSObjectName(task.TaskID, asset.Index, asset.Ext)

	// 复用判断（重试/续传/多实例/进程重启路径）：对象已存在 = 该对象已完成转存。
	// 防御纵深（红线 5）：复用前校验对象属性——重试路径没有下载侧字节计数可比
	//（不重新下载），退化为 attrs 可取 + size>0；精确 size/CRC32C 校验在下方
	// 完整下载后的 exists 竞态分支执行。size==0 视为损坏对象，禁止复用。
	attrs, err := GCSObjectAttrs(ctx, objectName)
	if err == nil {
		if attrs.Size <= 0 {
			return fmt.Errorf("%w: object %s exists with zero size", ErrGCSObjectCorrupted, objectName)
		}
		gcsMetrics.existsReuse.Add(1)
		logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer exists-reuse task=%s object=%s size=%d", task.TaskID, objectName, attrs.Size))
		return nil
	}
	if !errors.Is(err, storage.ErrObjectNotExist) {
		return fmt.Errorf("gcs attrs probe failed for %s: %w", objectName, err)
	}

	// 取流：SSRF 校验与共享 http client 由各 adaptor 的 FetchResultContent
	// （经 channel.FetchTaskAssetByURL 等）强制；超时经 ctx 传递。
	rc, upstreamCT, err := adaptor.FetchResultContent(ctx, task, ch, asset)
	if err != nil {
		// errGCSDownloadFailed 分类标记：上游取流失败（download-fail），与 GCS 侧失败区分
		return fmt.Errorf("%w: %w", errGCSDownloadFailed, err)
	}
	defer rc.Close()

	// 体积上限：LimitReader(N+1) + 字节计数（红线 6）；超限时 counting reader 返回错误，
	// GCSUploadObject 的错误路径 cancel context 放弃上传、不 finalize（红线 5）。
	counter := newGCSCountingReader(rc, setting.GCSMaxObjectSize)
	err = GCSUploadObject(ctx, objectName, counter, gcsObjectContentType(upstreamCT, asset.Ext))
	if err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer upload-ok task=%s object=%s size=%d", task.TaskID, objectName, counter.n))
		return nil
	}
	if errors.Is(err, ErrGCSObjectExists) {
		// 与其他实例/进程的竞写：对象在本次上传期间出现。
		// 完整读完源流时用精确 size/CRC32C 校验后复用；中途命中则退化为属性校验。
		if counter.eof {
			if vErr := GCSVerifyExistingObject(ctx, objectName, counter.n, counter.crc.Sum32()); vErr != nil {
				return vErr
			}
		} else if vErr := m.verifyExistingNonEmpty(ctx, objectName); vErr != nil {
			return vErr
		}
		gcsMetrics.existsReuse.Add(1)
		logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer exists-reuse(race) task=%s object=%s", task.TaskID, objectName))
		return nil
	}
	if errors.Is(err, errGCSAssetOversize) {
		return fmt.Errorf("oversize: object %s exceeds limit %d bytes", objectName, setting.GCSMaxObjectSize)
	}
	return err
}

// verifyExistingNonEmpty 无精确字节计数时的已存在对象最小校验：attrs 可取且 size>0。
func (m *gcsTransferManager) verifyExistingNonEmpty(ctx context.Context, objectName string) error {
	attrs, err := GCSObjectAttrs(ctx, objectName)
	if err != nil {
		return fmt.Errorf("gcs verify existing object failed for %s: %w", objectName, err)
	}
	if attrs.Size <= 0 {
		return fmt.Errorf("%w: object %s exists with zero size", ErrGCSObjectCorrupted, objectName)
	}
	return nil
}

// finalizeSuccess 全部对象就绪后的终态翻转：CAS（IN_PROGRESS → SUCCESS）+ 赢者结算。
//
// 计费互斥完全由终态 CAS 单赢家提供（设计 4.4）：worker 结算、轮询超截止退款、
// sweep 超时退款、紧急开关降级结算都先抢 IN_PROGRESS → 终态的 CAS，只有赢家计费。
// task 是 worker 自己从 DB 重载的副本；转存期间 master 对该行无写
// （转存阶段跳过 FetchTask），deadline/sweep 翻 FAILURE 会使本 CAS 输。
func (m *gcsTransferManager) finalizeSuccess(ctx context.Context, adaptor TaskPollingAdaptor, task *model.Task, assets []taskcommon.UpstreamAsset, attemptStart time.Time) error {
	mainAsset := assets[0] // 已按 Index 升序，index=0 为主文件
	now := time.Now().Unix()

	task.Status = model.TaskStatusSuccess
	task.Progress = taskcommon.ProgressComplete // 100% 仅随终态 CAS 一并写入（红线 1）
	task.FinishTime = now                       // FinishTime 语义 = 转存完成时刻（设计 风险 1）
	task.PrivateData.ResultURL = GCSObjectURL(GCSObjectName(task.TaskID, mainAsset.Index, mainAsset.Ext))

	won, err := task.UpdateWithStatus(model.TaskStatusInProgress)
	if err != nil {
		// 落库失败按转存失败退避重试；对象已就绪，下次尝试走 exists-reuse 快速到达此处
		return fmt.Errorf("%w: finalize CAS update failed: %w", errGCSInternal, err)
	}
	if !won {
		// 已被 sweep 超时退款/超截止退款等翻成终态：单赢家纪律，跳过结算
		gcsMetrics.casLost.Add(1)
		logger.LogWarn(ctx, fmt.Sprintf("gcs-transfer cas-lost task=%s already transitioned, skip settlement", task.TaskID))
		m.backoff.Delete(task.TaskID)
		return nil
	}

	// CAS 赢了才结算。结算输入用持久化的 SettleTokens 合成——接口契约（设计 4.4）：
	// 转存模式下传给 AdjustBillingOnComplete 的 taskResult 仅保证 TotalTokens 有效，
	// 其余字段一律零值，实现不得读取。
	settleTaskBillingOnComplete(ctx, adaptor, task, &relaycommon.TaskInfo{
		TotalTokens: int(task.PrivateData.SettleTokens),
	})

	m.backoff.Delete(task.TaskID)
	// 转存耗时直方图（按渠道，4.8）：记录本次成功尝试的实际转存耗时（不含排队）
	gcsMetrics.recordTransferSuccess(string(task.Platform), time.Since(attemptStart))
	transferDuration := now - task.PrivateData.UpstreamDoneAt
	logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer success task=%s platform=%s assets=%d stage_duration=%ds result=%s",
		task.TaskID, task.Platform, len(assets), transferDuration, task.PrivateData.ResultURL))
	return nil
}
