package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	canvasSSOTokenTTL = 60 * time.Second
	canvasSSOIssuer   = "new-api"
	canvasSSOAudience = "infinite-canvas"
)

// canvasSSOClaims defines the JWT claims sent to infinite-canvas during SSO.
type canvasSSOClaims struct {
	Username    string `json:"username"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	jwt.RegisteredClaims
}

// CanvasSSO generates a short-lived SSO token and returns the infinite-canvas
// SSO callback URL. The endpoint is consumed by the frontend via XHR (with the
// Authorization header), because a plain browser navigation cannot carry the
// dashboard access token.
func CanvasSSO(c *gin.Context) {
	if common.CanvasSSOSecret == "" || common.CanvasBaseURL == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Canvas SSO is not configured",
		})
		return
	}

	userId := c.GetInt("id")
	username := c.GetString("username")
	if userId <= 0 || username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "authentication required",
		})
		return
	}

	// Load full user record for email and display name.
	email := ""
	displayName := ""
	if user, err := getUserBasicInfo(userId); err == nil {
		email = user.Email
		displayName = user.DisplayName
	}
	if displayName == "" {
		displayName = username
	}

	now := time.Now()
	claims := canvasSSOClaims{
		Username:    username,
		Email:       email,
		DisplayName: displayName,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    canvasSSOIssuer,
			Subject:   strconv.Itoa(userId),
			Audience:  jwt.ClaimStrings{canvasSSOAudience},
			ExpiresAt: jwt.NewNumericDate(now.Add(canvasSSOTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.NewString(),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(common.CanvasSSOSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to generate SSO token",
		})
		return
	}

	redirectURL := common.CanvasBaseURL + "/api/auth/sso/callback?token=" + token
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"redirect_url": redirectURL,
		},
	})
}

// userBasicInfo is a lightweight struct for SSO token generation only.
type userBasicInfo struct {
	Email       string
	DisplayName string
}

func getUserBasicInfo(userId int) (*userBasicInfo, error) {
	var row struct {
		Email       string `gorm:"column:email"`
		DisplayName string `gorm:"column:display_name"`
	}
	err := model.DB.Table("users").Select("email, display_name").Where("id = ?", userId).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return &userBasicInfo{Email: row.Email, DisplayName: row.DisplayName}, nil
}
