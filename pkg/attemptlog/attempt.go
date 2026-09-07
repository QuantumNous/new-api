package attemptlog

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

// RequestFeatures describes the client request. It is computed once per request
// and shared by every attempt, since retrying does not change what the user
// asked for.
type RequestFeatures struct {
	RequestId      string
	TenantId       int
	TokenId        int
	RelayFormat    string
	RequestPath    string
	ModelName      string
	InputTokensEst int
	Chars          CharCounts
	MaxTokensReq   *int
	IsStream       bool
	HasTools       bool
	ToolsCount     int
	Temperature    *float64

	// PR2: prefix hashes (byte-exact) and task type guess.
	PrefixHashSystem string
	PrefixHashTools  string
	PrefixHashPrefix string
	TaskTypeGuess    string
	TaskTypeGuessVer int
}

// RequestScope is the per-request handle returned by BeginRequest.
type RequestScope struct {
	features RequestFeatures
	active   bool
}

// ChannelTarget identifies the channel an attempt is dispatched to.
type ChannelTarget struct {
	ChannelId         int
	ChannelType       int
	UpstreamModelName string
	UsingGroup        string
}

// Pricing carries the billing ratios in effect for this attempt.
type Pricing struct {
	ModelRatio      float64
	CompletionRatio float64
	GroupRatio      float64
	CacheRatio      float64
	ModelPrice      float64
	UsePrice        bool
}

// Attempt is a single in-flight attempt against one channel.
type Attempt struct {
	mu sync.Mutex

	features RequestFeatures
	target   ChannelTarget

	attemptId    string
	attemptIndex int
	startTime    time.Time

	pricing *Pricing

	// annotated by NoteUpstream, from the upstream request layer
	upstreamStart  time.Time
	upstreamKnown  bool
	httpStatus     int
	retryAfterHint *int

	// annotated by NoteChunk, from the stream reading layer. Holding these per
	// attempt rather than on RelayInfo is what keeps a retry from inheriting
	// the previous attempt's first-token time: RelayInfo lives for the whole
	// request, this object does not.
	firstChunkTime   time.Time
	firstContentTime time.Time
	sawUnknownChunk  bool

	// annotated by NoteUsage, from the billing layer
	usageKnown      bool
	inputTokens     int
	outputTokens    int
	cachedTokens    int
	reasoningTokens int
	costActual      int

	finished bool
}

// BeginRequest opens a telemetry scope for one client request. The returned
// scope is inert when telemetry is disabled or when this request was not
// sampled, so callers do not need to branch.
func BeginRequest(features RequestFeatures) *RequestScope {
	if !Enabled() || !sampled() {
		return &RequestScope{}
	}
	return &RequestScope{features: features, active: true}
}

// BeginAttempt starts an attempt against a channel. The returned Attempt is
// stored on the gin context so the upstream request layer and the billing
// layer can annotate it. Finish must be called exactly once for every non-nil
// return.
func (s *RequestScope) BeginAttempt(c *gin.Context, attemptIndex int, target ChannelTarget, pricing *Pricing) *Attempt {
	if s == nil || !s.active {
		return nil
	}

	attempt := &Attempt{
		features:     s.features,
		target:       target,
		attemptId:    common.GetUUID(),
		attemptIndex: attemptIndex,
		startTime:    time.Now(),
		pricing:      pricing,
	}

	if c != nil {
		common.SetContextKey(c, constant.ContextKeyRelayAttempt, attempt)
	}
	return attempt
}

// AttemptId exposes the attempt's identifier for correlation in other logs.
func (a *Attempt) AttemptId() string {
	if a == nil {
		return ""
	}
	return a.attemptId
}

func fromContext(c *gin.Context) *Attempt {
	if c == nil {
		return nil
	}
	attempt, ok := common.GetContextKeyType[*Attempt](c, constant.ContextKeyRelayAttempt)
	if !ok {
		return nil
	}
	return attempt
}
