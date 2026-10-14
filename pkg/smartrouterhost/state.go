package smartrouterhost

import (
	"bufio"
	"context"
	"errors"
	"net"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const stateKey = "smart_router_host_state"
const excludedKey = "smart_router_host_excluded"

var (
	ErrBinding    = errors.New("smart_router: binding_unavailable")
	ErrBudget     = errors.New("smart_router: attempt_budget_exhausted")
	ErrRetryAfter = errors.New("smart_router: invalid_retry_after")
)

// State contains only verified routing and observation facts, never credentials.
type State struct {
	client            *Client
	request           RouteRequest
	route             RouteResponse
	entries           []RegistryEntry
	mu                sync.Mutex
	limit             int
	attempts          int
	active            bool
	invoked           bool
	unknown           bool
	rawStatus         int
	started           time.Time
	upstreamProtocol  Protocol
	protocolObserved  bool
	protocolCompleted bool
	protocolFailed    bool
	event             AttemptOutcome
	retry             bool
	downstreamFailed  bool
	committed         bool
	ttft              time.Duration
	ttftObserved      bool
	retryAfterMS      int64
	retryAfterValid   bool
}

func NewState(client *Client, request RouteRequest, route RouteResponse, entries []RegistryEntry) *State {
	request.Bindings = slices.Clone(request.Bindings)
	route.Bindings = slices.Clone(route.Bindings)
	return &State{client: client, request: request, route: route, entries: slices.Clone(entries),
		limit: min(len(route.Bindings), request.AttemptLimit, 5)}
}

func StateFor(c *gin.Context) *State {
	if c == nil {
		return nil
	}
	value, _ := c.Get(stateKey)
	state, _ := value.(*State)
	return state
}

func Install(c *gin.Context, state *State) {
	c.Set(stateKey, state)
	c.Writer = &observedWriter{ResponseWriter: c.Writer, state: state}
}
func Exclude(c *gin.Context) {
	if c != nil {
		c.Set(excludedKey, true)
	}
}
func Excluded(c *gin.Context) bool { return c != nil && c.GetBool(excludedKey) }

func (s *State) Current() (RegistryEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.current()
}

func (s *State) current() (RegistryEntry, error) {
	if s.client.now().UnixMilli() >= s.route.ExpiresAt {
		return RegistryEntry{}, ErrExpired
	}
	if s.attempts > 0 && !s.active && !s.retry {
		return RegistryEntry{}, ErrBudget
	}
	index := s.attempts
	if s.active && s.invoked {
		index--
	}
	if index >= s.limit {
		return RegistryEntry{}, ErrBudget
	}
	for _, entry := range s.entries {
		if entry.BindingID == s.route.Bindings[index].BindingID {
			return entry, nil
		}
	}
	return RegistryEntry{}, ErrBinding
}

func (s *State) LimitAttempts(budget int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.limit = min(s.limit, max(0, budget))
}

func (s *State) Begin() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.current(); err != nil {
		return err
	}
	if s.active {
		return ErrBudget
	}
	s.active, s.invoked, s.unknown, s.retry = true, false, false, false
	s.rawStatus = 0
	s.upstreamProtocol = s.request.Protocol
	s.protocolObserved, s.protocolCompleted, s.protocolFailed = false, false, false
	s.retryAfterMS, s.retryAfterValid, s.ttft = 0, true, 0
	s.ttftObserved = false
	s.started = s.client.now()
	return nil
}

// Invoke counts actual Do calls, not local helper/setup failures.
func (s *State) Invoke() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.current(); err != nil {
		return err
	}
	if !s.active || s.invoked {
		return ErrBudget
	}
	s.attempts++
	s.invoked = true
	s.started = s.client.now()
	return nil
}

func ObserveTransport(c *gin.Context, response *http.Response, err error) {
	if s := StateFor(c); s != nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.unknown = err != nil || response == nil
		if response != nil {
			s.rawStatus = response.StatusCode
			if response.StatusCode == 429 || response.StatusCode >= 500 {
				delay, parseErr := ParseRetryAfter(response.Header, s.client.now())
				s.retryAfterMS, s.retryAfterValid = delay, parseErr == nil
			}
		}
	}
}

// ObserveUpstreamProtocol identifies the raw protocol before any conversion.
func ObserveUpstreamProtocol(c *gin.Context, protocol Protocol) {
	if s := StateFor(c); s != nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.upstreamProtocol, s.protocolObserved = protocol, true
	}
}

func ObserveProtocolOutcome(c *gin.Context, completed, failed bool) {
	if s := StateFor(c); s != nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.protocolCompleted = s.protocolCompleted || completed
		s.protocolFailed = s.protocolFailed || failed
	}
}

// ObserveResponsesOutcome retains only original terminal/status facts.
func ObserveResponsesOutcome(c *gin.Context, stream bool, eventType string, rawStatus []byte) {
	if StateFor(c) == nil {
		return
	}
	var status string
	_ = common.Unmarshal(rawStatus, &status)
	terminal := !stream || eventType == "response.completed" || eventType == "response.done"
	failed := terminal && status != "completed"
	switch status {
	case "failed", "incomplete", "cancelled", "canceled":
		failed = true
	}
	switch eventType {
	case "error", "response.error", "response.failed", "response.incomplete", "response.cancelled", "response.canceled":
		failed = true
	}
	ObserveProtocolOutcome(c, terminal && status == "completed", failed)
}

func (s *State) ProtocolOutcome() (required, completed bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.upstreamProtocol == ProtocolResponses || s.protocolObserved,
		s.protocolCompleted && !s.protocolFailed
}

func ParseRetryAfter(headers http.Header, now time.Time) (int64, error) {
	var delay int64
	var present bool
	// Millisecond precision takes precedence only when both fields agree.
	for _, name := range []string{"Retry-After", "Retry-After-Ms"} {
		values := headers.Values(name)
		if len(values) == 0 {
			continue
		}
		if len(values) != 1 || values[0] == "" {
			return 0, ErrRetryAfter
		}
		raw := values[0]
		var value int64
		if strings.IndexFunc(raw, func(r rune) bool { return r < '0' || r > '9' }) == -1 {
			number, err := strconv.ParseInt(raw, 10, 64)
			bound, multiplier := MaximumRetryAfterMS, int64(1)
			if name == "Retry-After" {
				bound, multiplier = MaximumRetryAfterMS/1000, 1000
			}
			if err != nil || number > bound {
				return 0, ErrRetryAfter
			}
			value = number * multiplier
		} else {
			if name != "Retry-After" {
				return 0, ErrRetryAfter
			}
			date, err := http.ParseTime(raw)
			delta := date.Sub(now)
			if err != nil || delta < 0 || delta > 24*time.Hour {
				return 0, ErrRetryAfter
			}
			value = delta.Milliseconds()
		}
		if present && value != delay {
			return 0, ErrRetryAfter
		}
		delay, present = value, true
	}
	return delay, nil
}

func (s *State) WaitRetry(ctx context.Context, sleep func(context.Context, time.Duration) error) (waitErr error) {
	defer func() {
		if waitErr != nil {
			s.mu.Lock()
			s.retry = false
			s.mu.Unlock()
		}
	}()
	s.mu.Lock()
	_, err := s.current()
	remaining := time.UnixMilli(s.route.ExpiresAt).Sub(s.client.now())
	delay := time.Duration(s.retryAfterMS) * time.Millisecond
	s.mu.Unlock()
	if err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if delay >= remaining {
		return ErrExpired
	}
	bounded, cancel := context.WithTimeout(ctx, remaining)
	defer cancel()
	if sleep == nil {
		sleep = func(ctx context.Context, delay time.Duration) error {
			timer := time.NewTimer(delay)
			defer timer.Stop()
			select {
			case <-timer.C:
				return ctx.Err()
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
	if delay > 0 {
		if err := sleep(bounded, delay); err != nil {
			return err
		}
	}
	if err := bounded.Err(); err != nil {
		return err
	}
	_, err = s.Current()
	return err
}

// Finish freezes an event before its single POST. Reporting cannot rerun Do.
func (s *State) Finish(ctx context.Context, completed, committed bool) bool {
	s.mu.Lock()
	if !s.active || !s.invoked {
		s.active = false
		s.mu.Unlock()
		return false
	}
	outcome := OutcomeWriteUnknown
	switch {
	case completed && !s.unknown && !s.downstreamFailed && ctx.Err() == nil && s.rawStatus >= 200 && s.rawStatus < 300:
		outcome = OutcomeSuccess
	case committed || s.committed || s.downstreamFailed:
		outcome = OutcomeResponseCommitted
	case s.unknown:
		outcome = OutcomeWriteUnknown
	case s.rawStatus == 401:
		outcome = OutcomeAuth401
	case s.rawStatus >= 400 && s.rawStatus < 500 && s.rawStatus != 429:
		outcome = OutcomeClient4xx
	case s.rawStatus == 429 && s.retryAfterValid:
		outcome = OutcomeRateLimited429
	case s.rawStatus == 429:
		outcome = OutcomeClient4xx
	case s.rawStatus >= 500 && s.rawStatus <= 599:
		outcome = OutcomeUpstream5xx
	}
	s.event = AttemptOutcome{Kind: "attempt_outcome", SchemaVersion: 1,
		EventID:   s.request.RequestID + "-attempt-" + strconv.Itoa(s.attempts),
		RequestID: s.request.RequestID, BindingID: s.route.Bindings[s.attempts-1].BindingID,
		Protocol: s.request.Protocol, Outcome: outcome,
		LatencyMS:    max(0, s.client.now().Sub(s.started).Milliseconds()),
		TTFTMS:       max(0, s.ttft.Milliseconds()),
		RetryAfterMS: s.retryAfterMS}
	event := s.event
	s.active = false
	s.mu.Unlock()
	ack := s.client.ReportOutcome(ctx, event) == nil
	s.mu.Lock()
	defer s.mu.Unlock()
	s.retry = ack && (outcome == OutcomeRateLimited429 || outcome == OutcomeUpstream5xx) &&
		s.retryAfterValid && s.attempts < s.limit && s.client.now().UnixMilli() < s.route.ExpiresAt
	return s.retry
}

// The wrapper retains Gin's interfaces and ResponseController's unwrap chain.
type observedWriter struct {
	gin.ResponseWriter
	state *State
	mu    sync.Mutex
}

func (w *observedWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *observedWriter) observe(n, requested int, err error) {
	w.state.mu.Lock()
	defer w.state.mu.Unlock()
	w.state.committed = w.state.committed || w.ResponseWriter.Written()
	w.state.downstreamFailed = w.state.downstreamFailed || err != nil || n != requested
	if n > 0 && !w.state.ttftObserved && !w.state.started.IsZero() {
		w.state.ttft = max(0, w.state.client.now().Sub(w.state.started))
		w.state.ttftObserved = true
	}
}

func (w *observedWriter) Write(body []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	n, err := w.ResponseWriter.Write(body)
	w.observe(n, len(body), err)
	return n, err
}

func (w *observedWriter) WriteString(body string) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	n, err := w.ResponseWriter.WriteString(body)
	w.observe(n, len(body), err)
	return n, err
}

func (w *observedWriter) WriteHeader(status int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.ResponseWriter.WriteHeader(status)
}

func (w *observedWriter) WriteHeaderNow() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.ResponseWriter.WriteHeaderNow()
	w.observe(0, 0, nil)
}

func (w *observedWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.ResponseWriter.Flush()
	w.observe(0, 0, nil)
}

func (w *observedWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	conn, buffer, err := w.ResponseWriter.Hijack()
	w.observe(0, 0, err)
	return conn, buffer, err
}

func (w *observedWriter) Written() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.ResponseWriter.Written()
}

func (w *observedWriter) Status() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.ResponseWriter.Status()
}

func (w *observedWriter) Size() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.ResponseWriter.Size()
}
