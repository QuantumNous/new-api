package image_stream

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

// GenericImageExecutionRequest contains the provider-neutral state required by
// the relay package to execute a regular image adaptor in a background worker.
// PassThroughBody is optional; when present it is forwarded without conversion,
// matching the synchronous image relay behavior.
type GenericImageExecutionRequest struct {
	RelayInfo          *relaycommon.RelayInfo
	ImageRequest       *dto.ImageRequest
	PassThroughBody    []byte
	UpstreamResponse   *GenericImageUpstreamResponse
	Checkpoint         func(*GenericImageUpstreamResponse) error
	BeforeProviderCall func() error
	// BeforeResponseRead is called after a successful provider response arrives
	// and immediately before its potentially large body is materialized. Async
	// workers use it to acquire the output-memory lease without serializing the
	// upstream generation wait itself.
	BeforeResponseRead func() error
	// AfterResponseCheckpoint runs after the provider response is durably
	// checkpointed and before provider-specific response handling or polling.
	// The byte count lets workers release a lease held only for a small task-ID
	// checkpoint while retaining it for a large immediate image response.
	AfterResponseCheckpoint func(int)
	// BeforeResultWrite runs before the adaptor writes its normalized final image
	// response. Polling adaptors therefore reacquire the output lease only after
	// their upstream generation wait completes.
	BeforeResultWrite func() error
}

// GenericImageUpstreamResponse is the provider response captured before an
// adaptor starts any provider-specific polling. Persisting it lets a restarted
// worker resume from the accepted provider task instead of submitting again.
type GenericImageUpstreamResponse struct {
	StatusCode int                 `json:"status_code"`
	Header     map[string][]string `json:"header,omitempty"`
	Body       json.RawMessage     `json:"body"`
}

var ErrGenericImageCheckpoint = errors.New("persist generic image provider response")

// ErrGenericImageDefinitiveResponse marks an explicit non-success HTTP response.
// The provider rejected the request, so the worker may safely clear its pre-call
// fence and apply the normal status-based retry policy.
var ErrGenericImageDefinitiveResponse = errors.New("provider returned a definitive image response")

// GenericImageExecutionResult is the normalized output of a regular image
// adaptor before durable materialization and object-storage delivery.
type GenericImageExecutionResult struct {
	Response    *dto.ImageResponse
	Usage       *dto.Usage
	OtherRatios map[string]float64
}

type GenericImageExecutor func(context.Context, *GenericImageExecutionRequest) (*GenericImageExecutionResult, *types.NewAPIError)

var genericImageExecutorRegistry struct {
	sync.RWMutex
	executor GenericImageExecutor
}

// RegisterGenericImageExecutor installs the relay-layer implementation without
// making this provider package import the top-level relay adaptor registry.
func RegisterGenericImageExecutor(executor GenericImageExecutor) {
	if executor == nil {
		panic("generic image executor is nil")
	}
	genericImageExecutorRegistry.Lock()
	defer genericImageExecutorRegistry.Unlock()
	if genericImageExecutorRegistry.executor != nil {
		panic("generic image executor is already registered")
	}
	genericImageExecutorRegistry.executor = executor
}

func ExecuteGenericImageAdaptor(ctx context.Context, request *GenericImageExecutionRequest) (*GenericImageExecutionResult, *types.NewAPIError) {
	genericImageExecutorRegistry.RLock()
	executor := genericImageExecutorRegistry.executor
	genericImageExecutorRegistry.RUnlock()
	if executor == nil {
		return nil, types.NewError(errors.New("generic image executor is not registered"), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	return executor(ctx, request)
}
