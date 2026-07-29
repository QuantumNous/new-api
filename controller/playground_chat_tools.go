package controller

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type playgroundToolPolicy struct {
	Mode    string   `json:"mode"`
	Enabled []string `json:"enabled"`
	Direct  struct {
		Name string         `json:"name"`
		Args map[string]any `json:"args"`
	} `json:"direct"`
}
type createPlaygroundToolRunRequest struct {
	ClientRequestId string               `json:"client_request_id"`
	Model           string               `json:"model"`
	Group           string               `json:"group"`
	UserText        string               `json:"user_text"`
	ToolPolicy      playgroundToolPolicy `json:"tool_policy"`
}

func CreatePlaygroundChatToolRun(c *gin.Context) {
	userID := c.GetInt("id")
	var req createPlaygroundToolRunRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "invalid request")
		return
	}
	req.ClientRequestId = strings.TrimSpace(req.ClientRequestId)
	req.UserText = strings.TrimSpace(req.UserText)
	req.Group = strings.TrimSpace(req.Group)
	if req.ClientRequestId == "" || len(req.ClientRequestId) > 191 || req.UserText == "" {
		common.ApiErrorMsg(c, "client_request_id and user_text are required")
		return
	}
	if existing, err := model.GetPlaygroundChatToolRunByRequest(userID, req.ClientRequestId); err == nil {
		respondPlaygroundToolRun(c, existing)
		return
	}
	userGroup, err := model.GetUserGroup(userID, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Group == "" {
		req.Group = userGroup
	} else if !service.GroupInUserUsableGroups(userGroup, req.Group) {
		common.ApiErrorMsg(c, "group is not available to this user")
		return
	}
	action := service.ClassifyPlaygroundTool(req.UserText)
	if req.ToolPolicy.Mode == "direct" {
		action = strings.TrimSpace(req.ToolPolicy.Direct.Name)
	}
	if action != service.PlaygroundToolChat && action != service.PlaygroundToolImage && action != service.PlaygroundToolVideo && action != service.PlaygroundToolSearch {
		common.ApiErrorMsg(c, "invalid direct tool")
		return
	}
	if action != service.PlaygroundToolChat && req.ToolPolicy.Mode != "direct" && !stringSliceContains(req.ToolPolicy.Enabled, action) {
		action = service.PlaygroundToolChat
	}
	if action == service.PlaygroundToolSearch && len([]rune(req.UserText)) > service.MaxPlaygroundSearchQueryRunes {
		common.ApiErrorMsg(c, "search query is too large")
		return
	}
	run := &model.PlaygroundChatToolRun{UserId: userID, ClientRequestId: req.ClientRequestId, Action: action, Status: "ready", ChatModel: req.Model, UsingGroup: req.Group, Prompt: req.UserText, ExecutionToken: uuid.NewString()}
	args := map[string]any{}
	if req.ToolPolicy.Mode == "direct" {
		for key, value := range req.ToolPolicy.Direct.Args {
			args[key] = value
		}
	}
	// Identity-sensitive fields are always selected by the platform. Remaining
	// direct args still pass through the existing relay validators and bounds.
	args["prompt"] = req.UserText
	endpoint := ""
	if action == service.PlaygroundToolImage || action == service.PlaygroundToolVideo || action == service.PlaygroundToolSearch {
		abilityGroups := []string{req.Group}
		if req.Group == "auto" {
			abilityGroups = service.GetUserAutoGroup(userGroup)
		}
		if action == service.PlaygroundToolSearch {
			abilities, abilityErr := model.GetEnabledGrokPlaygroundSearchAbilities(abilityGroups)
			if abilityErr != nil {
				common.ApiError(c, abilityErr)
				return
			}
			for _, group := range abilityGroups {
				models := make([]string, 0, len(abilities))
				for _, ability := range abilities {
					if ability.Group == group && (ability.ChannelType == constant.ChannelTypeXai || ability.ChannelType == constant.ChannelTypeOpenAI) {
						models = append(models, ability.Model)
					}
				}
				selectedModel := selectToolModel(models, action)
				for _, ability := range abilities {
					if ability.Group != group || ability.Model != selectedModel {
						continue
					}
					run.ToolModel = ability.Model
					run.UsingGroup = ability.Group
					args["__channel_id"] = ability.ChannelId
					args["group"] = ability.Group
					break
				}
				if run.ToolModel != "" {
					break
				}
			}
		}
		modelSet := map[string]struct{}{}
		for _, group := range abilityGroups {
			for _, enabledModel := range model.GetGroupEnabledModels(group) {
				modelSet[enabledModel] = struct{}{}
			}
		}
		models := make([]string, 0, len(modelSet))
		for enabledModel := range modelSet {
			models = append(models, enabledModel)
		}
		if action != service.PlaygroundToolSearch {
			run.ToolModel = selectToolModel(models, action)
		}
		if run.ToolModel == "" {
			run.Status = "unavailable"
			run.ErrorMessage = "no enabled tool model is available for this group"
		} else {
			args["model"] = run.ToolModel
			if action == service.PlaygroundToolImage {
				endpoint = "/pg/images/generations"
			} else if action == service.PlaygroundToolVideo {
				endpoint = "/pg/video/generations"
			} else {
				endpoint = "/pg/responses"
			}
		}
	}
	argBytes, _ := common.Marshal(args)
	run.ArgumentsJson = string(argBytes)
	if action == service.PlaygroundToolChat {
		run.Status = "completed"
	}
	if err := model.CreatePlaygroundChatToolRun(run); err != nil {
		if existing, e := model.GetPlaygroundChatToolRunByRequest(userID, req.ClientRequestId); e == nil {
			respondPlaygroundToolRun(c, existing)
			return
		}
		common.ApiError(c, err)
		return
	}
	c.Set("playground_tool_endpoint", endpoint)
	respondPlaygroundToolRun(c, run)
}

func GetPlaygroundChatToolRun(c *gin.Context) {
	run := ownedToolRun(c)
	if run != nil {
		if run.Action == service.PlaygroundToolSearch && run.Status == "executing" && run.UpdatedAt < time.Now().Add(-10*time.Minute).Unix() {
			_ = model.UpdatePlaygroundChatToolRunCAS(run.Id, run.UserId, "executing", map[string]any{"status": "failed", "error_message": "managed search execution timed out"})
		}
		reconcileSubmittedPlaygroundToolRun(run)
		run, _ = model.GetPlaygroundChatToolRun(run.Id, run.UserId)
		respondPlaygroundToolRun(c, run)
	}
}

func reconcileSubmittedPlaygroundToolRun(run *model.PlaygroundChatToolRun) {
	if run.Status != "submitted" || run.Action != service.PlaygroundToolVideo || run.TaskId == "" {
		return
	}
	task, ok, err := model.GetByTaskId(run.UserId, run.TaskId)
	if err != nil || !ok {
		return
	}
	updates := map[string]any{}
	if task.Status == model.TaskStatusSuccess {
		result, _ := common.Marshal(map[string]any{"video_url": "/v1/videos/" + run.TaskId + "/content"})
		updates = map[string]any{"status": "completed", "result_json": string(result), "error_message": ""}
	} else if task.Status == model.TaskStatusFailure {
		updates = map[string]any{"status": "failed", "error_message": task.FailReason}
	}
	if len(updates) != 0 {
		_ = model.UpdatePlaygroundChatToolRunCAS(run.Id, run.UserId, "submitted", updates)
	}
}
func CancelPlaygroundChatToolRun(c *gin.Context) {
	run := ownedToolRun(c)
	if run == nil {
		return
	}
	if err := model.UpdatePlaygroundChatToolRunCAS(run.Id, run.UserId, "ready", map[string]any{"status": "cancelled"}); err != nil {
		common.ApiErrorMsg(c, "run is no longer cancellable")
		return
	}
	run, _ = model.GetPlaygroundChatToolRun(run.Id, run.UserId)
	respondPlaygroundToolRun(c, run)
}
func ImportPlaygroundChatToolRun(c *gin.Context) {
	run := ownedToolRun(c)
	if run == nil {
		return
	}
	var body struct {
		ExecutionToken string `json:"execution_token"`
		Status         string `json:"status"`
		TaskId         string `json:"task_id"`
		Result         any    `json:"result"`
		Sources        any    `json:"sources"`
		Error          string `json:"error"`
	}
	if err := common.DecodeJson(c.Request.Body, &body); err != nil || body.ExecutionToken != run.ExecutionToken {
		common.ApiErrorMsg(c, "invalid execution contract")
		return
	}
	if body.Status != "completed" && body.Status != "submitted" && body.Status != "failed" {
		common.ApiErrorMsg(c, "invalid status")
		return
	}
	if body.TaskId != "" {
		if _, ok, e := model.GetByTaskId(run.UserId, body.TaskId); e != nil || !ok {
			common.ApiErrorMsg(c, "task is not owned by this user")
			return
		}
	}
	b, _ := common.Marshal(body.Result)
	if len(b) > 64*1024 {
		common.ApiErrorMsg(c, "result is too large")
		return
	}
	sources, _ := common.Marshal(body.Sources)
	if len(sources) > 64*1024 {
		common.ApiErrorMsg(c, "sources are too large")
		return
	}
	fromStatus := run.Status
	if fromStatus != "executing" && fromStatus != "submitted" {
		common.ApiErrorMsg(c, "run state conflict")
		return
	}
	if fromStatus == "submitted" && body.Status == "submitted" {
		common.ApiErrorMsg(c, "run state conflict")
		return
	}
	if err := model.UpdatePlaygroundChatToolRunCAS(run.Id, run.UserId, fromStatus, map[string]any{"status": body.Status, "task_id": body.TaskId, "result_json": string(b), "sources_json": string(sources), "error_message": body.Error}); err != nil {
		common.ApiErrorMsg(c, "run state conflict")
		return
	}
	run, _ = model.GetPlaygroundChatToolRun(run.Id, run.UserId)
	respondPlaygroundToolRun(c, run)
}

func ownedToolRun(c *gin.Context) *model.PlaygroundChatToolRun {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid id")
		return nil
	}
	r, e := model.GetPlaygroundChatToolRun(id, c.GetInt("id"))
	if errors.Is(e, gorm.ErrRecordNotFound) {
		c.Status(http.StatusNotFound)
		return nil
	}
	if e != nil {
		common.ApiError(c, e)
		return nil
	}
	return r
}
func respondPlaygroundToolRun(c *gin.Context, r *model.PlaygroundChatToolRun) {
	var args map[string]any
	var sources, result any
	_ = common.UnmarshalJsonStr(r.ArgumentsJson, &args)
	if args != nil {
		delete(args, "__channel_id")
	}
	_ = common.UnmarshalJsonStr(r.SourcesJson, &sources)
	_ = common.UnmarshalJsonStr(r.ResultJson, &result)
	endpoint := ""
	if r.Action == service.PlaygroundToolImage {
		endpoint = "/pg/images/generations"
	} else if r.Action == service.PlaygroundToolVideo {
		endpoint = "/pg/video/generations"
	} else if r.Action == service.PlaygroundToolSearch {
		endpoint = "/pg/responses"
	}
	common.ApiSuccess(c, gin.H{"run": r, "arguments": args, "sources": sources, "result": result, "execution": gin.H{"endpoint": endpoint, "method": "POST", "execution_token": r.ExecutionToken}})
}
func stringSliceContains(v []string, w string) bool {
	for _, s := range v {
		if s == w {
			return true
		}
	}
	return false
}
func selectToolModel(models []string, action string) string {
	// Image tools only pick models that speak the OpenAI Images request shape
	// used by the playground (gpt-image-2* and grok-imagine-image*). No DALL·E / Flux.
	if action == service.PlaygroundToolImage {
		type rankMatch struct {
			model string
			rank  int
		}
		var matches []rankMatch
		for _, enabled := range models {
			bare := enabled
			if i := strings.LastIndex(enabled, "/"); i >= 0 {
				bare = enabled[i+1:]
			}
			lower := strings.ToLower(strings.TrimSpace(bare))
			rank := -1
			switch {
			case lower == "gpt-image-2":
				rank = 0
			case strings.HasPrefix(lower, "gpt-image-2-"):
				rank = 1
			case lower == "grok-imagine-image-pro":
				rank = 2
			case lower == "grok-imagine-image" || strings.HasPrefix(lower, "grok-imagine-image-"):
				rank = 3
			case strings.HasPrefix(lower, "grok-2-image"):
				rank = 4
			}
			if rank >= 0 {
				matches = append(matches, rankMatch{model: enabled, rank: rank})
			}
		}
		if len(matches) == 0 {
			return ""
		}
		sort.Slice(matches, func(i, j int) bool {
			if matches[i].rank != matches[j].rank {
				return matches[i].rank < matches[j].rank
			}
			return strings.ToLower(matches[i].model) < strings.ToLower(matches[j].model)
		})
		return matches[0].model
	}

	priorities := []string{}
	need := []string{}
	if action == service.PlaygroundToolVideo {
		priorities = []string{"grok-imagine-video", "grok-imagine-video-1.5"}
		need = []string{"video", "sora", "veo", "kling", "wan"}
	} else if action == service.PlaygroundToolSearch {
		priorities = []string{"grok-4.5", "grok-4.3"}
		need = []string{"grok-4"}
	} else {
		return ""
	}
	for _, preferred := range priorities {
		for _, enabled := range models {
			if strings.EqualFold(enabled, preferred) {
				return enabled
			}
		}
	}
	fallbacks := append([]string(nil), models...)
	sort.Slice(fallbacks, func(i, j int) bool { return strings.ToLower(fallbacks[i]) < strings.ToLower(fallbacks[j]) })
	for _, m := range fallbacks {
		lower := strings.ToLower(m)
		if action == service.PlaygroundToolSearch && (strings.Contains(lower, "image") || strings.Contains(lower, "imagine") || strings.Contains(lower, "video")) {
			continue
		}
		for _, k := range need {
			if strings.Contains(lower, k) {
				return m
			}
		}
	}
	return ""
}
