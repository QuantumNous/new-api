package controller

import (
	"github.com/gin-gonic/gin"
)

// VideoGenerations
// @Summary 生成视频
// @Description 调用视频生成接口生成视频
// @Tags Video
// @Accept json
// @Produce json
// @Param Authorization header string true "用户认证令牌 (Aeess-Token: sk-xxxx)" example(Bearer sk-t8uP8tR6EhrmVgTijsf5HzMrr5KGE0BYCFTtSh4sk2GCXNZN)
// @Param request body dto.VideoRequest true "视频生成请求参数"
// @Failure 400 {object} dto.OpenAIError "请求参数错误"
// @Failure 401 {object} dto.OpenAIError "未授权"
// @Failure 403 {object} dto.OpenAIError "无权限"
// @Failure 500 {object} dto.OpenAIError "服务器内部错误"
// @Router /v1/video/generations [post]
func VideoGenerations(c *gin.Context) {
}

// VideoGenerationsTaskId
// @Summary 查询视频
// @Description 根据任务ID查询视频生成任务的状态和结果
// @Tags Video
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param task_id path string true "Task ID"
// @Success 200 {object} dto.VideoTaskResponse "任务状态和结果"
// @Failure 400 {object} dto.OpenAIError "请求参数错误"
// @Failure 401 {object} dto.OpenAIError "未授权"
// @Failure 403 {object} dto.OpenAIError "无权限"
// @Failure 500 {object} dto.OpenAIError "服务器内部错误"
// @Router /v1/video/generations/{task_id} [get]
func VideoGenerationsTaskId(c *gin.Context) {
}
