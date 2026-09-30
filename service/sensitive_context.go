package service

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

const contextKeyDetectedSensitiveWords = "detected_sensitive_words"

// SetDetectedSensitiveWords stores words hit by the prompt filter for later logging/reply.
func SetDetectedSensitiveWords(c *gin.Context, words []string) {
	if c == nil || len(words) == 0 {
		return
	}
	c.Set(contextKeyDetectedSensitiveWords, words)
}

// GetDetectedSensitiveWords returns words previously stored by SetDetectedSensitiveWords.
func GetDetectedSensitiveWords(c *gin.Context) []string {
	if c == nil {
		return nil
	}
	value, ok := c.Get(contextKeyDetectedSensitiveWords)
	if !ok {
		return nil
	}
	words, ok := value.([]string)
	if !ok {
		return nil
	}
	return words
}

// RecordSensitiveBlockLog always persists a LogTypeError audit entry for sensitive-word blocks.
func RecordSensitiveBlockLog(c *gin.Context, info *relaycommon.RelayInfo, words []string, replySimulated bool) {
	if c == nil {
		return
	}
	userId := c.GetInt("id")
	tokenName := c.GetString("token_name")
	modelName := c.GetString("original_model")
	tokenId := c.GetInt("token_id")
	userGroup := c.GetString("group")
	if info != nil {
		if info.OriginModelName != "" {
			modelName = info.OriginModelName
		}
		if info.UserId != 0 {
			userId = info.UserId
		}
		if info.TokenId != 0 {
			tokenId = info.TokenId
		}
		if info.TokenGroup != "" {
			userGroup = info.TokenGroup
		}
	}

	content := "sensitive words detected"
	if len(words) > 0 {
		content = fmt.Sprintf("sensitive words detected: %s", strings.Join(words, ", "))
	}

	other := model.NewLogOther()
	other.SetPublic("error_type", string(types.ErrorTypeNewAPIError))
	other.SetPublic("error_code", string(types.ErrorCodeSensitiveWordsDetected))
	other.SetPublic("status_code", http.StatusOK)
	other.SetPublic("result", "sensitive_blocked")
	other.SetPublic("reply_simulated", replySimulated)
	if len(words) > 0 {
		other.SetPublic("sensitive_words", words)
	}
	if c.Request != nil && c.Request.URL != nil {
		other.SetPublic("request_path", c.Request.URL.Path)
	}
	if c.Request != nil && c.Request.Method != "" {
		other.SetPublic("request_method", c.Request.Method)
	}
	AppendRelayLogAdminInfo(c, info, other)
	AppendTaskPluginContextAuditInfo(c, other)

	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}
	useTimeSeconds := int(time.Since(startTime).Seconds())
	isStream := false
	if info != nil {
		isStream = info.IsStream
	} else {
		isStream = common.GetContextKeyBool(c, constant.ContextKeyIsStream)
	}

	model.RecordErrorLog(c, userId, 0, modelName, tokenName, content, tokenId, useTimeSeconds, isStream, userGroup, other)
}
