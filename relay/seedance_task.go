package relay

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func SeedanceTaskFetch(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskID := strings.TrimSpace(c.Param("task_id"))
	if taskID != "" {
		return seedanceFetchTaskByID(c, taskID)
	}
	return seedanceFetchTaskList(c)
}

func seedanceFetchTaskByID(c *gin.Context, taskID string) (respBody []byte, taskResp *dto.TaskError) {
	originTask, exist, err := seedanceGetTaskByID(c.GetInt("id"), taskID)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
		return
	}
	if !exist {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	respBody, err = common.Marshal(seedanceTaskResponse(originTask))
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return
}

func seedanceFetchTaskList(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	pageNum := parseSeedancePositiveInt(c.Query("page_num"), 1, 500)
	pageSize := parseSeedancePositiveInt(c.Query("page_size"), 20, 500)
	offset := (pageNum - 1) * pageSize

	query := model.DB.
		Where("user_id = ?", c.GetInt("id")).
		Where("platform in ?", seedanceTaskPlatforms()).
		Where("submit_time >= ?", time.Now().Add(-7*24*time.Hour).Unix()).
		Order("id desc")

	var tasks []*model.Task
	if err := query.Find(&tasks).Error; err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_tasks_failed", http.StatusInternalServerError)
		return
	}

	statusFilter := strings.TrimSpace(c.Query("filter.status"))
	modelFilter := strings.TrimSpace(c.Query("filter.model"))
	serviceTierFilter := strings.TrimSpace(c.Query("filter.service_tier"))
	taskIDFilter := seedanceTaskIDFilters(c)
	filtered := make([]*model.Task, 0, len(tasks))
	for _, task := range tasks {
		if len(taskIDFilter) > 0 && !seedanceTaskMatchesID(task, taskIDFilter) {
			continue
		}
		if statusFilter != "" && seedanceTaskStatus(task.Status) != statusFilter {
			continue
		}
		if modelFilter != "" && !seedanceTaskMatchesModel(task, modelFilter) {
			continue
		}
		if serviceTierFilter != "" && !seedanceTaskFieldEquals(task, "service_tier", serviceTierFilter) {
			continue
		}
		filtered = append(filtered, task)
	}

	total := len(filtered)
	if offset > total {
		filtered = []*model.Task{}
	} else {
		end := offset + pageSize
		if end > total {
			end = total
		}
		filtered = filtered[offset:end]
	}

	items := make([]map[string]any, 0, len(filtered))
	for _, task := range filtered {
		items = append(items, seedanceTaskResponse(task))
	}

	respBody, err := common.Marshal(map[string]any{
		"items": items,
		"total": total,
	})
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return
}

func seedanceGetTaskByID(userID int, taskID string) (*model.Task, bool, error) {
	task, exist, err := model.GetByTaskId(userID, taskID)
	if err != nil || exist {
		return task, exist, err
	}

	var tasks []*model.Task
	err = model.DB.
		Where("user_id = ?", userID).
		Where("platform in ?", seedanceTaskPlatforms()).
		Where("submit_time >= ?", time.Now().Add(-7*24*time.Hour).Unix()).
		Find(&tasks).Error
	if err != nil {
		return nil, false, err
	}
	for _, candidate := range tasks {
		if candidate.GetUpstreamTaskID() == taskID {
			return candidate, true, nil
		}
	}
	return nil, false, nil
}

func seedanceTaskPlatforms() []string {
	return []string{
		strconv.Itoa(constant.ChannelTypeVolcEngine),
		strconv.Itoa(constant.ChannelTypeDoubaoVideo),
	}
}

func seedanceTaskIDFilters(c *gin.Context) []string {
	rawIDs := append(c.QueryArray("filter.task_ids"), c.QueryArray("filter.task_ids[]")...)
	taskIDs := make([]string, 0, len(rawIDs))
	for _, rawID := range rawIDs {
		for _, taskID := range strings.Split(rawID, ",") {
			taskID = strings.TrimSpace(taskID)
			if taskID != "" {
				taskIDs = append(taskIDs, taskID)
			}
		}
	}
	return taskIDs
}

func seedanceTaskMatchesID(task *model.Task, taskIDs []string) bool {
	for _, taskID := range taskIDs {
		if task.TaskID == taskID || task.GetUpstreamTaskID() == taskID {
			return true
		}
	}
	return false
}

func parseSeedancePositiveInt(raw string, fallback, maxValue int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		value = fallback
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func seedanceTaskMatchesModel(task *model.Task, modelName string) bool {
	if task.Properties.OriginModelName == modelName || task.Properties.UpstreamModelName == modelName {
		return true
	}
	return seedanceTaskFieldEquals(task, "model", modelName)
}

func seedanceTaskFieldEquals(task *model.Task, field string, value string) bool {
	var data map[string]any
	if err := common.Unmarshal(task.Data, &data); err != nil {
		return false
	}
	fieldValue, _ := data[field].(string)
	return fieldValue == value
}

func seedanceTaskResponse(task *model.Task) map[string]any {
	resp := map[string]any{}
	_ = common.Unmarshal(task.Data, &resp)

	resp["id"] = task.GetUpstreamTaskID()
	if modelName := task.Properties.OriginModelName; modelName != "" {
		resp["model"] = modelName
	} else if modelName = task.Properties.UpstreamModelName; modelName != "" {
		resp["model"] = modelName
	}
	resp["status"] = seedanceTaskStatus(task.Status)

	if createdAt := nonzeroSeedanceInt64(task.SubmitTime, task.CreatedAt); createdAt > 0 {
		resp["created_at"] = createdAt
	}
	if task.UpdatedAt > 0 {
		resp["updated_at"] = task.UpdatedAt
	}

	if resultURL := task.GetResultURL(); resultURL != "" && task.Status == model.TaskStatusSuccess {
		content, _ := resp["content"].(map[string]any)
		if content == nil {
			content = map[string]any{}
		}
		if _, ok := content["video_url"]; !ok {
			content["video_url"] = resultURL
		}
		resp["content"] = content
	}

	if task.Status == model.TaskStatusFailure && resp["error"] == nil && task.FailReason != "" {
		resp["error"] = map[string]any{
			"message": task.FailReason,
		}
	}
	return resp
}

func nonzeroSeedanceInt64(values ...int64) int64 {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

func seedanceTaskStatus(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	case model.TaskStatusInProgress:
		return "running"
	default:
		return "queued"
	}
}
