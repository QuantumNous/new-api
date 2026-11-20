package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const taskSubmissionKeyReserved = "task_submission_key_reserved"

// prepareTaskSubmissionKey guards the native asynchronous video operation.
// Inline image and streaming responses have different replay contracts.
func prepareTaskSubmissionKey(c *gin.Context, info *relaycommon.RelayInfo) bool {
	key := c.GetHeader("Idempotency-Key")
	if !constant.TaskSubmissionIdempotencyEnabled || key == "" {
		return false
	}
	value, _ := c.Get(pluginruntime.ContextKeyPinnedRoute)
	pinned, ok := value.(pluginruntime.PinnedRoute)
	if !ok || pinned.Plugin == nil || pinned.Plugin.Meta.Key != "doubao" ||
		pinned.Route.Path != "/api/v3/contents/generations/tasks" || pinned.Route.Type != pluginruntime.RouteTypeSubmit {
		return false
	}
	if len(key) > 255 || strings.ContainsFunc(key, func(r rune) bool { return r < '!' || r > '~' }) {
		writeTaskKeyError(c, http.StatusBadRequest, "invalid_idempotency_key", "invalid Idempotency-Key")
		return true
	}
	body, err := common.GetBodyStorage(c)
	if err != nil {
		status := http.StatusBadRequest
		if common.IsRequestBodyTooLargeError(err) {
			status = http.StatusRequestEntityTooLarge
		}
		writeTaskKeyError(c, status, "read_request_body_failed", "Could not read the request body")
		return true
	}
	hash := sha256.New()
	fmt.Fprintf(hash, "%q\n%q\n", c.GetHeader("Content-Type"), c.Request.URL.RawQuery)
	if _, err = io.Copy(hash, body); err != nil {
		writeTaskKeyError(c, http.StatusBadRequest, "read_request_body_failed", "Could not read the request body")
		return true
	}
	scope := sha256.Sum256([]byte(fmt.Sprintf("%d\n%s\n%s\n%s", info.UserId, pinned.Plugin.Meta.Key, pinned.Route.Path, key)))
	candidate := model.TaskSubmissionKey{
		Fingerprint: hex.EncodeToString(scope[:]),
		RequestHash: hex.EncodeToString(hash.Sum(nil)),
		TaskID:      model.GenerateTaskID(),
	}
	saved, ownsKey, err := model.ReserveTaskSubmissionKey(c.Request.Context(), candidate)
	if err == nil && ownsKey {
		info.PublicTaskID = saved.TaskID
		c.Set(taskSubmissionKeyReserved, true)
		return false
	}
	if err == nil && saved.RequestHash != candidate.RequestHash {
		writeTaskKeyError(c, http.StatusConflict, "idempotency_key_conflict", "Idempotency-Key already used for another request")
		return true
	}
	// A persisted task is the replay source of truth, including after a
	// settlement error or process exit before the original response.
	if err == nil {
		var task *model.Task
		var found bool
		task, found, err = model.GetByTaskId(info.UserId, saved.TaskID)
		if err == nil && found {
			presentTaskSubmission(c, &taskSubmissionOutcome{Task: task, RelayInfo: info})
			return true
		}
	}
	if err != nil {
		logger.LogError(c, common.LogText("read task submission key: %s", err.Error()))
		writeTaskKeyError(c, http.StatusServiceUnavailable, "idempotency_unavailable", "task submission key unavailable")
		return true
	}
	c.Header("Retry-After", "2")
	writeTaskKeyError(c, http.StatusConflict, "idempotency_pending", "original task submission has not been confirmed")
	return true
}

func writeTaskKeyError(c *gin.Context, status int, code string, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}
