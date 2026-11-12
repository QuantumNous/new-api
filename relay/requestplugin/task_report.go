package requestplugin

import (
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// Limits of a task report, part of the published plugin contract
// (docs/plugin-api/v1.md).
const (
	// maxTaskRequestBytes is the largest request a task keeps for its report.
	maxTaskRequestBytes = 64 << 10
	// maxTaskDataBytes is the largest task result the report reads.
	maxTaskDataBytes = 8 << 20
	maxTaskURLs      = 32
	maxTaskTexts     = 256
	// maxTaskTextBytes bounds the result texts, as the response capture is
	// bounded.
	maxTaskTextBytes = maxReportResponseBytes
)

type reportTask struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
	// FinishedAt is in Unix milliseconds.
	FinishedAt int64            `json:"finishedAt"`
	Result     reportTaskResult `json:"result"`
}

type reportTaskResult struct {
	URLs      []string         `json:"urls"`
	Texts     []reportTaskText `json:"texts"`
	Truncated bool             `json:"truncated"`
}

type reportTaskText struct {
	Path string `json:"path"`
	Text string `json:"text"`
}

// TaskReport is what a task submission keeps for the report at the task's
// final state: the report instances in scope, the request as the record
// shows it and the submission's record. It is nil when no instance may
// report the task. Call it once the submission was accepted, before the task
// is stored.
func TaskReport(c *gin.Context, info *relaycommon.RelayInfo) *model.TaskRequestPlugins {
	plan := planOf(c)
	if plan == nil || !plan.reports || plan.submission == nil || info == nil {
		return nil
	}
	call := attemptCall(c, info)
	var ids []string
	for _, instance := range plan.scope(jsplugin.ReportHook, call.Group, call.Model, call.Bound) {
		if plan.plugins[instance.Plugin] != nil {
			ids = append(ids, instance.ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	started := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if started.IsZero() {
		started = time.Now()
	}
	stored := &model.TaskRequestPlugins{
		Instances: ids,
		Format:    call.Format,
		Attempt:   call.Attempt,
		Username:  call.User.Username,
		StartedAt: started.UnixMilli(),
		Record:    relaycommon.CapRequestPluginRecord(slices.Clone(info.RequestPluginRecord)),
	}
	if call.Channel != nil {
		stored.ChannelType = call.Channel.Type
	}
	if call.Token != nil {
		stored.TokenName = call.Token.Name
	}
	if !jsonRequest(c) {
		return stored
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return stored
	}
	body, err := storage.Bytes()
	if err != nil || !gjson.ValidBytes(body) {
		return stored
	}
	view, media := scanMedia(body)
	if len(view) > maxTaskRequestBytes {
		return stored
	}
	stored.Request = slices.Clone(view)
	for index, item := range media {
		stored.Media = append(stored.Media, jsplugin.TransformMedia{Index: index, Path: item.path, MimeType: item.mime, Bytes: item.size()})
	}
	return stored
}

// TaskCreated marks a submission whose task is stored: the task reports at
// its final state, so the submission does not report.
func TaskCreated(c *gin.Context) {
	if plan := planOf(c); plan != nil && plan.submission != nil {
		plan.submission.stored = true
	}
}

// ReportTask hands a task that reached its final state to the report hooks
// of the instances that matched its submission and are still enabled. It
// reads only the task, so it runs on whichever node finished the task;
// call it once per task, after settlement and refund.
func ReportTask(task *model.Task) {
	stored := task.PrivateData.RequestPlugins
	if stored == nil {
		return
	}
	var targets []reportTarget
	instances := request_plugin_setting.GetInstances()
	for _, id := range stored.Instances {
		index := slices.IndexFunc(instances, func(instance request_plugin_setting.Instance) bool { return instance.ID == id })
		if index < 0 || !instances[index].Enabled {
			continue
		}
		plugin, _ := jsplugin.DefaultRegistry.GetIgnoringMasterSwitch(instances[index].Plugin)
		if plugin == nil || !plugin.Meta.HasTransformPart() || !slices.Contains(plugin.TransformHooks(), jsplugin.ReportHook) {
			continue
		}
		targets = append(targets, reportTarget{plugin: plugin, instance: &instances[index]})
	}
	if len(targets) == 0 {
		return
	}
	data := task.Data
	if len(data) > maxTaskDataBytes {
		data = nil
	}
	size := int64(len(stored.Request) + len(data))
	if !reports.admit(size) {
		return
	}
	call := jsplugin.TransformContext{
		Format:        stored.Format,
		Model:         task.Properties.OriginModelName,
		UpstreamModel: task.Properties.UpstreamModelName,
		Group:         task.Group,
		Attempt:       stored.Attempt,
		User:          jsplugin.TransformUser{ID: task.UserId, Username: stored.Username},
	}
	var requestID string
	if execution := task.PrivateData.Execution; execution != nil {
		requestID, call.Path = execution.RequestID, execution.RequestPath
	}
	if task.ChannelId > 0 {
		call.Channel = &jsplugin.TransformChannel{ID: task.ChannelId, Type: stored.ChannelType}
	}
	token := reportToken{ID: task.PrivateData.TokenId, Name: stored.TokenName}
	if token.ID > 0 {
		call.Token = &jsplugin.TransformToken{ID: token.ID, Name: token.Name}
	}
	job := &reportJob{
		targets:  targets,
		tctx:     call,
		size:     size,
		taskData: data,
		record: reportRecord{
			RequestID:      requestID,
			User:           reportUser{ID: task.UserId, Username: stored.Username},
			Token:          token,
			StartedAt:      stored.StartedAt,
			DurationMs:     time.Now().UnixMilli() - stored.StartedAt,
			Request:        reportRequest{Body: stored.Request, Media: stored.Media},
			Task:           &reportTask{ID: task.TaskID, Status: string(task.Status), FinishedAt: task.FinishTime * 1000},
			Cost:           reportCost{Quota: task.Quota, USD: float64(task.Quota) / common.QuotaPerUnit},
			RequestPlugins: stored.Record,
		},
	}
	if task.Status == model.TaskStatusFailure {
		job.record.Task.Reason = task.FailReason
	}
	if url := task.PrivateData.ResultURL; isHTTPURL(url) {
		job.taskURL = url
	}
	reports.push(job)
}

// taskResult reads the result of a task for its report: the http and https
// URLs, then the other strings as texts with their dotted paths. Data URLs
// and base64 data are left out. Past a bound the rest is left out and
// Truncated is set.
func taskResult(data []byte, resultURL string) reportTaskResult {
	result := reportTaskResult{URLs: []string{}, Texts: []reportTaskText{}}
	if resultURL != "" {
		result.URLs = append(result.URLs, resultURL)
	}
	if len(data) == 0 || !gjson.ValidBytes(data) {
		return result
	}
	textBytes := 0
	var walk func(value gjson.Result, path string) bool
	walk = func(value gjson.Result, path string) bool {
		switch {
		case value.IsObject() || value.IsArray():
			index := 0
			value.ForEach(func(key, member gjson.Result) bool {
				name := key.String()
				if value.IsArray() {
					name = strconv.Itoa(index)
				}
				index++
				if path != "" {
					name = path + "." + name
				}
				return walk(member, name)
			})
			return !result.Truncated
		case value.Type != gjson.String || value.Str == "" || strings.HasPrefix(value.Str, "data:") || base64Data(value.Str):
			return true
		case isHTTPURL(value.Str):
			if slices.Contains(result.URLs, value.Str) {
				return true
			}
			if len(result.URLs) == maxTaskURLs {
				result.Truncated = true
				return false
			}
			result.URLs = append(result.URLs, value.Str)
		default:
			if len(result.Texts) == maxTaskTexts {
				result.Truncated = true
				return false
			}
			text := value.Str
			if room := maxTaskTextBytes - textBytes; len(text) > room {
				// The last text is cut at a character.
				text = strings.ToValidUTF8(text[:room], "")
				result.Truncated = true
			}
			textBytes += len(text)
			result.Texts = append(result.Texts, reportTaskText{Path: path, Text: text})
			return !result.Truncated
		}
		return true
	}
	walk(gjson.ParseBytes(data), "")
	return result
}

func isHTTPURL(text string) bool {
	return strings.HasPrefix(text, "https://") || strings.HasPrefix(text, "http://")
}

// base64Data reports a long string of base64 characters only: encoded
// media, not text.
func base64Data(text string) bool {
	if len(text) < 1024 {
		return false
	}
	return !strings.ContainsFunc(text, func(r rune) bool {
		return !(r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '+' || r == '/' || r == '=' || r == '-' || r == '_')
	})
}
