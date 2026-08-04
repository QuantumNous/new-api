// Package volcnative handles Fire Ark's native asynchronous content-generation
// API. It forwards the submitted JSON bytes unchanged, so provider-specific
// fields are not discarded by the OpenAI task conversion path.
package volcnative

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

var ModelList = []string{
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-t2v",
	"doubao-seedance-1-0-lite-i2v",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
}

type TaskAdaptor struct {
	doubao.TaskAdaptor
}

func (a *TaskAdaptor) GetChannelName() string { return "volc-native-task" }

func (a *TaskAdaptor) GetModelList() []string { return ModelList }

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	body, err := rawRequestBody(c)
	if err != nil {
		return taskError(err, "invalid_request", http.StatusBadRequest)
	}
	model := gjson.GetBytes(body, "model")
	if !model.Exists() || model.Type != gjson.String || strings.TrimSpace(model.String()) == "" {
		return taskError(fmt.Errorf("model is required"), "invalid_request", http.StatusBadRequest)
	}
	info.OriginModelName = model.String()
	info.Action = constant.TaskActionGenerate
	return nil
}

// BuildRequestBody guarantees opaque pass-through. Model mapping and parameter
// overrides are intentionally rejected: changing either would make an API
// advertised as native no longer preserve the caller's request semantics.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if info.IsModelMapped {
		return nil, fmt.Errorf("volc native channels do not support model mapping; use the upstream model id directly")
	}
	if len(info.ParamOverride) != 0 {
		return nil, fmt.Errorf("volc native channels do not support parameter overrides")
	}
	body, err := rawRequestBody(c)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(body), nil
}

// DoResponse replaces only the upstream task id with NewAPI's public id. The
// upstream id remains private in Task.PrivateData and is never returned to the
// caller; all remaining response fields are forwarded as received.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	if resp == nil {
		return "", nil, taskError(fmt.Errorf("upstream response is empty"), "invalid_response", http.StatusBadGateway)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, taskError(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	upstreamID := gjson.GetBytes(body, "id")
	if !upstreamID.Exists() || upstreamID.Type != gjson.String || upstreamID.String() == "" {
		return "", nil, taskError(fmt.Errorf("upstream task id is empty"), "invalid_response", http.StatusBadGateway)
	}
	clientBody, err := sjson.SetBytes(body, "id", info.PublicTaskID)
	if err != nil {
		return "", nil, taskError(err, "patch_response_failed", http.StatusInternalServerError)
	}
	c.Data(resp.StatusCode, responseContentType(resp), clientBody)
	return upstreamID.String(), body, nil
}

func rawRequestBody(c *gin.Context) ([]byte, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	body, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	if !gjson.ValidBytes(body) {
		return nil, fmt.Errorf("request body must be valid JSON")
	}
	return body, nil
}

func responseContentType(resp *http.Response) string {
	if value := resp.Header.Get("Content-Type"); value != "" {
		return value
	}
	return "application/json"
}

func taskError(err error, code string, statusCode int) *dto.TaskError {
	return &dto.TaskError{Error: err, Code: code, Message: err.Error(), StatusCode: statusCode, LocalError: true}
}
