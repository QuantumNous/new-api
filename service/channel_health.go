package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

const (
	channelHealthWindow        = 10 * time.Minute
	channelMinSamples          = 10
	channelFaultCountThreshold = 5
	channelFaultRateThreshold  = 0.30
	channelConsecutiveFault    = 5
	channelRateLimitThreshold  = 8
	channelRechargeFuzzyCount  = 3
)

// HealthAction is the outcome of EvaluateChannelHealth.
type HealthAction int

const (
	HealthSkip HealthAction = iota
	HealthNotifyRecharge
	HealthDisableImmediate
	HealthDisableWindow
	HealthProbeBeforeDisable
)

type healthEvent struct {
	at         time.Time
	category   ChannelErrorCategory
	statusCode int
}

type channelHealthState struct {
	mu        sync.Mutex
	successes []time.Time
	events    []healthEvent
	rechargeN int // recharge-class errors in window (for fuzzy notify threshold)
}

var channelHealth sync.Map // int channelId -> *channelHealthState

func getChannelHealth(channelID int) *channelHealthState {
	if v, ok := channelHealth.Load(channelID); ok {
		return v.(*channelHealthState)
	}
	st := &channelHealthState{}
	actual, _ := channelHealth.LoadOrStore(channelID, st)
	return actual.(*channelHealthState)
}

func (s *channelHealthState) prune(now time.Time) {
	cutoff := now.Add(-channelHealthWindow)
	i := 0
	for i < len(s.successes) && s.successes[i].Before(cutoff) {
		i++
	}
	s.successes = s.successes[i:]

	j := 0
	for j < len(s.events) && s.events[j].at.Before(cutoff) {
		j++
	}
	s.events = s.events[j:]
	if j > 0 {
		// recharge counter is approximate; reset on prune batch
		s.rechargeN = 0
		for _, ev := range s.events {
			if ev.category == CategoryUpstreamRecharge {
				s.rechargeN++
			}
		}
	}
}

// RecordChannelSuccess tracks a successful relay through a channel (for error-rate window).
func RecordChannelSuccess(channelID int) {
	if channelID <= 0 {
		return
	}
	st := getChannelHealth(channelID)
	now := time.Now()
	st.mu.Lock()
	defer st.mu.Unlock()
	st.prune(now)
	st.successes = append(st.successes, now)
}

func recordChannelErrorEvent(channelID int, category ChannelErrorCategory, statusCode int) {
	st := getChannelHealth(channelID)
	now := time.Now()
	st.mu.Lock()
	defer st.mu.Unlock()
	st.prune(now)
	st.events = append(st.events, healthEvent{at: now, category: category, statusCode: statusCode})
	if category == CategoryUpstreamRecharge {
		st.rechargeN++
	}
}

// EvaluateChannelHealth decides whether to disable or notify based on error class + sliding window.
func EvaluateChannelHealth(channelError types.ChannelError, err *types.NewAPIError) (HealthAction, string) {
	if !common.AutomaticDisableChannelEnabled || err == nil {
		return HealthSkip, ""
	}
	if !channelError.AutoBan {
		return HealthSkip, ""
	}

	category := ClassifyChannelError(err)
	recordChannelErrorEvent(channelError.ChannelId, category, err.StatusCode)

	switch category {
	case CategorySkip:
		return HealthSkip, ""
	case CategoryUpstreamRecharge:
		st := getChannelHealth(channelError.ChannelId)
		st.mu.Lock()
		rechargeCount := st.rechargeN
		st.mu.Unlock()
		if IsHighConfidenceRecharge(err) || rechargeCount >= channelRechargeFuzzyCount {
			return HealthNotifyRecharge, summarizeRechargeReason(err, rechargeCount)
		}
		return HealthSkip, ""
	case CategoryDisableImmediate:
		return HealthDisableImmediate, err.ErrorWithStatusCode()
	case CategoryRateLimitWindow:
		if shouldDisableRateLimitWindow(channelError.ChannelId) {
			return HealthProbeBeforeDisable, summarizeWindowReason(channelError.ChannelId, "429 rate-limit/cooldown")
		}
		return HealthSkip, ""
	case CategoryDisableWindow:
		if shouldDisableFaultWindow(channelError.ChannelId, err.StatusCode) {
			return HealthProbeBeforeDisable, summarizeWindowReason(channelError.ChannelId, fmt.Sprintf("HTTP %d", err.StatusCode))
		}
		return HealthSkip, ""
	default:
		return HealthSkip, ""
	}
}

func shouldDisableFaultWindow(channelID int, statusCode int) bool {
	st := getChannelHealth(channelID)
	now := time.Now()
	st.mu.Lock()
	defer st.mu.Unlock()
	st.prune(now)

	faultCount := 0
	successCount := len(st.successes)
	consecutive := 0
	lastFaultCode := 0

	for i := len(st.events) - 1; i >= 0; i-- {
		ev := st.events[i]
		if ev.category != CategoryDisableWindow {
			break
		}
		if consecutive == 0 || ev.statusCode == lastFaultCode {
			consecutive++
			lastFaultCode = ev.statusCode
		} else {
			break
		}
	}

	for _, ev := range st.events {
		if ev.category == CategoryDisableWindow {
			faultCount++
		}
	}

	total := successCount + faultCount
	if consecutive >= channelConsecutiveFault && (statusCode == 502 || statusCode == 524) {
		return true
	}
	if total < channelMinSamples {
		return false
	}
	if faultCount >= channelFaultCountThreshold && float64(faultCount)/float64(total) >= channelFaultRateThreshold {
		return true
	}
	return false
}

func shouldDisableRateLimitWindow(channelID int) bool {
	st := getChannelHealth(channelID)
	now := time.Now()
	st.mu.Lock()
	defer st.mu.Unlock()
	st.prune(now)
	n := 0
	for _, ev := range st.events {
		if ev.category == CategoryRateLimitWindow {
			n++
		}
	}
	return n >= channelRateLimitThreshold
}

func summarizeWindowReason(channelID int, trigger string) string {
	st := getChannelHealth(channelID)
	st.mu.Lock()
	defer st.mu.Unlock()
	faultCount := 0
	successCount := len(st.successes)
	codeCount := map[int]int{}
	for _, ev := range st.events {
		if ev.category == CategoryDisableWindow || ev.category == CategoryRateLimitWindow {
			faultCount++
			codeCount[ev.statusCode]++
		}
	}
	parts := []string{trigger}
	for code, n := range codeCount {
		if n > 0 {
			parts = append(parts, fmt.Sprintf("%d×%d", code, n))
		}
	}
	total := successCount + faultCount
	rate := 0.0
	if total > 0 {
		rate = float64(faultCount) / float64(total) * 100
	}
	return fmt.Sprintf("%s；近10分钟故障 %d/%d (%.0f%%)", strings.Join(parts, ", "), faultCount, total, rate)
}

func summarizeRechargeReason(err *types.NewAPIError, count int) string {
	snip := err.MaskSensitiveErrorWithStatusCode()
	if len(snip) > 200 {
		snip = snip[:200] + "…"
	}
	return fmt.Sprintf("上游账户欠费/额度不足：%s（近10分钟 %d 次）", snip, count)
}

// RechargeErrorCountInWindow returns recharge-class errors in the current window (for notifications).
func RechargeErrorCountInWindow(channelID int) int {
	st := getChannelHealth(channelID)
	st.mu.Lock()
	defer st.mu.Unlock()
	st.prune(time.Now())
	return st.rechargeN
}

func ClearChannelHealth(channelID int) {
	if channelID <= 0 {
		return
	}
	channelHealth.Delete(channelID)
}

// resetChannelHealthForTest clears in-memory health state (tests only).
func resetChannelHealthForTest() {
	channelHealth = sync.Map{}
}
