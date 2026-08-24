package service

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type tokenSpaceVisualValidationResultRequest struct {
	BytedToken string `json:"BytedToken"`
}

func (p tokenSpaceRealPersonProvider) CreateVisualValidateSession(ctx context.Context, _ string) (BytePlusVisualValidationSession, error) {
	payload, err := common.Marshal(struct{}{})
	if err != nil {
		return BytePlusVisualValidationSession{}, tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "CreateVisualValidateSession", payload)
	if err != nil {
		return BytePlusVisualValidationSession{}, err
	}
	bytedToken := strings.TrimSpace(response.Result.BytedToken)
	h5Link := strings.TrimSpace(response.Result.H5Link)
	if bytedToken == "" || h5Link == "" {
		return BytePlusVisualValidationSession{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace verification result missing"))
	}
	return BytePlusVisualValidationSession{
		BytedToken: bytedToken,
		H5Link:     h5Link,
		RequestID:  tokenSpaceMaterialRequestID(response),
	}, nil
}

func (p tokenSpaceRealPersonProvider) GetVisualValidateResult(ctx context.Context, bytedToken string) (BytePlusVisualValidationResult, error) {
	bytedToken = strings.TrimSpace(bytedToken)
	if bytedToken == "" {
		return BytePlusVisualValidationResult{}, tokenSpaceMaterialProtocolFailure(0, errors.New("tokenspace verification token missing"))
	}
	payload, err := common.Marshal(tokenSpaceVisualValidationResultRequest{BytedToken: bytedToken})
	if err != nil {
		return BytePlusVisualValidationResult{}, tokenSpaceMaterialProtocolFailure(0, err)
	}
	response, err := tokenSpaceMaterialDo(ctx, p.channel, p.apiKey, "", p.gatewayOrigin, "GetVisualValidateResult", payload)
	if err != nil {
		return BytePlusVisualValidationResult{}, err
	}
	groupID := strings.TrimSpace(response.Result.GroupID)
	if groupID == "" {
		return BytePlusVisualValidationResult{}, tokenSpaceMaterialProtocolFailure(http.StatusOK, errors.New("tokenspace verification group missing"))
	}
	return BytePlusVisualValidationResult{
		GroupID:   groupID,
		RequestID: tokenSpaceMaterialRequestID(response),
	}, nil
}
