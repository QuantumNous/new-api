package service

import (
	"errors"
	"fmt"
	"one-api/model"
	"os"
	"strings"
)

// CustomPassAuthService interface defines authentication operations for CustomPass
type CustomPassAuthService interface {
	// ValidateUserToken validates user token and returns user information
	ValidateUserToken(token string) (*model.User, error)

	// BuildUpstreamHeaders builds authentication headers for upstream API requests
	BuildUpstreamHeaders(channel *model.Channel, userToken string) map[string]string

	// ValidateChannelAccess validates if user has access to the channel
	ValidateChannelAccess(user *model.User, channel *model.Channel) error

	// GetCustomTokenHeader returns the custom token header name based on configuration
	GetCustomTokenHeader(channel *model.Channel) string
}

// CustomPassAuthServiceImpl implements CustomPassAuthService
type CustomPassAuthServiceImpl struct{}

// NewCustomPassAuthService creates a new CustomPass authentication service instance
func NewCustomPassAuthService() CustomPassAuthService {
	return &CustomPassAuthServiceImpl{}
}

// ValidateUserToken validates user token and returns user information
func (s *CustomPassAuthServiceImpl) ValidateUserToken(token string) (*model.User, error) {
	if token == "" {
		return nil, &CustomPassAuthError{
			Code:    "INVALID_TOKEN",
			Message: "用户token不能为空",
		}
	}

	// Clean token format - remove Bearer prefix if present
	token = strings.TrimSpace(token)
	token = strings.TrimPrefix(token, "Bearer ")
	token = strings.TrimPrefix(token, "sk-")

	// Split token to get the key part
	parts := strings.Split(token, "-")
	if len(parts) == 0 {
		return nil, &CustomPassAuthError{
			Code:    "INVALID_TOKEN_FORMAT",
			Message: "用户token格式无效",
		}
	}

	key := parts[0]
	if key == "" {
		return nil, &CustomPassAuthError{
			Code:    "INVALID_TOKEN_FORMAT",
			Message: "用户token格式无效",
		}
	}

	// Validate token using existing model function
	tokenModel, err := model.ValidateUserToken(key)
	if err != nil {
		return nil, &CustomPassAuthError{
			Code:    "TOKEN_VALIDATION_FAILED",
			Message: "用户token验证失败",
			Details: err.Error(),
		}
	}

	if tokenModel == nil {
		return nil, &CustomPassAuthError{
			Code:    "TOKEN_NOT_FOUND",
			Message: "用户token不存在",
		}
	}

	// Get user information
	user, err := model.GetUserById(tokenModel.UserId, false)
	if err != nil {
		return nil, &CustomPassAuthError{
			Code:    "USER_NOT_FOUND",
			Message: "用户不存在",
			Details: err.Error(),
		}
	}

	// Check user status
	if user.Status != 1 { // 1 means enabled
		return nil, &CustomPassAuthError{
			Code:    "USER_DISABLED",
			Message: "用户已被禁用",
		}
	}

	return user, nil
}

// BuildUpstreamHeaders builds authentication headers for upstream API requests
func (s *CustomPassAuthServiceImpl) BuildUpstreamHeaders(channel *model.Channel, userToken string) map[string]string {
	headers := make(map[string]string)

	// Set Authorization header with channel API key
	if channel != nil && channel.Key != "" {
		headers["Authorization"] = "Bearer " + channel.Key
	}

	// Set custom token header with user token
	if userToken != "" {
		customHeaderKey := s.GetCustomTokenHeader(channel)
		headers[customHeaderKey] = userToken
	}

	return headers
}

// ValidateChannelAccess validates if user has access to the channel
func (s *CustomPassAuthServiceImpl) ValidateChannelAccess(user *model.User, channel *model.Channel) error {
	if user == nil {
		return &CustomPassAuthError{
			Code:    "USER_REQUIRED",
			Message: "用户信息不能为空",
		}
	}

	if channel == nil {
		return &CustomPassAuthError{
			Code:    "CHANNEL_REQUIRED",
			Message: "渠道信息不能为空",
		}
	}

	// Check if channel is enabled
	if channel.Status != 1 { // 1 means enabled
		return &CustomPassAuthError{
			Code:    "CHANNEL_DISABLED",
			Message: "渠道已被禁用",
		}
	}

	// CustomPass 不验证用户组与渠道组匹配，与其他模型保持一致
	// 只要用户token有效且渠道启用即可访问

	return nil
}

// GetCustomTokenHeader returns the custom token header name based on configuration
func (s *CustomPassAuthServiceImpl) GetCustomTokenHeader(channel *model.Channel) string {
	// Priority 1: Environment variable
	if envHeader := os.Getenv("CUSTOM_PASS_HEADER_KEY"); envHeader != "" {
		return envHeader
	}

	// Priority 2: Channel configuration from frontend (stored in Other field)
	if channel != nil && channel.Other != "" {
		// The Other field contains the custom token header name for CustomPass channels
		return channel.Other
	}

	// Priority 3: Default value
	return "X-Custom-Token"
}

// getCustomTokenHeaderFromEnv gets custom token header from environment variable
func (s *CustomPassAuthServiceImpl) getCustomTokenHeaderFromEnv() string {
	if envHeader := os.Getenv("CUSTOM_PASS_HEADER_KEY"); envHeader != "" {
		return envHeader
	}
	return "X-Custom-Token"
}

// CustomPassAuthError represents authentication-related errors
type CustomPassAuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *CustomPassAuthError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s", e.Message, e.Details)
	}
	return e.Message
}

// IsAuthError checks if an error is a CustomPass authentication error
func IsAuthError(err error) bool {
	_, ok := err.(*CustomPassAuthError)
	return ok
}

// GetAuthErrorCode extracts error code from CustomPass authentication error
func GetAuthErrorCode(err error) string {
	if authErr, ok := err.(*CustomPassAuthError); ok {
		return authErr.Code
	}
	return "UNKNOWN_ERROR"
}

// ValidateTokenFormat validates the basic format of a user token
func ValidateTokenFormat(token string) error {
	if token == "" {
		return errors.New("token不能为空")
	}

	// Clean token
	token = strings.TrimSpace(token)
	token = strings.TrimPrefix(token, "Bearer ")
	token = strings.TrimPrefix(token, "sk-")

	// Basic format validation
	if len(token) < 3 {
		return errors.New("token长度不足")
	}

	// Check for invalid characters
	if strings.Contains(token, " ") {
		return errors.New("token不能包含空格")
	}

	return nil
}

// BuildAuthHeaders is a convenience function to build authentication headers
func BuildAuthHeaders(channel *model.Channel, userToken string) map[string]string {
	service := NewCustomPassAuthService()
	return service.BuildUpstreamHeaders(channel, userToken)
}

// ValidateUserAccess is a convenience function to validate user access
func ValidateUserAccess(token string, channel *model.Channel) (*model.User, error) {
	service := NewCustomPassAuthService()

	// Validate user token
	user, err := service.ValidateUserToken(token)
	if err != nil {
		return nil, err
	}

	// Validate channel access
	err = service.ValidateChannelAccess(user, channel)
	if err != nil {
		return nil, err
	}

	return user, nil
}
