package service

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
	"golang.org/x/oauth2"
	"google.golang.org/api/googleapi"
)

// GCS 视频任务结果转存：可观测性（gcs-video-transfer-design.md 4.8 / 实现清单项 13、14）。
//
// 选型：仓库现有指标体系只有 pkg/perf_metrics（relay 请求级延迟/TPS 面板，DB 持久化，
// 与任务转存语义不匹配），无 Prometheus/expvar 通用注册表。按设计 4.8 的最低限度要求，
// 采用「进程内原子计数器 + 周期性结构化统计日志」的最小方案，不引入新依赖：
//   - 事件计数器/直方图在埋点处原子累加（进程生命周期内累计值）；
//   - 后台 reporter 每分钟把有变化的快照打成一行结构化日志（gcs-metrics 前缀），
//     可被日志采集系统直接抽取；
//   - 两个 DB 哨兵（卡死哨兵、转存积压量）仅在 master 节点周期查询——
//     卡死任务（status=IN_PROGRESS 且 progress=100%）已退出轮询与清扫集合，
//     只能靠独立 DB 查询发现（验收要求恒为 0）。
//
// 没有这些指标，GCS_TRANSFER_DEADLINE、worker 并发数等参数上线后无法校准，
// GCS 故障与上游 CDN 提前过期也无法区分（设计 4.8）。

const (
	gcsMetricsReportInterval = time.Minute
	// gcsMetricsSentinelEvery 每 N 个报告周期执行一次 DB 哨兵查询（master 节点）
	gcsMetricsSentinelEvery = 5
)

// gcsDurationBucketSeconds 转存耗时直方图桶边界（秒），最后一桶为 +Inf。
// 桶位对齐运行参数：15s 轮询周期、GCS_TRANSFER_TIMEOUT 默认 10 分钟。
var gcsDurationBucketSeconds = []int64{5, 15, 60, 300, 600}

// gcsDurationHist 单平台（渠道）的转存耗时直方图：固定桶计数 + sum/count。
type gcsDurationHist struct {
	buckets [6]atomic.Int64 // len(gcsDurationBucketSeconds)+1，末桶 +Inf
	sumMs   atomic.Int64
	count   atomic.Int64
}

// gcsMetricsRegistry 进程内指标注册表。全部为进程启动以来的累计值（gauge 除外）。
type gcsMetricsRegistry struct {
	// ── 转存结果计数器（设计 4.8）──
	transferSuccess   atomic.Int64 // 整任务转存成功（CAS 赢 + 结算）
	existsReuse       atomic.Int64 // 逐对象「已存在=已完成」复用次数（含竞写分支）
	downloadFail      atomic.Int64 // 上游取流失败
	gcsAuthFail       atomic.Int64 // GCS 鉴权失败（401/403/凭证失效）
	gcsServiceFail    atomic.Int64 // GCS 服务故障（5xx/网络/超时）及其他未分类转存失败
	internalFail      atomic.Int64 // 网关内部失败（DB/adaptor/资产清单损坏）
	oversize          atomic.Int64 // 超过 GCS_MAX_OBJECT_SIZE
	corruptObject     atomic.Int64 // 复用前 size/CRC32C 校验不一致（疑似截断对象）
	extractFail       atomic.Int64 // 上游 success 但资产枚举失败或为空（轮询侧）
	deadlineExhausted atomic.Int64 // 超 GCS_TRANSFER_DEADLINE 墙钟截止判 FAILURE
	casLost           atomic.Int64 // worker 终态 CAS 输（已被 sweep/超截止等翻终态）
	degradeComplete   atomic.Int64 // 紧急开关关闭后的存量任务直链降级完成

	// deadlineRefundQuota 超截止退款 quota 总量——资损指标：上游已成功生成却退款（设计 4.8）
	deadlineRefundQuota atomic.Int64

	// ── 签名（读取侧，所有副本）──
	signFailAuth    atomic.Int64 // V4 签名鉴权失败（SignBlob 401/403/凭证失效）
	signFailService atomic.Int64 // V4 签名其他失败
	resultExpired   atomic.Int64 // 超保留期拒签次数（契约行为，非失败）

	// ── 计费失败（清单项 14：资金/令牌额度调整吞错点）──
	billingAdjustFail atomic.Int64

	// ── worker 运行状态 ──
	inflight       atomic.Int64 // gauge：当前 inflight worker 数（含信号量排队中）
	pollBacklog    atomic.Int64 // gauge：最近一轮轮询集合中转存阶段任务数（master）
	queueWaitMsSum atomic.Int64
	queueWaitCount atomic.Int64
	queueWaitMsMax atomic.Int64

	durations sync.Map // platform(string) -> *gcsDurationHist

	reporterOnce sync.Once
}

// gcsMetrics 全局注册表。埋点方（gcs_transfer/gcs_storage/task_polling/task_billing）直接访问。
var gcsMetrics = &gcsMetricsRegistry{}

// ── 转存失败分类（验收要求 gcs-auth-fail 与 gcs-service-fail 可区分）──

// errGCSDownloadFailed 上游取流失败的分类标记（transferAsset 在 FetchResultContent
// 出错时包装），与 GCS 侧失败区分——上游 CDN 直链提前过期表现为 download-fail 上升，
// GCS 故障表现为 gcs-service-fail 上升。
var errGCSDownloadFailed = errors.New("gcs transfer: upstream download failed")

// errGCSInternal 网关内部失败的分类标记（DB 读写、adaptor 缺失、资产清单损坏等），
// 不计入 GCS 服务故障。
var errGCSInternal = errors.New("gcs transfer: internal error")

// isGCSAuthError 判断错误链是否为 GCS 鉴权类失败：
//   - googleapi.Error 401/403（API 层拒绝：SA 权限不足/凭证被吊销）；
//   - oauth2.RetrieveError（token 端点拒绝：SA key 失效/invalid_grant）。
//
// 已知残余：新版 auth 库（cloud.google.com/go/auth）的 token 获取失败可能不命中
// 上述类型而落入 service-fail；凭证配置错误在启动期 InitGCSStorage 自检即 fatal。
func isGCSAuthError(err error) bool {
	var apiErr *googleapi.Error
	if errors.As(err, &apiErr) {
		return apiErr.Code == http.StatusUnauthorized || apiErr.Code == http.StatusForbidden
	}
	var tokenErr *oauth2.RetrieveError
	return errors.As(err, &tokenErr)
}

// gcsTransferFailKind 把一次转存尝试的失败错误归类到 4.8 计数器。
// 分类标记（oversize/corrupt/download/internal）优先于按错误类型的 auth/service 推断。
func gcsTransferFailKind(err error) string {
	switch {
	case errors.Is(err, errGCSAssetOversize):
		return "oversize"
	case errors.Is(err, ErrGCSObjectCorrupted):
		return "corrupt-object"
	case errors.Is(err, errGCSDownloadFailed):
		return "download-fail"
	case errors.Is(err, errGCSInternal):
		return "internal-fail"
	case isGCSAuthError(err):
		return "gcs-auth-fail"
	default:
		return "gcs-service-fail"
	}
}

// recordTransferFailure 按分类累加转存失败计数。
func (r *gcsMetricsRegistry) recordTransferFailure(kind string) {
	switch kind {
	case "oversize":
		r.oversize.Add(1)
	case "corrupt-object":
		r.corruptObject.Add(1)
	case "download-fail":
		r.downloadFail.Add(1)
	case "internal-fail":
		r.internalFail.Add(1)
	case "gcs-auth-fail":
		r.gcsAuthFail.Add(1)
	default:
		r.gcsServiceFail.Add(1)
	}
}

// recordTransferSuccess 记录整任务转存成功 + 按平台（渠道）累加耗时直方图。
// duration 为本次成功尝试的实际转存耗时（信号量取得后起算，不含排队）。
func (r *gcsMetricsRegistry) recordTransferSuccess(platform string, duration time.Duration) {
	r.transferSuccess.Add(1)
	if platform == "" {
		platform = "unknown"
	}
	v, _ := r.durations.LoadOrStore(platform, &gcsDurationHist{})
	h := v.(*gcsDurationHist)
	sec := int64(duration / time.Second)
	idx := len(gcsDurationBucketSeconds)
	for i, le := range gcsDurationBucketSeconds {
		if sec <= le {
			idx = i
			break
		}
	}
	h.buckets[idx].Add(1)
	h.sumMs.Add(duration.Milliseconds())
	h.count.Add(1)
}

// recordSignFailure 签名失败计数（auth 与 service 区分；SignBlob 路径尤其需要）。
func (r *gcsMetricsRegistry) recordSignFailure(err error) {
	if isGCSAuthError(err) {
		r.signFailAuth.Add(1)
	} else {
		r.signFailService.Add(1)
	}
}

// recordQueueWait 记录 worker 信号量排队时长（sum/count/max）。
func (r *gcsMetricsRegistry) recordQueueWait(d time.Duration) {
	ms := d.Milliseconds()
	r.queueWaitMsSum.Add(ms)
	r.queueWaitCount.Add(1)
	for {
		cur := r.queueWaitMsMax.Load()
		if ms <= cur || r.queueWaitMsMax.CompareAndSwap(cur, ms) {
			return
		}
	}
}

// countersTotal 全部累计计数器之和，用于 reporter 的「有变化才打日志」判断。
func (r *gcsMetricsRegistry) countersTotal() int64 {
	return r.transferSuccess.Load() + r.existsReuse.Load() + r.downloadFail.Load() +
		r.gcsAuthFail.Load() + r.gcsServiceFail.Load() + r.internalFail.Load() +
		r.oversize.Load() + r.corruptObject.Load() + r.extractFail.Load() +
		r.deadlineExhausted.Load() + r.casLost.Load() + r.degradeComplete.Load() +
		r.signFailAuth.Load() + r.signFailService.Load() + r.resultExpired.Load() +
		r.billingAdjustFail.Load() + r.queueWaitCount.Load()
}

// startGCSMetricsReporter 启动周期性统计日志 goroutine（幂等，所有实例均运行：
// 签名失败/计费失败发生在每个副本；DB 哨兵仅 master 执行）。
func startGCSMetricsReporter() {
	gcsMetrics.reporterOnce.Do(func() {
		gopool.Go(gcsMetricsReportLoop)
	})
}

func gcsMetricsReportLoop() {
	lastTotal := int64(-1) // 首轮必打一行基线
	tick := 0
	for {
		time.Sleep(gcsMetricsReportInterval)
		tick++
		if total := gcsMetrics.countersTotal(); total != lastTotal {
			lastTotal = total
			common.SysLog(gcsMetrics.countersLogLine())
			for _, line := range gcsMetrics.durationLogLines() {
				common.SysLog(line)
			}
		}
		if tick%gcsMetricsSentinelEvery == 0 && common.IsMasterNode {
			reportGCSSentinels()
		}
	}
}

// countersLogLine 单行结构化计数器快照（进程启动以来累计值；inflight/poll_backlog 为 gauge）。
func (r *gcsMetricsRegistry) countersLogLine() string {
	queueWaitAvgMs := int64(0)
	if n := r.queueWaitCount.Load(); n > 0 {
		queueWaitAvgMs = r.queueWaitMsSum.Load() / n
	}
	return fmt.Sprintf("gcs-metrics counters"+
		" success=%d exists_reuse=%d download_fail=%d gcs_auth_fail=%d gcs_service_fail=%d internal_fail=%d"+
		" oversize=%d corrupt_object=%d extract_fail=%d deadline_exhausted=%d deadline_refund_quota=%d"+
		" cas_lost=%d degrade_complete=%d sign_fail_auth=%d sign_fail_service=%d result_expired=%d"+
		" billing_adjust_fail=%d inflight=%d poll_backlog=%d queue_wait_avg_ms=%d queue_wait_max_ms=%d",
		r.transferSuccess.Load(), r.existsReuse.Load(), r.downloadFail.Load(),
		r.gcsAuthFail.Load(), r.gcsServiceFail.Load(), r.internalFail.Load(),
		r.oversize.Load(), r.corruptObject.Load(), r.extractFail.Load(),
		r.deadlineExhausted.Load(), r.deadlineRefundQuota.Load(),
		r.casLost.Load(), r.degradeComplete.Load(),
		r.signFailAuth.Load(), r.signFailService.Load(), r.resultExpired.Load(),
		r.billingAdjustFail.Load(), r.inflight.Load(), r.pollBacklog.Load(),
		queueWaitAvgMs, r.queueWaitMsMax.Load())
}

// durationLogLines 每平台一行转存耗时直方图快照。
func (r *gcsMetricsRegistry) durationLogLines() []string {
	var lines []string
	r.durations.Range(func(key, value any) bool {
		h := value.(*gcsDurationHist)
		if h.count.Load() == 0 {
			return true
		}
		var b strings.Builder
		fmt.Fprintf(&b, "gcs-metrics duration platform=%s count=%d sum_ms=%d", key.(string), h.count.Load(), h.sumMs.Load())
		for i, le := range gcsDurationBucketSeconds {
			fmt.Fprintf(&b, " le_%ds=%d", le, h.buckets[i].Load())
		}
		fmt.Fprintf(&b, " inf=%d", h.buckets[len(gcsDurationBucketSeconds)].Load())
		lines = append(lines, b.String())
		return true
	})
	sort.Strings(lines)
	return lines
}

// reportGCSSentinels DB 哨兵查询（仅 master）：
//   - 卡死哨兵：status=IN_PROGRESS 且 progress=100% 的任务数，验收要求恒为 0——
//     该状态同时退出轮询与超时清扫集合，永久卡死、资金悬置（设计 3.3 / 红线 1）；
//   - 转存积压量（DB 全量）：补充轮询集合 gauge（poll_backlog 受 TASK_QUERY_LIMIT 截断），
//     积压过多会饿死新任务的轮询，需告警 + GCS_TRANSFER_ENABLED 紧急开关止血（设计 风险 3）。
func reportGCSSentinels() {
	stuck, err := model.CountStuckInProgressCompleteTasks()
	if err != nil {
		common.SysError(fmt.Sprintf("gcs-metrics sentinel query failed (stuck): %s", err.Error()))
		return
	}
	backlog, err := model.CountTransferStageTasks()
	if err != nil {
		common.SysError(fmt.Sprintf("gcs-metrics sentinel query failed (backlog): %s", err.Error()))
		return
	}
	line := fmt.Sprintf("gcs-metrics sentinel stuck_inprogress_100=%d transfer_backlog_db=%d", stuck, backlog)
	if stuck > 0 {
		// 卡死任务无法自愈（已退出轮询与清扫集合），必须人工介入
		common.SysError(line + " — stuck tasks detected (status=IN_PROGRESS AND progress=100%), manual intervention required")
		return
	}
	common.SysLog(line)
}
