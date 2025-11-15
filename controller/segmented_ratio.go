package controller

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

// validateSegmentedRatioRules validates rules for a single model configuration
func validateSegmentedRatioRules(modelName string, rules []ratio_setting.SegmentRule) error {
	for i, rule := range rules {
		if rule.InputMin < 0 || rule.InputMax < 0 || rule.OutputMin < 0 || rule.OutputMax < 0 {
			return fmt.Errorf("模型 %s 规则 %d 的token范围不能为负数", modelName, i+1)
		}
		if rule.InputMax > 0 && rule.InputMin > rule.InputMax {
			return fmt.Errorf("模型 %s 规则 %d 的输入token最小值不能大于最大值", modelName, i+1)
		}
		if rule.OutputMax > 0 && rule.OutputMin > rule.OutputMax {
			return fmt.Errorf("模型 %s 规则 %d 的输出token最小值不能大于最大值", modelName, i+1)
		}
		if rule.ModelRatio < 0 || rule.CompletionRatio < 0 {
			return fmt.Errorf("模型 %s 规则 %d 的倍率不能为负数", modelName, i+1)
		}
	}
	return nil
}

// GetSegmentedRatio returns the segmented ratio configuration for a specific model
func GetSegmentedRatio(c *gin.Context) {
	modelName := c.Param("model_name")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "模型名称不能为空",
		})
		return
	}

	config, exists := ratio_setting.GetSegmentedRatio(modelName)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "未找到该模型的分段倍率配置",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    config,
	})
}

// GetAllSegmentedRatios returns all segmented ratio configurations
func GetAllSegmentedRatios(c *gin.Context) {
	configs := ratio_setting.GetSegmentedRatioCopy()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    configs,
	})
}

// CreateOrUpdateSegmentedRatio creates or updates a segmented ratio configuration
func CreateOrUpdateSegmentedRatio(c *gin.Context) {
	var config ratio_setting.SegmentedRatioConfig
	err := json.NewDecoder(c.Request.Body).Decode(&config)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的请求参数: " + err.Error(),
		})
		return
	}

	// Validate the configuration
	if config.ModelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "模型名称不能为空",
		})
		return
	}

	if len(config.Rules) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "至少需要配置一条规则",
		})
		return
	}

	// Validate each rule
	if err := validateSegmentedRatioRules(config.ModelName, config.Rules); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Save all segmented ratio configurations to database
	// First, prepare the updated JSON with the new config
	tempMap := ratio_setting.GetSegmentedRatioCopy()
	tempMap[config.ModelName] = &config
	jsonBytes, err := json.Marshal(tempMap)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "序列化配置失败: " + err.Error(),
		})
		return
	}
	jsonStr := string(jsonBytes)
	err = model.UpdateOption("SegmentedRatio", jsonStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "保存到数据库失败: " + err.Error(),
		})
		return
	}

	// Only update in-memory state after successful DB persistence
	ratio_setting.SetSegmentedRatio(config.ModelName, &config)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "分段倍率配置成功",
		"data":    config,
	})
}

// DeleteSegmentedRatio deletes a segmented ratio configuration
func DeleteSegmentedRatio(c *gin.Context) {
	modelName := c.Param("model_name")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "模型名称不能为空",
		})
		return
	}

	// Save all segmented ratio configurations to database
	// First, prepare the updated JSON without the deleted model
	tempMap := ratio_setting.GetSegmentedRatioCopy()
	delete(tempMap, modelName)
	jsonBytes, err := json.Marshal(tempMap)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "序列化配置失败: " + err.Error(),
		})
		return
	}
	jsonStr := string(jsonBytes)
	err = model.UpdateOption("SegmentedRatio", jsonStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "保存到数据库失败: " + err.Error(),
		})
		return
	}

	// Only delete from memory after successful DB persistence
	ratio_setting.DeleteSegmentedRatio(modelName)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "分段倍率配置已删除",
	})
}

// ExportSegmentedRatios exports all segmented ratio configurations as JSON
func ExportSegmentedRatios(c *gin.Context) {
	jsonStr := ratio_setting.SegmentedRatio2JSONString()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    jsonStr,
	})
}

// ImportSegmentedRatios imports segmented ratio configurations from JSON
func ImportSegmentedRatios(c *gin.Context) {
	var request struct {
		Data string `json:"data"`
	}
	err := json.NewDecoder(c.Request.Body).Decode(&request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的请求参数: " + err.Error(),
		})
		return
	}

	// Parse and validate before applying
	var tmpConfigs map[string]*ratio_setting.SegmentedRatioConfig
	if err := json.Unmarshal([]byte(request.Data), &tmpConfigs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "导入分段倍率配置失败: " + err.Error(),
		})
		return
	}

	// Validate each config
	for modelName, config := range tmpConfigs {
		if config.ModelName == "" {
			config.ModelName = modelName
		}
		if len(config.Rules) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": fmt.Sprintf("模型 %s 至少需要配置一条规则", modelName),
			})
			return
		}
		if err := validateSegmentedRatioRules(modelName, config.Rules); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}

	// Save to database first
	err = model.UpdateOption("SegmentedRatio", request.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "保存到数据库失败: " + err.Error(),
		})
		return
	}

	// Only update in-memory state after successful DB persistence
	err = ratio_setting.UpdateSegmentedRatioByJSONString(request.Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "导入分段倍率配置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "分段倍率配置导入成功",
	})
}
