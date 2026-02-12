package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetCustomErrorRules 返回所有自定义错误替换规则，供管理员管理。
func GetCustomErrorRules(c *gin.Context) {
	rules, err := model.GetAllCustomErrorRules()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rules,
	})
}

// CreateCustomErrorRule 处理创建新的自定义错误替换规则。
func CreateCustomErrorRule(c *gin.Context) {
	var rule model.CustomErrorRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误: " + err.Error(),
		})
		return
	}
	if rule.Contains == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "匹配内容不能为空",
		})
		return
	}
	if err := model.CreateCustomErrorRule(&rule); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// UpdateCustomErrorRule 处理更新已有的自定义错误替换规则。
func UpdateCustomErrorRule(c *gin.Context) {
	var rule model.CustomErrorRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误: " + err.Error(),
		})
		return
	}
	if rule.Id == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "ID不能为空",
		})
		return
	}
	if rule.Contains == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "匹配内容不能为空",
		})
		return
	}
	if err := model.UpdateCustomErrorRule(&rule); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// DeleteCustomErrorRule 处理根据 ID 删除自定义错误替换规则。
func DeleteCustomErrorRule(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的ID",
		})
		return
	}
	if err := model.DeleteCustomErrorRule(id); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
