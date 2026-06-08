package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func Playground(c *gin.Context) {
	handlePlaygroundRelay(c, types.RelayFormatOpenAI)
}

func PlaygroundImageGeneration(c *gin.Context) {
	handlePlaygroundRelay(c, types.RelayFormatOpenAIImage)
}

func handlePlaygroundRelay(c *gin.Context, relayFormat types.RelayFormat) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	if err := stripPlaygroundInternalFields(c); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	Relay(c, relayFormat)
}

func stripPlaygroundInternalFields(c *gin.Context) error {
	if !strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		return nil
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return err
	}

	var payload map[string]json.RawMessage
	if err := common.Unmarshal(requestBody, &payload); err != nil {
		return err
	}
	if _, exists := payload["group"]; !exists {
		if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
			return seekErr
		}
		c.Request.Body = io.NopCloser(storage)
		return nil
	}

	delete(payload, "group")
	sanitizedBody, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	sanitizedStorage, err := common.CreateBodyStorage(sanitizedBody)
	if err != nil {
		return err
	}
	if _, err := sanitizedStorage.Seek(0, io.SeekStart); err != nil {
		_ = sanitizedStorage.Close()
		return err
	}

	_ = storage.Close()
	c.Set(common.KeyBodyStorage, sanitizedStorage)
	c.Request.Body = io.NopCloser(sanitizedStorage)
	c.Request.ContentLength = int64(len(sanitizedBody))
	return nil
}
