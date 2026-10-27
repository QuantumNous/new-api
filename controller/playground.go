/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// The playground runs on the user's browser session, never on an API key. Every
// playground relay therefore swaps TokenAuth for a temporary token scoped to the
// session user and the channel group the request itself resolves to. The token
// is never persisted: it only carries the user id and group into billing and
// channel selection for the lifetime of this request.

func playgroundBootstrap(c *gin.Context, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}

func writePlaygroundError(c *gin.Context, newAPIError *types.NewAPIError) {
	c.JSON(newAPIError.StatusCode, gin.H{
		"error": newAPIError.ToOpenAIError(common.UpstreamAddresses(c)...),
	})
}

// PlaygroundSessionAuth is playgroundBootstrap as a middleware, so relays that
// have to run channel selection before their handler (image and video
// generation, whose plugin ownership is resolved ahead of distribution) see the
// same temporary token an API key would have produced.
func PlaygroundSessionAuth(format types.RelayFormat) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetBool("use_access_token") {
			writePlaygroundError(c, types.NewError(
				errors.New(i18n.T(c, i18n.MsgRelayAccessTokenUnsupported)),
				types.ErrorCodeAccessDenied,
				types.ErrOptionWithSkipRetry(),
			))
			c.Abort()
			return
		}

		relayInfo, err := relaycommon.GenRelayInfo(c, format, nil, nil)
		if err != nil || relayInfo == nil {
			// A retrieve request carries no body, so the group it would have
			// resolved from is unavailable; fall back to the caller's group.
			group := c.Query("group")
			if group == "" {
				if userCache, cacheErr := model.GetUserCache(c.GetInt("id")); cacheErr == nil {
					group = userCache.Group
				}
			}
			relayInfo = &relaycommon.RelayInfo{UsingGroup: group}
		}

		if newAPIError := playgroundBootstrap(c, relayInfo); newAPIError != nil {
			writePlaygroundError(c, newAPIError)
			c.Abort()
			return
		}
		c.Next()
	}
}

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			writePlaygroundError(c, newAPIError)
		}
	}()

	if c.GetBool("use_access_token") {
		newAPIError = types.NewError(errors.New(i18n.T(c, i18n.MsgRelayAccessTokenUnsupported)), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	if newAPIError = playgroundBootstrap(c, relayInfo); newAPIError != nil {
		return
	}

	Relay(c, types.RelayFormatOpenAI)
}

// PlaygroundImage relays an image generation request. The route that mounts it
// has already resolved the temporary token through PlaygroundSessionAuth.
func PlaygroundImage(c *gin.Context) {
	RelayTaskPluginEndpoint(c, func(c *gin.Context) {
		Relay(c, types.RelayFormatOpenAIImage)
	})
}

// PlaygroundTask submits a video generation task for the session user.
func PlaygroundTask(c *gin.Context) {
	RelayTask(c)
}

// PlaygroundTaskFetch reports the state of a video task the session user owns.
func PlaygroundTaskFetch(c *gin.Context) {
	if taskID := c.Param("task_id"); taskID != "" {
		c.Request.URL.Path = "/v1/video/generations/" + taskID
	}
	RelayTaskFetch(c)
}
