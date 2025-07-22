package batchjob

import (
	"context"
	"fmt"

	"one-api/common"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos/enum"
)

// TOSConfig TOS配置参数
type TOSConfig struct {
	AccessKey  string
	SecretKey  string
	Endpoint   string
	Region     string
	BucketName string
	ObjectKey  string
}

// NewTOSConfig 从参数创建TOS配置
func NewTOSConfig(accessKey, secretKey, endpoint, region, bucketName, objectKey string) *TOSConfig {
	return &TOSConfig{
		AccessKey:  accessKey,
		SecretKey:  secretKey,
		Endpoint:   endpoint,
		Region:     region,
		BucketName: bucketName,
		ObjectKey:  objectKey,
	}
}

// Validate 验证配置参数
func (c *TOSConfig) Validate(ctx context.Context) error {
	if c.AccessKey == "" || c.SecretKey == "" || c.Endpoint == "" || c.Region == "" {
		return fmt.Errorf("missing required configuration: AccessKey, SecretKey, Endpoint, Region")
	}
	if c.BucketName == "" || c.ObjectKey == "" {
		return fmt.Errorf("missing required configuration: BucketName, ObjectKey")
	}
	return nil
}

// PreflightRequest 执行TOS请求预检
func PreflightRequest(ctx context.Context, config *TOSConfig) error {
	// 验证配置
	if err := config.Validate(ctx); err != nil {
		common.LogError(ctx, "invalid configuration: "+err.Error())
		return fmt.Errorf("invalid configuration: %w", err)
	}

	// 创建TOS客户端
	client, err := tos.NewClientV2(config.Endpoint,
		tos.WithRegion(config.Region),
		tos.WithCredentials(tos.NewStaticCredentials(config.AccessKey, config.SecretKey)))
	if err != nil {
		common.LogError(ctx, "failed to create TOS client: "+err.Error())
		return fmt.Errorf("failed to create TOS client: %w", err)
	}

	// 检查存储桶是否存在
	_, err = client.HeadBucket(ctx, &tos.HeadBucketInput{Bucket: config.BucketName})
	if err != nil {
		common.LogError(ctx, "bucket "+config.BucketName+" does not exist or access denied: "+err.Error())
		return fmt.Errorf("bucket %s does not exist or access denied: %w", config.BucketName, err)
	}

	// 检查对象是否存在（可选）
	_, err = client.HeadObjectV2(ctx, &tos.HeadObjectV2Input{
		Bucket: config.BucketName,
		Key:    config.ObjectKey,
	})
	if err != nil {
		// 如果对象不存在，这不是错误，只是预检信息
		if serverErr, ok := err.(*tos.TosServerError); ok && serverErr.StatusCode == 404 {
			common.LogInfo(ctx, fmt.Sprintf("Object %s does not exist in bucket %s (this is normal for new uploads)", config.ObjectKey, config.BucketName))
		} else {
			common.LogError(ctx, fmt.Sprintf("failed to check object %s: %v", config.ObjectKey, err))
			return fmt.Errorf("failed to check object %s: %w", config.ObjectKey, err)
		}
	} else {
		common.LogInfo(ctx, fmt.Sprintf("Object %s already exists in bucket %s", config.ObjectKey, config.BucketName))
	}

	// 测试生成预签名URL（验证权限）
	_, err = client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: enum.HttpMethodPut,
		Bucket:     config.BucketName,
		Key:        config.ObjectKey,
	})
	if err != nil {
		common.LogError(ctx, "failed to generate pre-signed URL (permission check failed): "+err.Error())
		return fmt.Errorf("failed to generate pre-signed URL (permission check failed): %w", err)
	}

	common.LogInfo(ctx, fmt.Sprintf("Preflight check passed for bucket: %s, object: %s", config.BucketName, config.ObjectKey))
	return nil
}

// PresignRequest 预签名请求参数
type PresignRequest struct {
	AccessKey  string `json:"access_key" binding:"required"`
	SecretKey  string `json:"secret_key" binding:"required"`
	Endpoint   string `json:"endpoint" binding:"required"`
	Region     string `json:"region" binding:"required"`
	BucketName string `json:"bucket_name" binding:"required"`
	ObjectKey  string `json:"object_key"` // 客户端提供的文件名，服务器会自动生成完整路径
	Expires    int64  `json:"expires"`    // 过期时间（秒），默认3600秒
	Method     string `json:"method"`     // HTTP方法：GET、HEAD、PUT、DELETE，默认为PUT
}

// PresignResponse 预签名响应
type PresignResponse struct {
	PresignedURL string `json:"presigned_url"`
	Expires      int64  `json:"expires"`
	BucketName   string `json:"bucket_name"`
	ObjectName   string `json:"object_name"`
	Method       string `json:"method"`
}

// GeneratePresignedURL 生成预签名URL
func GeneratePresignedURL(ctx context.Context, req *PresignRequest) (*PresignResponse, error) {
	// 设置默认过期时间
	if req.Expires <= 0 {
		req.Expires = 3600 // 默认1小时
	}

	// 设置默认HTTP方法
	if req.Method == "" {
		req.Method = "PUT"
	}

	// 验证HTTP方法
	validMethods := map[string]bool{
		"GET":    true,
		"HEAD":   true,
		"PUT":    true,
		"DELETE": true,
	}
	if !validMethods[req.Method] {
		return nil, fmt.Errorf("invalid HTTP method: %s, supported methods: GET, HEAD, PUT, DELETE", req.Method)
	}

	// 创建TOS配置
	config := NewTOSConfig(
		req.AccessKey,
		req.SecretKey,
		req.Endpoint,
		req.Region,
		req.BucketName,
		req.ObjectKey,
	)

	// 执行预检
	if err := PreflightRequest(ctx, config); err != nil {
		common.LogError(ctx, "preflight check failed: "+err.Error())
		return nil, fmt.Errorf("preflight check failed: %w", err)
	}

	// 创建TOS客户端
	client, err := tos.NewClientV2(req.Endpoint,
		tos.WithRegion(req.Region),
		tos.WithCredentials(tos.NewStaticCredentials(req.AccessKey, req.SecretKey)))
	if err != nil {
		common.LogError(ctx, "failed to create TOS client: "+err.Error())
		return nil, fmt.Errorf("failed to create TOS client: %w", err)
	}
	// 根据HTTP方法设置对应的枚举值
	var httpMethod enum.HttpMethodType
	switch req.Method {
	case "GET":
		httpMethod = enum.HttpMethodGet
	case "HEAD":
		httpMethod = enum.HttpMethodHead
	case "PUT":
		httpMethod = enum.HttpMethodPut
	case "DELETE":
		httpMethod = enum.HttpMethodDelete
	default:
		return nil, fmt.Errorf("unsupported HTTP method: %s", req.Method)
	}

	// 生成预签名URL
	presignedURL, err := client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: httpMethod,
		Bucket:     req.BucketName,
		Key:        req.ObjectKey,
		Expires:    req.Expires,
	})
	if err != nil {
		common.LogError(ctx, "failed to generate pre-signed URL: "+err.Error())
		return nil, fmt.Errorf("failed to generate pre-signed URL: %w", err)
	}
	common.LogInfo(ctx, fmt.Sprintf("%+v", req))
	common.LogInfo(ctx, fmt.Sprintf("Generated pre-signed URL for bucket: %s, object: %s, method: %s presigned_url: %s", req.BucketName, req.ObjectKey, req.Method, presignedURL.SignedUrl))

	return &PresignResponse{
		PresignedURL: presignedURL.SignedUrl,
		Expires:      req.Expires,
		BucketName:   req.BucketName,
		ObjectName:   req.ObjectKey,
		Method:       req.Method,
	}, nil
}
