// Package controller provides HTTP handlers
// model_config.go - Admin APIs for model alias and deprecated model configuration
package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// ModelAliasRequest represents a request to add/update a model alias
type ModelAliasRequest struct {
	Alias  string `json:"alias" binding:"required"`
	Target string `json:"target" binding:"required"`
}

// DeprecatedModelRequest represents a request to add/update a deprecated model
type DeprecatedModelRequest struct {
	Deprecated  string `json:"deprecated" binding:"required"`
	Replacement string `json:"replacement" binding:"required"`
	Reason      string `json:"reason"`
}

// ListModelAliasesAPI returns all model aliases
func ListModelAliasesAPI(c *gin.Context) {
	aliases := middleware.ListModelAliases()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    aliases,
	})
}

// AddModelAliasAPI adds or updates a model alias
func AddModelAliasAPI(c *gin.Context) {
	var req ModelAliasRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	middleware.AddModelAlias(req.Alias, req.Target)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Model alias added successfully",
	})
}

// RemoveModelAliasAPI removes a model alias
func RemoveModelAliasAPI(c *gin.Context) {
	alias := c.Param("alias")
	middleware.RemoveModelAlias(alias)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Model alias removed successfully",
	})
}

// ListDeprecatedModelsAPI returns all deprecated models
func ListDeprecatedModelsAPI(c *gin.Context) {
	models := middleware.ListDeprecatedModels()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    models,
	})
}

// AddDeprecatedModelAPI adds or updates a deprecated model
func AddDeprecatedModelAPI(c *gin.Context) {
	var req DeprecatedModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	middleware.AddDeprecatedModel(req.Deprecated, req.Replacement, req.Reason)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Deprecated model added successfully",
	})
}

// RemoveDeprecatedModelAPI removes a deprecated model
func RemoveDeprecatedModelAPI(c *gin.Context) {
	model := c.Param("model")
	middleware.RemoveDeprecatedModel(model)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Deprecated model removed successfully",
	})
}
