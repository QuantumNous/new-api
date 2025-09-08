package controller

import (
	"net/http"
	"one-api/common"
	"one-api/model"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

// CreateOAuthClientRequest 创建OAuth客户端请求
type CreateOAuthClientRequest struct {
	Name         string   `json:"name" binding:"required"`
	ClientType   string   `json:"client_type" binding:"required,oneof=confidential public"`
	GrantTypes   []string `json:"grant_types" binding:"required"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes" binding:"required"`
	Description  string   `json:"description"`
	RequirePKCE  bool     `json:"require_pkce"`
}

// UpdateOAuthClientRequest 更新OAuth客户端请求
type UpdateOAuthClientRequest struct {
	ID           string   `json:"id" binding:"required"`
	Name         string   `json:"name" binding:"required"`
	ClientType   string   `json:"client_type" binding:"required,oneof=confidential public"`
	GrantTypes   []string `json:"grant_types" binding:"required"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes" binding:"required"`
	Description  string   `json:"description"`
	RequirePKCE  bool     `json:"require_pkce"`
	Status       int      `json:"status" binding:"required,oneof=1 2"`
}

// GetAllOAuthClients 获取所有OAuth客户端
func GetAllOAuthClients(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.Query("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	startIdx := (page - 1) * perPage
	clients, err := model.GetAllOAuthClients(startIdx, perPage)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 清理敏感信息
	for _, client := range clients {
		client.Secret = maskSecret(client.Secret)
	}

	total, _ := model.CountOAuthClients()

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"data":     clients,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// SearchOAuthClients 搜索OAuth客户端
func SearchOAuthClients(c *gin.Context) {
	keyword := c.Query("keyword")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "关键词不能为空",
		})
		return
	}

	clients, err := model.SearchOAuthClients(keyword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 清理敏感信息
	for _, client := range clients {
		client.Secret = maskSecret(client.Secret)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    clients,
	})
}

// GetOAuthClient 获取单个OAuth客户端
func GetOAuthClient(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "ID不能为空",
		})
		return
	}

	client, err := model.GetOAuthClientByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "客户端不存在",
		})
		return
	}

	// 清理敏感信息
	client.Secret = maskSecret(client.Secret)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    client,
	})
}

// CreateOAuthClient 创建OAuth客户端
func CreateOAuthClient(c *gin.Context) {
	var req CreateOAuthClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 验证授权类型
	validGrantTypes := []string{"client_credentials", "authorization_code", "refresh_token"}
	for _, grantType := range req.GrantTypes {
		if !contains(validGrantTypes, grantType) {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "无效的授权类型: " + grantType,
			})
			return
		}
	}

	// 如果包含authorization_code，则必须提供redirect_uris
	if contains(req.GrantTypes, "authorization_code") && len(req.RedirectURIs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "授权码模式需要提供重定向URI",
		})
		return
	}

	// 生成客户端ID和密钥
	clientID := generateClientID()
	clientSecret := ""
	if req.ClientType == "confidential" {
		clientSecret = generateClientSecret()
	}

	// 获取创建者ID
	createdBy := c.GetInt("id")

	// 创建客户端
	client := &model.OAuthClient{
		ID:          clientID,
		Secret:      clientSecret,
		Name:        req.Name,
		ClientType:  req.ClientType,
		RequirePKCE: req.RequirePKCE,
		Status:      common.UserStatusEnabled,
		CreatedBy:   createdBy,
		Description: req.Description,
	}

	client.SetGrantTypes(req.GrantTypes)
	client.SetRedirectURIs(req.RedirectURIs)
	client.SetScopes(req.Scopes)

	err := model.CreateOAuthClient(client)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "创建客户端失败: " + err.Error(),
		})
		return
	}

	// 返回结果（包含完整的客户端密钥，仅此一次）
	c.JSON(http.StatusCreated, gin.H{
		"success":       true,
		"message":       "客户端创建成功",
		"client_id":     client.ID,
		"client_secret": client.Secret, // 仅在创建时返回完整密钥
		"data":          client,
	})
}

// UpdateOAuthClient 更新OAuth客户端
func UpdateOAuthClient(c *gin.Context) {
	var req UpdateOAuthClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 获取现有客户端
	client, err := model.GetOAuthClientByID(req.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "客户端不存在",
		})
		return
	}

	// 验证授权类型
	validGrantTypes := []string{"client_credentials", "authorization_code", "refresh_token"}
	for _, grantType := range req.GrantTypes {
		if !contains(validGrantTypes, grantType) {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "无效的授权类型: " + grantType,
			})
			return
		}
	}

	// 更新客户端信息
	client.Name = req.Name
	client.ClientType = req.ClientType
	client.RequirePKCE = req.RequirePKCE
	client.Status = req.Status
	client.Description = req.Description
	client.SetGrantTypes(req.GrantTypes)
	client.SetRedirectURIs(req.RedirectURIs)
	client.SetScopes(req.Scopes)

	err = model.UpdateOAuthClient(client)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "更新客户端失败: " + err.Error(),
		})
		return
	}

	// 清理敏感信息
	client.Secret = maskSecret(client.Secret)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "客户端更新成功",
		"data":    client,
	})
}

// DeleteOAuthClient 删除OAuth客户端
func DeleteOAuthClient(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "ID不能为空",
		})
		return
	}

	err := model.DeleteOAuthClient(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "删除客户端失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "客户端删除成功",
	})
}

// RegenerateOAuthClientSecret 重新生成客户端密钥
func RegenerateOAuthClientSecret(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "ID不能为空",
		})
		return
	}

	client, err := model.GetOAuthClientByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "客户端不存在",
		})
		return
	}

	// 只有机密客户端才能重新生成密钥
	if client.ClientType != "confidential" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "只有机密客户端才能重新生成密钥",
		})
		return
	}

	// 生成新密钥
	client.Secret = generateClientSecret()

	err = model.UpdateOAuthClient(client)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "重新生成密钥失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       "客户端密钥重新生成成功",
		"client_secret": client.Secret, // 返回新生成的密钥
	})
}

// generateClientID 生成客户端ID
func generateClientID() string {
	return "client_" + randstr.String(16)
}

// generateClientSecret 生成客户端密钥
func generateClientSecret() string {
	return randstr.String(32)
}

// maskSecret 掩码密钥显示
func maskSecret(secret string) string {
	if len(secret) <= 6 {
		return strings.Repeat("*", len(secret))
	}
	return secret[:3] + strings.Repeat("*", len(secret)-6) + secret[len(secret)-3:]
}

// contains 检查字符串切片是否包含指定值
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
