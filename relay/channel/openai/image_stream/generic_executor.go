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
	RelayInfo        *relaycommon.RelayInfo
	ImageRequest     *dto.ImageRequest
	PassThroughBody  []byte
	UpstreamResponse *GenericImageUpstreamResponse
	Checkpoint       func(*GenericImageUpstreamResponse) error
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
