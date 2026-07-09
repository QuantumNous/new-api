package controller

import (
	"context"
	"fmt"
	"io"
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
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	model_setting "github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// clientgone fallback（首字竞速）：
// 配置中的模型流式请求，主渠道在 frt_timeout_seconds + extra_seconds_per_mb × body_MB 秒内
// 没吐出首个数据帧时，并行向下一个可用渠道发 hedge 请求；谁先出首字节谁赢（直通客户端），
// 败者立即 cancel 丢弃。hedge 触发消耗一次 fallback 机会；用户只按赢家计费一次。

const clientGoneHedgeWinnerChannelKey = "clientgone_hedge_winner_channel_id"

// shouldClientGoneHedge 判定当前请求是否进入首字竞速分支。
func shouldClientGoneHedge(c *gin.Context, info *relaycommon.RelayInfo, relayFormat types.RelayFormat, retryIndex int) (model_setting.ClientGoneFallbackPolicy, bool) {
	if c == nil || info == nil || retryIndex != 0 {
		return model_setting.ClientGoneFallbackPolicy{}, false
	}
	if !info.IsStream || info.IsPlayground || info.IsChannelTest {
		return model_setting.ClientGoneFallbackPolicy{}, false
	}
	switch relayFormat {
	case types.RelayFormatClaude, types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses:
	default:
		return model_setting.ClientGoneFallbackPolicy{}, false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return model_setting.ClientGoneFallbackPolicy{}, false
	}
	return model_setting.FindClientGoneFallbackPolicy(info.OriginModelName)
}

type hedgeAttempt struct {
	role       string
	c          *gin.Context
	cancel     context.CancelFunc
	info       *relaycommon.RelayInfo
	gate       *helper.StreamGate
	channel    *model.Channel
	err        *types.NewAPIError
	done       chan struct{}
	startedAt  time.Time
	finishedAt time.Time
}

func (a *hedgeAttempt) channelLabel() string {
	if a == nil || a.channel == nil {
		return "-"
	}
	return fmt.Sprintf("#%d/%s", a.channel.Id, a.channel.Name)
}

func (a *hedgeAttempt) frtLabel() string {
	if a == nil || a.info == nil || !a.info.HasSendResponse() {
		return "未出首字"
	}
	return fmt.Sprintf("%.1fs", a.info.FirstResponseTime.Sub(a.info.StartTime).Seconds())
}

// runClientGoneHedgedRelay 执行首字竞速。返回值语义与单路 helper 一致，
// 直接交给外层重试循环的 evaluateRetry；成功时返回 nil。
func runClientGoneHedgedRelay(c *gin.Context, relayInfo *relaycommon.RelayInfo, relayFormat types.RelayFormat,
	primaryChannel *model.Channel, retryParam *service.RetryParam, policy model_setting.ClientGoneFallbackPolicy) *types.NewAPIError {

	bodyStorage, bodyErr := common.GetBodyStorage(c)
	if bodyErr != nil {
		// 拿不到 body 副本时静默退回单路现状
		return dispatchHedgeRelay(c, relayInfo, relayFormat)
	}
	bodyBytes, bodyErr2 := bodyStorage.Bytes()
	if bodyErr2 != nil {
		return dispatchHedgeRelay(c, relayInfo, relayFormat)
	}
	thresholdSeconds := policy.FirstByteTimeoutSeconds(int64(len(bodyBytes)))
	threshold := time.Duration(thresholdSeconds) * time.Second

	sink := helper.NewSharedClientSink(c.Writer)

	var raceMu sync.Mutex
	var winner *hedgeAttempt
	winnerCh := make(chan *hedgeAttempt, 1)
	attempts := make([]*hedgeAttempt, 0, 2)

	// judge：gate 收到首个数据帧时同步判胜；胜者返回 true，并对败者 MarkLoser → cancel
	judge := func(a *hedgeAttempt) func(*helper.StreamGate) bool {
		return func(_ *helper.StreamGate) bool {
			raceMu.Lock()
			defer raceMu.Unlock()
			if winner != nil {
				return winner == a
			}
			winner = a
			winnerCh <- a
			for _, other := range attempts {
				if other == a {
					continue
				}
				other.info.HedgeState.MarkLoser()
				other.gate.Discard()
				other.cancel()
			}
			return true
		}
	}

	buildAttempt := func(role string, channel *model.Channel) (*hedgeAttempt, error) {
		a := &hedgeAttempt{role: role, channel: channel, done: make(chan struct{}), startedAt: time.Now()}
		cc := c.Copy()
		attemptCtx, cancel := context.WithCancel(c.Request.Context())
		a.cancel = cancel
		cc.Request = c.Request.Clone(attemptCtx)
		storage, err := common.CreateBodyStorage(append([]byte(nil), bodyBytes...))
		if err != nil {
			cancel()
			return nil, err
		}
		cc.Set(common.KeyBodyStorage, storage)
		cc.Request.Body = io.NopCloser(storage)
		a.gate = helper.NewStreamGate(sink, judge(a))
		cc.Writer = a.gate
		a.c = cc

		a.info = relayInfo.CloneForHedgeAttempt(role)
		if role == relaycommon.HedgeRolePrimary {
			// primary 独占原始 Request DTO（外层在竞速期间不使用它）
			a.info.Request = relayInfo.Request
		} else {
			// hedge 必须重新解析自己的 Request：模型映射会按渠道改写 DTO，不能共享
			req, reqErr := helper.GetAndValidateRequest(cc, relayFormat)
			if reqErr != nil {
				cancel()
				return nil, reqErr
			}
			a.info.Request = req
		}
		return a, nil
	}

	startAttempt := func(a *hedgeAttempt) {
		gopool.Go(func() {
			defer func() {
				if r := recover(); r != nil {
					logger.LogError(a.c, fmt.Sprintf("clientgone hedge %s attempt panic: %v", a.role, r))
					a.err = types.NewError(fmt.Errorf("hedge attempt panic: %v", r), types.ErrorCodeDoRequestFailed)
				}
				a.finishedAt = time.Now()
				close(a.done)
			}()
			a.err = dispatchHedgeRelay(a.c, a.info, relayFormat)
		})
	}

	primary, buildErr := buildAttempt(relaycommon.HedgeRolePrimary, primaryChannel)
	if buildErr != nil {
		logger.LogError(c, fmt.Sprintf("clientgone hedge: build primary attempt failed, fallback to normal relay: %s", buildErr.Error()))
		return dispatchHedgeRelay(c, relayInfo, relayFormat)
	}
	raceMu.Lock()
	attempts = append(attempts, primary)
	raceMu.Unlock()
	startAttempt(primary)

	var hedge *hedgeAttempt
	timer := time.NewTimer(threshold)
	defer timer.Stop()

	select {
	case <-primary.done:
		// 主渠道在阈值内结束（成功流完或报错）
	case <-c.Request.Context().Done():
		// 客户端断开：primary 的派生 ctx 级联取消，等它收尾即可
	case <-timer.C:
		raceMu.Lock()
		alreadyWon := winner != nil
		raceMu.Unlock()
		if !alreadyWon && c.Request.Context().Err() == nil {
			hedge = armHedgeAttempt(c, relayInfo, retryParam, primaryChannel, buildAttempt, startAttempt)
		}
	}

	// 等待终局：一旦有赢家，只等赢家自己的流跑完就返回（败者收尾异步做，绝不吊住客户端连接）；
	// 无赢家则等两路都结束（双败）
	finalWinner := awaitRaceOutcome(winnerCh, primary, hedge)

	// 安全网：没有任何数据帧但有 attempt 正常结束（理论上流式必有数据，防御性处理；此时两路都已结束）
	if finalWinner == nil {
		if primary.err == nil {
			finalWinner = primary
		} else if hedge != nil && hedge.err == nil {
			finalWinner = hedge
		}
	}

	hedgeArmed := hedge != nil || c.GetBool("clientgone_hedge_triggered")

	if finalWinner == nil {
		// 双败（或主渠道单路失败）：正常回到外层串行重试。
		// primary 的 processChannelError 由外层循环完成；hedge 的真实失败在这里计入渠道健康
		if hedge != nil && hedge.err != nil && hedge.c.Request.Context().Err() == nil {
			processChannelError(hedge.c, *types.NewChannelError(hedge.channel.Id, hedge.channel.Type, hedge.channel.Name,
				hedge.channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(hedge.c, constant.ContextKeyChannelKey),
				hedge.channel.GetAutoBan()), hedge.err)
			c.Set("clientgone_hedge_error", hedge.err.MaskSensitiveErrorWithStatusCode())
		}
		backfillRelayInfoFromAttempt(relayInfo, primary.info)
		if hedgeArmed {
			notifyClientGoneHedgeResult(c, relayInfo, thresholdSeconds, len(bodyBytes), primary, hedge, nil, primary.err)
		}
		return primary.err
	}

	// 有赢家：结算赢家、回填状态；败者可能仍在收尾（已被 cancel），记账放后台
	var loser *hedgeAttempt
	for _, a := range []*hedgeAttempt{primary, hedge} {
		if a != nil && a != finalWinner {
			loser = a
		}
	}

	winnerUsage := service.FinalizeHedgeWinnerBilling(finalWinner.c, finalWinner.info)
	if loser != nil {
		loserAttempt := loser
		winnerChannelId := finalWinner.channel.Id
		requestID := c.GetString(common.RequestIdKey)
		gopool.Go(func() {
			if !waitAttempt(loserAttempt, 120*time.Second) {
				// 败者协程 120s 仍未退出：放弃记账。其 HedgeState 永不结算 → 永不计费，安全
				logger.LogError(context.Background(), fmt.Sprintf(
					"clientgone hedge: loser attempt (channel #%d) did not finish within grace period, skip loser accounting, request_id=%s",
					loserAttempt.channel.Id, requestID))
				return
			}
			service.RecordHedgeLoserConsumption(loserAttempt.c, loserAttempt.info,
				loserAttempt.channel.Id, loserAttempt.channel.Name, winnerChannelId)
		})
	}

	backfillRelayInfoFromAttempt(relayInfo, finalWinner.info)
	common.SetContextKey(c, constant.ContextKeyChannelId, finalWinner.channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelName, finalWinner.channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelType, finalWinner.channel.Type)
	c.Set(clientGoneHedgeWinnerChannelKey, finalWinner.channel.Id)

	// 赢家 mid-stream 失败：错误归因到赢家渠道（外层循环只认 primary channel，会记错账）
	if finalWinner.err != nil {
		processChannelError(finalWinner.c, *types.NewChannelError(finalWinner.channel.Id, finalWinner.channel.Type,
			finalWinner.channel.Name, finalWinner.channel.ChannelInfo.IsMultiKey,
			common.GetContextKeyString(finalWinner.c, constant.ContextKeyChannelKey), finalWinner.channel.GetAutoBan()), finalWinner.err)
		c.Set("clientgone_hedge_error_accounted", true)
	}

	if hedgeArmed {
		notifyClientGoneHedgeResultWithUsage(c, relayInfo, thresholdSeconds, len(bodyBytes), primary, hedge, finalWinner, finalWinner.err, winnerUsage)
	}

	return finalWinner.err
}

// armHedgeAttempt 选出 hedge 渠道并启动第二路；选不出（或与主渠道相同）时返回 nil，静默保持单路。
func armHedgeAttempt(c *gin.Context, relayInfo *relaycommon.RelayInfo, retryParam *service.RetryParam,
	primaryChannel *model.Channel, buildAttempt func(string, *model.Channel) (*hedgeAttempt, error),
	startAttempt func(*hedgeAttempt)) *hedgeAttempt {

	// hedge 触发即消耗一次 fallback 机会
	retryParam.IncreaseRetry()
	c.Set("clientgone_hedge_triggered", true)

	channel, _, err := service.CacheGetRandomSatisfiedChannel(retryParam)
	if err != nil || channel == nil {
		logger.LogInfo(c, fmt.Sprintf("clientgone hedge: no hedge channel available, stay single path (%v)", err))
		return nil
	}
	if channel.Id == primaryChannel.Id {
		logger.LogInfo(c, "clientgone hedge: selected channel equals primary, stay single path")
		return nil
	}

	// 先登记 use_channel 再 clone：让赢家日志的链路里能看到两跳
	addUsedChannel(c, channel.Id)
	hedge, buildErr := buildAttempt(relaycommon.HedgeRoleHedge, channel)
	if buildErr != nil {
		logger.LogError(c, fmt.Sprintf("clientgone hedge: build hedge attempt failed: %s", buildErr.Error()))
		return nil
	}
	if apiErr := middleware.SetupContextForSelectedChannel(hedge.c, channel, relayInfo.OriginModelName); apiErr != nil {
		logger.LogError(c, fmt.Sprintf("clientgone hedge: setup hedge channel context failed: %s", apiErr.Error()))
		hedge.cancel()
		return nil
	}
	logger.LogInfo(c, fmt.Sprintf("clientgone hedge triggered: primary #%d no first byte, racing with #%d/%s",
		primaryChannel.Id, channel.Id, channel.Name))
	startAttempt(hedge)
	return hedge
}

func dispatchHedgeRelay(c *gin.Context, info *relaycommon.RelayInfo, relayFormat types.RelayFormat) *types.NewAPIError {
	switch relayFormat {
	case types.RelayFormatClaude:
		return relay.ClaudeHelper(c, info)
	default:
		return relayHandler(c, info)
	}
}

// awaitRaceOutcome 等待竞速终局：
// 有赢家 → 等赢家自己的 goroutine 结束后立即返回（不等败者）；
// 无赢家 → 等两路都结束后返回 nil（双败）。
func awaitRaceOutcome(winnerCh <-chan *hedgeAttempt, primary, hedge *hedgeAttempt) *hedgeAttempt {
	primaryDone := primary.done
	var hedgeDone chan struct{}
	if hedge != nil {
		hedgeDone = hedge.done
	}
	pending := 1
	if hedge != nil {
		pending++
	}
	for pending > 0 {
		select {
		case w := <-winnerCh:
			<-w.done
			return w
		case <-primaryDone:
			primaryDone = nil
			pending--
		case <-hedgeDone:
			hedgeDone = nil
			pending--
		}
	}
	// 两路都已结束：判胜可能发生在最后一刻，补收一次
	select {
	case w := <-winnerCh:
		return w
	default:
		return nil
	}
}

// waitAttempt 等待 attempt 结束；timeout=0 表示无限等。返回是否在时限内结束。
func waitAttempt(a *hedgeAttempt, timeout time.Duration) bool {
	if a == nil {
		return true
	}
	if timeout <= 0 {
		<-a.done
		return true
	}
	select {
	case <-a.done:
		return true
	case <-time.After(timeout):
		return false
	}
}

// backfillRelayInfoFromAttempt 把代表性 attempt（赢家或 primary）的终态回填到外层 RelayInfo，
// 供外层重试循环、perfmetrics、快照等继续使用。
func backfillRelayInfoFromAttempt(dst, src *relaycommon.RelayInfo) {
	if dst == nil || src == nil {
		return
	}
	dst.ChannelMeta = src.ChannelMeta
	dst.FirstResponseTime = src.FirstResponseTime
	dst.SendResponseCount = src.SendResponseCount
	dst.ReceivedResponseCount = src.ReceivedResponseCount
	dst.LastDataTime = src.LastDataTime
	dst.StreamStatus = src.StreamStatus
	dst.FinalRequestRelayFormat = src.FinalRequestRelayFormat
	dst.RequestConversionChain = src.RequestConversionChain
	dst.PriceData = src.PriceData
	dst.LastError = src.LastError
}

func notifyClientGoneHedgeResult(c *gin.Context, relayInfo *relaycommon.RelayInfo, thresholdSeconds int, bodySize int,
	primary, hedge, winner *hedgeAttempt, finalErr *types.NewAPIError) {
	notifyClientGoneHedgeResultWithUsage(c, relayInfo, thresholdSeconds, bodySize, primary, hedge, winner, finalErr, nil)
}

// notifyClientGoneHedgeResultWithUsage 竞速终局异步推一条飞书消息到 newapi 日志群，
// 携带触发信息、两路 frt、判胜与完成情况，供后续分析。
func notifyClientGoneHedgeResultWithUsage(c *gin.Context, relayInfo *relaycommon.RelayInfo, thresholdSeconds int, bodySize int,
	primary, hedge, winner *hedgeAttempt, finalErr *types.NewAPIError, winnerUsage *dto.Usage) {

	chatID := common.FeishuNewAPILogChatID()
	if chatID == "" {
		return
	}

	requestID := c.GetString(common.RequestIdKey)
	userEmail := strings.TrimSpace(relayInfo.UserEmail)
	if userEmail == "" {
		userEmail = "-"
	}

	lines := []string{
		fmt.Sprintf("- request_id：`%s`", requestID),
		fmt.Sprintf("- model：`%s`", relayInfo.OriginModelName),
		fmt.Sprintf("- 邮箱：`%s`", userEmail),
		fmt.Sprintf("- body：`%.2f MB`", float64(bodySize)/1024/1024),
		fmt.Sprintf("- 触发：主渠道 `%s` 超过阈值 `%ds` 未出首字", primary.channelLabel(), thresholdSeconds),
		fmt.Sprintf("- 主渠道 frt：`%s`", primary.frtLabel()),
	}
	if hedge != nil {
		lines = append(lines,
			fmt.Sprintf("- hedge 渠道：`%s`（于 `+%.1fs` 启动）", hedge.channelLabel(), hedge.startedAt.Sub(relayInfo.StartTime).Seconds()),
			fmt.Sprintf("- hedge frt：`%s`", hedge.frtLabel()),
		)
	} else {
		lines = append(lines, "- hedge：`未能选出第二渠道（单路继续）`")
	}

	if winner != nil {
		completedIn := winner.finishedAt.Sub(relayInfo.StartTime).Seconds()
		tokens := "-"
		if winnerUsage != nil {
			tokens = fmt.Sprintf("%d", winnerUsage.TotalTokens)
		}
		lines = append(lines,
			fmt.Sprintf("- 首字判胜：`%s（%s）`", winner.role, winner.channelLabel()),
			fmt.Sprintf("- 消息收完：`%s` 于 `%.1fs` 流完，total tokens `%s`", winner.channelLabel(), completedIn, tokens),
		)
		if loser := pickLoser(primary, hedge, winner); loser != nil {
			lines = append(lines, fmt.Sprintf("- 败者：`%s` 已取消（frt `%s`，收到 chunk `%d`）",
				loser.channelLabel(), loser.frtLabel(), loser.info.ReceivedResponseCount))
		}
	}

	title := "NewAPI clientgone fallback 竞速"
	if finalErr != nil {
		title += "（最终失败）"
		lines = append(lines, fmt.Sprintf("- 最终错误：`%s / HTTP %d`", finalErr.GetErrorCode(), finalErr.StatusCode))
		if hedge != nil && hedge.err != nil {
			lines = append(lines, fmt.Sprintf("- hedge 错误：`%s / HTTP %d`", hedge.err.GetErrorCode(), hedge.err.StatusCode))
		}
	} else if winner != nil {
		title += "（成功）"
	}

	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, title, lines); err != nil {
			logger.LogError(context.Background(), fmt.Sprintf("failed to send clientgone hedge feishu notification: %s", err.Error()))
		}
	})
}

func pickLoser(primary, hedge, winner *hedgeAttempt) *hedgeAttempt {
	for _, a := range []*hedgeAttempt{primary, hedge} {
		if a != nil && a != winner {
			return a
		}
	}
	return nil
}
