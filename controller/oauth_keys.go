package controller

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"one-api/logger"
	"one-api/src/oauth"
)

type rotateKeyRequest struct {
	Kid string `json:"kid"`
}

type genKeyFileRequest struct {
	Path      string `json:"path"`
	Kid       string `json:"kid"`
	Overwrite bool   `json:"overwrite"`
}

type importPemRequest struct {
	Pem string `json:"pem"`
	Kid string `json:"kid"`
}

// RotateOAuthSigningKey rotates the OAuth2 JWT signing key (Root only)
func RotateOAuthSigningKey(c *gin.Context) {
	var req rotateKeyRequest
	_ = c.BindJSON(&req)
	kid, err := oauth.RotateSigningKey(req.Kid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	logger.LogInfo(c, "oauth signing key rotated: "+kid)
	c.JSON(http.StatusOK, gin.H{"success": true, "kid": kid})
}

// ListOAuthSigningKeys returns current and historical JWKS signing keys
func ListOAuthSigningKeys(c *gin.Context) {
	keys := oauth.ListSigningKeys()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": keys})
}

// DeleteOAuthSigningKey deletes a non-current key by kid
func DeleteOAuthSigningKey(c *gin.Context) {
	kid := c.Param("kid")
	if kid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "kid required"})
		return
	}
	if err := oauth.DeleteSigningKey(kid); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	logger.LogInfo(c, "oauth signing key deleted: "+kid)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GenerateOAuthSigningKeyFile generates a private key file and rotates current kid
func GenerateOAuthSigningKeyFile(c *gin.Context) {
	var req genKeyFileRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "path required"})
		return
	}
	kid, err := oauth.GenerateAndPersistKey(req.Path, req.Kid, req.Overwrite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	logger.LogInfo(c, "oauth signing key generated to file: "+req.Path+" kid="+kid)
	c.JSON(http.StatusOK, gin.H{"success": true, "kid": kid, "path": req.Path})
}

// ImportOAuthSigningKey imports PEM text and rotates current kid
func ImportOAuthSigningKey(c *gin.Context) {
	var req importPemRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Pem == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "pem required"})
		return
	}
	kid, err := oauth.ImportPEMKey(req.Pem, req.Kid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	logger.LogInfo(c, "oauth signing key imported from PEM, kid="+kid)
	c.JSON(http.StatusOK, gin.H{"success": true, "kid": kid})
}
