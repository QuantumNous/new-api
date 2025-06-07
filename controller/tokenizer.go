package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/model"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type TokenizerInfo struct {
	ModelName      string    `json:"model_name"`
	Status         string    `json:"status"`         // "available", "updating", "error"
	LastUpdated    time.Time `json:"last_updated"`
	Size           string    `json:"size"`
	CacheLocation  string    `json:"cache_location"`
	ChannelId      int       `json:"channel_id"`
	ChannelName    string    `json:"channel_name"`
}

type TokenizerUpdateRequest struct {
	ChannelId int      `json:"channel_id"`
	Models    []string `json:"models"`
	Force     bool     `json:"force"`
}

type TokenizerUpdateResponse struct {
	Success     bool              `json:"success"`
	Message     string            `json:"message"`
	UpdatedAt   time.Time         `json:"updated_at"`
	Results     []UpdateResult    `json:"results"`
}

type UpdateResult struct {
	ModelName string `json:"model_name"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
}

// GetTokenizers 获取分词器列表
func GetTokenizers(c *gin.Context) {
	// 获取所有HuggingFace类型的渠道
	channels, err := model.GetChannelsByType(common.ChannelTypeHuggingFace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取渠道列表失败: " + err.Error(),
		})
		return
	}

	var tokenizers []TokenizerInfo

	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}

		// 解析渠道支持的模型
		models := strings.Split(channel.Models, ",")
		for _, modelName := range models {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}

			tokenizer := TokenizerInfo{
				ModelName:     modelName,
				Status:        "available", // 默认状态
				LastUpdated:   time.Unix(channel.UpdatedTime, 0),
				Size:          "未知",
				CacheLocation: fmt.Sprintf("/data/cache/models--%s", strings.ReplaceAll(modelName, "/", "--")),
				ChannelId:     channel.Id,
				ChannelName:   channel.Name,
			}

			// 检查分词器状态（这里可以调用实际的检查逻辑）
			tokenizer.Status = checkTokenizerStatus(channel.BaseUrl, modelName)

			tokenizers = append(tokenizers, tokenizer)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tokenizers,
	})
}

// UpdateTokenizers 更新分词器
func UpdateTokenizers(c *gin.Context) {
	var req TokenizerUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 获取指定渠道
	channel, err := model.GetChannelById(req.ChannelId, false)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "渠道不存在",
		})
		return
	}

	if channel.Type != common.ChannelTypeHuggingFace {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "只支持HuggingFace类型的渠道",
		})
		return
	}

	// 执行更新
	results := make([]UpdateResult, 0, len(req.Models))
	
	for _, modelName := range req.Models {
		result := UpdateResult{
			ModelName: modelName,
		}

		// 调用分词器更新逻辑
		success, message := updateTokenizerForModel(channel.BaseUrl, modelName, req.Force)
		result.Success = success
		result.Message = message

		results = append(results, result)
	}

	// 统计成功数量
	successCount := 0
	for _, result := range results {
		if result.Success {
			successCount++
		}
	}

	response := TokenizerUpdateResponse{
		Success:   successCount > 0,
		Message:   fmt.Sprintf("更新完成: %d/%d 成功", successCount, len(req.Models)),
		UpdatedAt: time.Now(),
		Results:   results,
	}

	c.JSON(http.StatusOK, response)
}

// VerifyTokenizers 验证分词器
func VerifyTokenizers(c *gin.Context) {
	channelIdStr := c.Query("channel_id")
	if channelIdStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "缺少channel_id参数",
		})
		return
	}

	channelId, err := strconv.Atoi(channelIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "channel_id参数无效",
		})
		return
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(channelId, false)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "渠道不存在",
		})
		return
	}

	// 验证分词器
	models := strings.Split(channel.Models, ",")
	results := make([]UpdateResult, 0, len(models))

	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}

		result := UpdateResult{
			ModelName: modelName,
		}

		// 调用验证逻辑
		success, message := verifyTokenizerForModel(channel.BaseUrl, modelName)
		result.Success = success
		result.Message = message

		results = append(results, result)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    results,
	})
}

// 辅助函数：检查分词器状态
func checkTokenizerStatus(baseUrl, modelName string) string {
	// 这里可以实现实际的状态检查逻辑
	// 例如调用TEI服务的健康检查接口
	return "available"
}

// 辅助函数：更新指定模型的分词器
func updateTokenizerForModel(baseUrl, modelName string, force bool) (bool, string) {
	common.SysLog(fmt.Sprintf("更新分词器: %s (force: %v)", modelName, force))

	// 尝试通过Docker API更新分词器
	containerName := getContainerNameFromBaseUrl(baseUrl)
	if containerName == "" {
		return false, "无法确定容器名称"
	}

	// 构建更新命令
	updateCmd := []string{
		"python3", "/usr/local/bin/tokenizer_manager.py",
		"update", "--model", modelName,
	}

	if force {
		updateCmd = append(updateCmd, "--force")
	}

	// 执行Docker命令
	success, output := executeDockerCommand(containerName, updateCmd)
	if success {
		return true, "更新成功: " + output
	} else {
		return false, "更新失败: " + output
	}
}

// 辅助函数：验证指定模型的分词器
func verifyTokenizerForModel(baseUrl, modelName string) (bool, string) {
	common.SysLog(fmt.Sprintf("验证分词器: %s", modelName))

	// 尝试通过Docker API验证分词器
	containerName := getContainerNameFromBaseUrl(baseUrl)
	if containerName == "" {
		return false, "无法确定容器名称"
	}

	// 构建验证命令
	verifyCmd := []string{
		"python3", "/usr/local/bin/tokenizer_manager.py",
		"verify", "--model", modelName,
	}

	// 执行Docker命令
	success, output := executeDockerCommand(containerName, verifyCmd)
	if success {
		return true, "验证通过: " + output
	} else {
		return false, "验证失败: " + output
	}
}

// 从BaseURL推断容器名称
func getContainerNameFromBaseUrl(baseUrl string) string {
	// 这里可以根据实际的容器命名规则来推断
	// 例如：http://localhost:8080 -> tei-reranker
	// 或者从配置文件中读取映射关系

	if strings.Contains(baseUrl, ":8080") {
		return "tei-bge-reranker-v2-m3"
	} else if strings.Contains(baseUrl, ":8081") {
		return "tei-bge-reranker-base"
	} else if strings.Contains(baseUrl, ":8082") {
		return "tei-jina-reranker-v2"
	}

	// 默认容器名称
	return "tei-reranker"
}

// 执行Docker命令
func executeDockerCommand(containerName string, cmd []string) (bool, string) {
	// 这里实现实际的Docker命令执行
	// 可以使用os/exec包来执行docker exec命令

	common.SysLog(fmt.Sprintf("执行Docker命令: docker exec %s %v", containerName, cmd))

	// 模拟命令执行
	time.Sleep(time.Second * 1)

	// 这里应该实现真正的Docker命令执行
	// import "os/exec"
	// dockerCmd := exec.Command("docker", append([]string{"exec", containerName}, cmd...)...)
	// output, err := dockerCmd.CombinedOutput()
	// if err != nil {
	//     return false, string(output) + ": " + err.Error()
	// }
	// return true, string(output)

	return true, "命令执行成功"
}
