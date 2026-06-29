package service

import (
	"strings"

	"github.com/QuantumNous/new-api/types"
)

// UpstreamChargeConfidence 表示上游是否可能已对本次请求计费。
type UpstreamChargeConfidence int

const (
	// UpstreamChargeConfirmedNot 可确认上游未产生有效计费（可退预扣费）。
	UpstreamChargeConfirmedNot UpstreamChargeConfidence = iota
	// UpstreamChargeAmbiguous 上游可能已计费或状态未知（暂不退预扣费）。
	UpstreamChargeAmbiguous
)

// ClassifyUpstreamChargeConfidence 根据 relay 错误判断预扣费是否可安全退还。
// 原则：仅在上游确认未扣费时 Refund；超时/网关类错误保持预扣，等待对账或后续结算。
func ClassifyUpstreamChargeConfidence(err *types.NewAPIError) UpstreamChargeConfidence {
	if err == nil {
		return UpstreamChargeAmbiguous
	}

	if types.IsImageGenerationTimeoutError(err) {
		return UpstreamChargeAmbiguous
	}

	code := err.GetErrorCode()
	status := err.StatusCode
	lower := strings.ToLower(err.Error())

	switch code {
	case types.ErrorCodeGetChannelFailed,
		types.ErrorCodeInvalidRequest,
		types.ErrorCodeSensitiveWordsDetected,
		types.ErrorCodeModelPriceError,
		types.ErrorCodeInvalidApiType,
		types.ErrorCodeJsonMarshalFailed,
		types.ErrorCodeConvertRequestFailed,
		types.ErrorCodeReadRequestBodyFailed,
		types.ErrorCodeBadRequestBody,
		types.ErrorCodeAccessDenied,
		types.ErrorCodeChannelModelMappedError,
		types.ErrorCodeChannelParamOverrideInvalid,
		types.ErrorCodeChannelHeaderOverrideInvalid,
		types.ErrorCodeModelNotFound,
		types.ErrorCodePromptBlocked,
		types.ErrorCodeContextTooLarge,
		types.ErrorCodeContextLengthExceeded:
		return UpstreamChargeConfirmedNot
	}

	if code == "moderation_blocked" || code == types.ErrorCodePromptBlocked {
		return UpstreamChargeConfirmedNot
	}

	if status == 400 || status == 401 || status == 403 || status == 404 || status == 422 {
		return UpstreamChargeConfirmedNot
	}

	if status == 429 {
		return UpstreamChargeConfirmedNot
	}

	if status == 502 || status == 503 || status == 504 || status == 524 || status == 408 {
		return UpstreamChargeAmbiguous
	}

	if code == types.ErrorCodeDoRequestFailed ||
		code == types.ErrorCodeReadResponseBodyFailed ||
		code == types.ErrorCodeChannelResponseTimeExceeded {
		return UpstreamChargeAmbiguous
	}

	if code == types.ErrorCodeBadResponseStatusCode {
		if status >= 500 {
			return UpstreamChargeAmbiguous
		}
		if status == 400 || status == 401 || status == 403 || status == 404 || status == 422 || status == 429 {
			return UpstreamChargeConfirmedNot
		}
	}

	for _, marker := range upstreamNotChargedMarkers {
		if strings.Contains(lower, marker) {
			return UpstreamChargeConfirmedNot
		}
	}

	for _, marker := range upstreamAmbiguousMarkers {
		if strings.Contains(lower, marker) {
			return UpstreamChargeAmbiguous
		}
	}

	if status >= 500 {
		return UpstreamChargeAmbiguous
	}

	if status >= 400 && status < 500 {
		return UpstreamChargeConfirmedNot
	}

	return UpstreamChargeAmbiguous
}

var upstreamNotChargedMarkers = []string{
	"token limit",
	"exceeded model token limit",
	"invalid request",
	"context length",
	"maximum context",
	"context too large",
	"prompt is too long",
	"request exceeded",
	"moderation_blocked",
	"safety system",
	"image_generation_user_error",
	"safety_violations",
}

var upstreamAmbiguousMarkers = []string{
	"timeout",
	"timed out",
	"bad gateway",
	"connection reset",
	"connection refused",
	"upstream",
	"empty response",
}
