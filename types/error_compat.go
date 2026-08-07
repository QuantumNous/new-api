package types

import relaytypes "github.com/QuantumNous/new-api/relaykit/types"

// Chimera image-routing code historically imported the host types package for
// both routing configuration and relay errors. Upstream moved relay errors to
// relaykit/types; these aliases keep the local extension source-compatible
// while preserving a single runtime error type.
type NewAPIError = relaytypes.NewAPIError
type NewAPIErrorOptions = relaytypes.NewAPIErrorOptions
type ErrorCode = relaytypes.ErrorCode
type TokenCountMeta = relaytypes.TokenCountMeta

const (
	ErrorCodeBadResponse                 = relaytypes.ErrorCodeBadResponse
	ErrorCodeBadResponseBody             = relaytypes.ErrorCodeBadResponseBody
	ErrorCodeBadResponseStatusCode       = relaytypes.ErrorCodeBadResponseStatusCode
	ErrorCodeChannelModelMappedError     = relaytypes.ErrorCodeChannelModelMappedError
	ErrorCodeChannelParamOverrideInvalid = relaytypes.ErrorCodeChannelParamOverrideInvalid
	ErrorCodeChannelResponseTimeExceeded = relaytypes.ErrorCodeChannelResponseTimeExceeded
	ErrorCodeConvertRequestFailed        = relaytypes.ErrorCodeConvertRequestFailed
	ErrorCodeDoRequestFailed             = relaytypes.ErrorCodeDoRequestFailed
	ErrorCodeEmptyResponse               = relaytypes.ErrorCodeEmptyResponse
	ErrorCodeGenRelayInfoFailed          = relaytypes.ErrorCodeGenRelayInfoFailed
	ErrorCodeGetChannelFailed            = relaytypes.ErrorCodeGetChannelFailed
	ErrorCodeInsufficientUserQuota       = relaytypes.ErrorCodeInsufficientUserQuota
	ErrorCodeInvalidApiType              = relaytypes.ErrorCodeInvalidApiType
	ErrorCodeJsonMarshalFailed           = relaytypes.ErrorCodeJsonMarshalFailed
	ErrorCodeModelPriceError             = relaytypes.ErrorCodeModelPriceError
	ErrorCodeReadResponseBodyFailed      = relaytypes.ErrorCodeReadResponseBodyFailed
	ErrorCodeUpdateDataError             = relaytypes.ErrorCodeUpdateDataError
	ErrorCodeWriteResponseBodyFailed     = relaytypes.ErrorCodeWriteResponseBodyFailed
)

var (
	ClassifyImageRoutingUpstreamResponse = relaytypes.ClassifyImageRoutingUpstreamResponse
	ErrOptionWithNoRecordErrorLog        = relaytypes.ErrOptionWithNoRecordErrorLog
	ErrOptionWithRequestNotSent          = relaytypes.ErrOptionWithRequestNotSent
	ErrOptionWithSkipRetry               = relaytypes.ErrOptionWithSkipRetry
	ErrOptionWithStatusCode              = relaytypes.ErrOptionWithStatusCode
	ImageRoutingUpstreamStatusCode       = relaytypes.ImageRoutingUpstreamStatusCode
	IsImageRoutingErrorRetryable         = relaytypes.IsImageRoutingErrorRetryable
	IsImageRoutingUpstreamRejected       = relaytypes.IsImageRoutingUpstreamRejected
	IsRequestNotSentError                = relaytypes.IsRequestNotSentError
	IsSkipRetryError                     = relaytypes.IsSkipRetryError
	NewChannelError                      = relaytypes.NewChannelError
	NewError                             = relaytypes.NewError
	NewErrorWithStatusCode               = relaytypes.NewErrorWithStatusCode
	NewOpenAIError                       = relaytypes.NewOpenAIError
)
