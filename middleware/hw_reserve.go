package middleware

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// HwBureauReserveGate holds customer traffic inside the share of the shared
// subscription that the bureau leaves free (service/hw_reserve.go states the
// rule). It sits after authentication and right before channel selection, so a
// refusal never touches a channel and a stream that already started is never
// interrupted: only new requests are turned away.
//
// The measurement is cached briefly, because the log table and the bureau
// endpoint are far too expensive to ask on every request.
const (
	hwReserveGateCacheTTL = 15 * time.Second

	// hwReserveGateCustomerCacheLimit bounds the per-customer measurements kept
	// in memory; beyond it the table is dropped instead of growing without end.
	hwReserveGateCustomerCacheLimit = 8192

	// hwReserveGateRefusalLogEvery logs the first refusal and then every this
	// many, so an exhausted window does not write a line per request.
	hwReserveGateRefusalLogEvery = 100
)

type hwReserveCustomerEntry struct {
	group  string
	status service.HwCustomerReserveStatus
	at     time.Time
}

type hwReserveGateState struct {
	mu         sync.Mutex
	snapshot   service.HwReserveSnapshot
	snapshotAt time.Time
	customers  map[int]hwReserveCustomerEntry
	refusals   map[string]int64
	refusalAt  int64
}

var hwReserveGate hwReserveGateState

// HwResetReserveGateCache drops the cached decisions. Tests use it after
// changing the environment or the options; an operator can use it after
// changing a reserve setting to apply it without waiting for the cache.
func HwResetReserveGateCache() {
	hwReserveGate.mu.Lock()
	defer hwReserveGate.mu.Unlock()
	hwReserveGate.snapshot = service.HwReserveSnapshot{}
	hwReserveGate.snapshotAt = time.Time{}
	hwReserveGate.customers = nil
}

// HwBureauReserveGate refuses customer requests when the current window has no
// free room left for customers, or when this customer reached its own ceiling.
func HwBureauReserveGate() gin.HandlerFunc {
	return func(c *gin.Context) {
		group, customer := hwReserveCustomerGroup(c)
		if !customer {
			c.Next()
			return
		}
		now := time.Now().UTC()
		snapshot := hwReserveGateSnapshot(c.Request.Context(), now)
		if snapshot.DenyReason != "" {
			hwAbortReserve(c, http.StatusServiceUnavailable, service.HwErrorCodeServiceBusy,
				service.HwReserveBusyMessage(c, snapshot.RetryAfterSeconds), snapshot.RetryAfterSeconds, snapshot.DenyReason)
			return
		}
		status, err := hwReserveGateCustomer(now, c.GetInt("id"), group)
		if err != nil {
			common.SysLog(common.LogText("hw reserve gate: customer usage could not be read"))
			hwAbortReserve(c, http.StatusServiceUnavailable, service.HwErrorCodeServiceBusy,
				service.HwReserveBusyMessage(c, snapshot.RetryAfterSeconds), snapshot.RetryAfterSeconds, service.HwReserveDenyUsageUnavailable)
			return
		}
		if status.Limited {
			hwAbortReserve(c, http.StatusTooManyRequests, service.HwErrorCodeWindowLimitReached,
				service.HwReserveCeilingMessage(c, status.RetryAfterSeconds), status.RetryAfterSeconds, service.HwReserveDenyCeilingReached)
			return
		}
		c.Next()
	}
}

// hwReserveCustomerGroup reports whether the request belongs to a customer and
// which group its ceiling should follow. The user's own group wins over the
// token group, so a token in the "auto" group cannot step around the gate.
func hwReserveCustomerGroup(c *gin.Context) (string, bool) {
	if accountGroup := hwUserGroup(c); model.HwIsCustomerGroup(accountGroup) {
		return accountGroup, true
	}
	if usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup); model.HwIsCustomerGroup(usingGroup) {
		return usingGroup, true
	}
	return "", false
}

// hwReserveGateSnapshot returns the window measurement, refreshed at most every
// hwReserveGateCacheTTL and immediately after a window change.
func hwReserveGateSnapshot(ctx context.Context, now time.Time) service.HwReserveSnapshot {
	windowStart, _ := model.HwReserveWindow(now)

	hwReserveGate.mu.Lock()
	cached := hwReserveGate.snapshot
	cachedAt := hwReserveGate.snapshotAt
	hwReserveGate.mu.Unlock()
	if !cachedAt.IsZero() && cached.WindowStart == windowStart && now.Sub(cachedAt) < hwReserveGateCacheTTL {
		return cached
	}

	measured := service.HwBureauReserveSnapshot(ctx, now)

	hwReserveGate.mu.Lock()
	defer hwReserveGate.mu.Unlock()
	// Another request may have measured while this one was waiting; keep the
	// fresh result instead of overwriting it with an older measurement.
	if hwReserveGate.snapshotAt.After(cachedAt) && hwReserveGate.snapshot.WindowStart == windowStart {
		return hwReserveGate.snapshot
	}
	hwReserveGate.snapshot = measured
	hwReserveGate.snapshotAt = now
	return measured
}

// hwReserveGateCustomer returns this customer's usage of the window, cached for
// the same short interval as the window measurement.
func hwReserveGateCustomer(now time.Time, userID int, group string) (service.HwCustomerReserveStatus, error) {
	windowStart, _ := model.HwReserveWindow(now)

	hwReserveGate.mu.Lock()
	entry, cached := hwReserveGate.customers[userID]
	hwReserveGate.mu.Unlock()
	if cached && entry.group == group && entry.status.WindowStart == windowStart && now.Sub(entry.at) < hwReserveGateCacheTTL {
		return entry.status, nil
	}

	status, err := service.HwCustomerReserveStatusNow(userID, group, now)
	if err != nil {
		return status, err
	}

	hwReserveGate.mu.Lock()
	defer hwReserveGate.mu.Unlock()
	if hwReserveGate.customers == nil || len(hwReserveGate.customers) >= hwReserveGateCustomerCacheLimit {
		hwReserveGate.customers = make(map[int]hwReserveCustomerEntry)
	}
	hwReserveGate.customers[userID] = hwReserveCustomerEntry{group: group, status: status, at: now}
	return status, nil
}

// hwAbortReserve writes the refusal in the shape the route speaks: the Claude
// error envelope for /v1/messages, the OpenAI one elsewhere. Both carry the
// Retry-After of the next window. The message is our own wording and names no
// supplier.
func hwAbortReserve(c *gin.Context, statusCode int, code types.ErrorCode, message string, retryAfterSeconds int, reason string) {
	if retryAfterSeconds < 0 {
		retryAfterSeconds = 0
	}
	c.Header("Retry-After", strconv.Itoa(retryAfterSeconds))
	// The Claude envelope has no separate code field, so the error type carries
	// our own code; the OpenAI envelope carries it in "code".
	claudeError := types.WithClaudeError(types.ClaudeError{Type: string(code), Message: message}, statusCode, types.ErrOptionWithSkipRetry())
	openAIError := types.NewErrorWithStatusCode(errors.New(message), code, statusCode, types.ErrOptionWithSkipRetry())
	if strings.Contains(c.Request.URL.Path, "/messages") {
		c.AbortWithStatusJSON(statusCode, gin.H{
			"type":  "error",
			"error": claudeError.ToClaudeError(),
		})
	} else {
		c.AbortWithStatusJSON(statusCode, gin.H{
			"error": openAIError.ToOpenAIError(),
		})
	}
	hwReserveCountRefusal(reason)
}

// hwReserveCountRefusal logs how many customer requests the gate refused in this
// window: a count and a reason, never a key, a customer name or a request text.
func hwReserveCountRefusal(reason string) {
	windowStart, _ := model.HwReserveWindow(time.Now().UTC())

	hwReserveGate.mu.Lock()
	if hwReserveGate.refusalAt != windowStart {
		hwReserveGate.refusals = make(map[string]int64)
		hwReserveGate.refusalAt = windowStart
	}
	hwReserveGate.refusals[reason]++
	count := hwReserveGate.refusals[reason]
	hwReserveGate.mu.Unlock()

	if count == 1 || count%hwReserveGateRefusalLogEvery == 0 {
		common.SysLog(common.LogText("hw reserve gate: %d customer requests refused in this window (%s)", count, reason))
	}
}
