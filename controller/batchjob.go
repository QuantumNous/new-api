package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"one-api/common"
	"one-api/model"
	"one-api/relay/channel/volcengine/batchjob"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/ark"
	"github.com/volcengine/volcengine-go-sdk/volcengine"
	"github.com/volcengine/volcengine-go-sdk/volcengine/credentials"
	"github.com/volcengine/volcengine-go-sdk/volcengine/session"
)

// Presign 生成预签名URL
func Presign(c *gin.Context) {
	// 获取 token 信息
	tokenKey := c.GetString("token_key")
	tokenID := c.GetInt("token_id")
	userID := c.GetInt("id")

	if tokenKey == "" || tokenID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Token information not found",
		})
		return
	}

	// 从URL参数中获取参数
	objectKey := c.Query("object_key")
	method := c.Query("method")

	if objectKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "object_key parameter is required",
		})
		return
	}

	// 获取用户组信息
	group := c.GetString("group")
	if group == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "User group not found",
		})
		return
	}

	originalModel := c.GetString("original_model")
	channel, err := getChannel(c, group, originalModel, 1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	presign := batchjob.PresignRequest{}
	err = json.Unmarshal([]byte(channel.Key), &presign)
	if err != nil {
		common.LogError(c, err.Error()+" channel.Key: "+channel.Key)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	presign.ObjectKey = objectKey
	presign.Method = method

	// 检查必要的配置
	if presign.AccessKey == "" || presign.SecretKey == "" ||
		presign.Endpoint == "" || presign.Region == "" ||
		presign.BucketName == "" || presign.ObjectKey == "" ||
		presign.Method == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "TOS configuration is incomplete. Please check environment variables: TOS_ACCESS_KEY, TOS_SECRET_KEY, TOS_ENDPOINT, TOS_REGION, TOS_BUCKET_NAME",
		})
		return
	}

	if presign.Method == "PUT" {
		// 获取当前时间，格式为 YYYYMMDD
		now := time.Now()
		dateStr := now.Format("20060102")
		userLocation := fmt.Sprintf("%d_%d_%s", userID, tokenID, tokenKey[:8])

		// 生成完整的 objectKey
		fullObjectKey := fmt.Sprintf("%s/%s/%s", dateStr, userLocation, objectKey)
		presign.ObjectKey = fullObjectKey
	} else {
		presign.ObjectKey = objectKey
	}

	// 生成预签名URL
	resp, err := batchjob.GeneratePresignedURL(c.Request.Context(), &presign)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to generate pre-signed URL: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    resp,
	})
}

type RegisterJobRequest struct {
	JobName          string `json:"job_name"`
	JobDescription   string `json:"job_description"`
	ModelName        string `json:"model_name"`
	ObjectKey        string `json:"object_key"`
	CompletionWindow string `json:"completion_window"`
	Tags             string `json:"tags"`
	DryRun           bool   `json:"dry_run"`
}

func RegisterJob(c *gin.Context) {

	tokenID := c.GetInt("token_id")
	userID := c.GetInt("id")

	var req RegisterJobRequest
	err := c.BindJSON(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 获取用户组信息
	group := c.GetString("group")
	if group == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "User group not found",
		})
		return
	}

	originalModel := c.GetString("original_model")
	channel, err := getChannel(c, group, originalModel, 1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	job := &model.BatchJob{}
	err = json.Unmarshal([]byte(channel.Key), job)
	if err != nil {
		common.LogError(c, err.Error()+" channel.Key: "+channel.Key)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	job.JobName = req.JobName
	job.JobDescription = req.JobDescription

	// 从最后一个-开始分割ModelName和ModelVersion
	lastDashIndex := strings.LastIndex(req.ModelName, "-")
	if lastDashIndex != -1 {
		job.ModelName = req.ModelName[:lastDashIndex]
		job.ModelVersion = req.ModelName[lastDashIndex+1:]
	} else {
		job.ModelName = req.ModelName
		job.ModelVersion = ""
	}

	// 获取当前时间，格式为 YYYYMMDD
	// 让 GORM 自动处理 CreatedAt 和 UpdatedAt
	now := time.Now()
	dateStr := now.Format("20060102")
	tokenKey := c.GetString("token_key")
	userLocation := fmt.Sprintf("%d_%d_%s", userID, tokenID, tokenKey[:8])

	// 生成完整的 objectKey
	job.InputPath = fmt.Sprintf("%s/%s", dateStr, userLocation)
	job.OutputPath = job.InputPath

	if req.CompletionWindow != "" {
		job.CompletionWindow = req.CompletionWindow
	} else {
		job.CompletionWindow = "1d"
	}

	job.Tags = req.Tags

	job.UserID = userID
	job.TokenID = tokenID
	job.ChannelID = channel.Id
	job.Model = originalModel
	job.ObjectKey = req.ObjectKey
	job.Status = "registered"

	presign := batchjob.PresignRequest{}
	err = json.Unmarshal([]byte(channel.Key), &presign)
	if err != nil {
		common.LogError(c, err.Error()+" channel.Key: "+channel.Key)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	presign.ObjectKey = job.InputPath + "/" + job.ObjectKey

	type BatchJobPresignResponse struct {
		Method       string `json:"method"`
		PresignedURL string `json:"presigned_url"`
		Expires      int64  `json:"expires"`
	}

	presignResponse := []BatchJobPresignResponse{}

	for _, v := range []string{"GET", "PUT", "DELETE", "HEAD"} {
		presign.Method = v
		// 生成预签名URL
		resp, err := batchjob.GeneratePresignedURL(c.Request.Context(), &presign)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to generate pre-signed URL: " + err.Error(),
			})
			return
		}
		presignResponse = append(presignResponse, BatchJobPresignResponse{
			Method:       v,
			PresignedURL: resp.PresignedURL,
			Expires:      resp.Expires,
		})
	}

	err = model.DB.Create(job).Error
	if err != nil {
		common.LogError(c, "Failed to create batch job: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create batch job: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "注册任务成功，请使用预签名URL上传数据",
		"job":     job,
		"presign": presignResponse,
	})

}

func StartJob(c *gin.Context) {
	jobIndex := c.Query("job_index")
	if jobIndex == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "job_index is required",
		})
		return
	}
	tokenID := c.GetInt("token_id")
	userID := c.GetInt("id")

	job := &model.BatchJob{}
	err := model.DB.Where("id = ? and user_id = ? and token_id = ?", jobIndex, userID, tokenID).First(job).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get batch job: " + err.Error(),
		})
		return
	}

	if job.Status == "registered" {

		channel := &model.Channel{}
		err := model.DB.Where("id = ? ", job.ChannelID).First(channel).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to get batch job: " + err.Error(),
			})
			return
		}

		type batchJobKeyInfo struct {
			AccessKey   string `json:"access_key"`
			SecretKey   string `json:"secret_key"`
			Region      string `json:"region"`
			BucketName  string `json:"bucket_name"`
			Endpoint    string `json:"endpoint"`
			ProjectName string `json:"project_name"`
		}
		var keyInfo batchJobKeyInfo
		err = json.Unmarshal([]byte(channel.Key), &keyInfo)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to get batch job: " + err.Error(),
			})
			return
		}

		ak, sk, region := keyInfo.AccessKey, keyInfo.SecretKey, keyInfo.Region
		common.LogInfo(c, "ak: "+ak+" sk: "+sk+" region: "+region)
		config := volcengine.NewConfig().
			WithRegion(region).
			WithCredentials(credentials.NewStaticCredentials(ak, sk, "")).
			WithHTTPClient(&http.Client{
				Timeout: 300 * time.Second,
			})
		sess, err := session.NewSession(config)
		if err != nil {
			common.LogError(c, "Failed to create session: "+err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to create session: " + err.Error(),
			})
			return
		}
		svc := ark.New(sess)

		tags := []*ark.TagForCreateBatchInferenceJobInput{}
		if job.Tags != "" {
			var tagsMap map[string]string
			err := json.Unmarshal([]byte(job.Tags), &tagsMap)
			if err != nil {
				common.LogError(c, "Failed to parse tags JSON: "+err.Error())
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"message": "Invalid tags format, expected JSON: " + err.Error(),
				})
				return
			}
			for key, value := range tagsMap {
				tags = append(tags, &ark.TagForCreateBatchInferenceJobInput{
					Key:   volcengine.String(key),
					Value: volcengine.String(value),
				})
			}
		}
		createBatchInferenceJobInput := &ark.CreateBatchInferenceJobInput{
			ProjectName:      volcengine.String(keyInfo.ProjectName),
			Description:      volcengine.String(job.JobDescription),
			CompletionWindow: volcengine.String(job.CompletionWindow),
			InputFileTosLocation: &ark.InputFileTosLocationForCreateBatchInferenceJobInput{
				BucketName: volcengine.String(keyInfo.BucketName),
				ObjectKey:  volcengine.String(job.InputPath + "/" + job.ObjectKey),
			},
			OutputDirTosLocation: &ark.OutputDirTosLocationForCreateBatchInferenceJobInput{
				BucketName: volcengine.String(keyInfo.BucketName),
				ObjectKey:  volcengine.String(job.OutputPath + "/"),
			},
			ModelReference: &ark.ModelReferenceForCreateBatchInferenceJobInput{
				FoundationModel: &ark.FoundationModelForCreateBatchInferenceJobInput{
					Name:         volcengine.String(job.ModelName),
					ModelVersion: volcengine.String(job.ModelVersion),
				},
			},
			Name:   volcengine.String(job.JobName),
			DryRun: volcengine.Bool(job.DryRun),
			Tags:   tags,
		}

		common.LogInfo(c, "createBatchInferenceJobInput: "+fmt.Sprintf("%+v", createBatchInferenceJobInput))
		createBatchInferenceJobInput.DryRun = volcengine.Bool(true)
		var resp *ark.CreateBatchInferenceJobOutput
		resp, err = svc.CreateBatchInferenceJob(createBatchInferenceJobInput)
		if err != nil && !strings.Contains(err.Error(), "The request is validated by a dryrun operation") {
			// 复制代码运行示例，请自行打印API错误信息。
			common.LogError(c, "Failed to create batch inference job: "+err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to create batch inference job: " + err.Error(),
			})
			return
		}
		common.LogInfo(c, "DryRun resp: "+fmt.Sprintf("%+v", resp))
		createBatchInferenceJobInput.DryRun = volcengine.Bool(false)
		resp, err = svc.CreateBatchInferenceJob(createBatchInferenceJobInput)
		if err != nil {
			common.LogError(c, "Failed to create batch inference job: "+err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to create batch inference job: " + err.Error(),
			})
			return
		}
		job.JobID = *resp.Id
		common.LogInfo(c, "Batch job created successfully, job ID: "+*resp.Id)
		job.Status = "running"
		err = model.DB.Save(job).Error
		if err != nil {
			common.LogError(c, "Failed to start batch job: "+err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to start batch job: " + err.Error(),
			})
			return
		}
	} else {
		common.LogError(c, "Batch job is not registered")
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Batch job is not registered",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Batch job started successfully",
		"job":     job,
	})
}

func tmain() {
	// 注意示例代码安全，代码泄漏会导致AK/SK泄漏，有极大的安全风险。
	ak, sk, region := "YOUR_ACCESS_KEY", "YOUR_SECRET_KEY", "cn-beijing"
	config := volcengine.NewConfig().
		WithRegion(region).
		WithCredentials(credentials.NewStaticCredentials(ak, sk, ""))
	sess, err := session.NewSession(config)
	if err != nil {
		panic(err)
	}
	svc := ark.New(sess)
	reqInputFileTosLocation := &ark.InputFileTosLocationForCreateBatchInferenceJobInput{
		BucketName: volcengine.String("batch-job-jiang"),
		ObjectKey:  volcengine.String("20250716/1_4_mf1QQZfU/2_d.jsonl"),
	}
	reqFoundationModel := &ark.FoundationModelForCreateBatchInferenceJobInput{
		ModelVersion: volcengine.String("250428"),
		Name:         volcengine.String("doubao-1-5-thinking-vision-pro"),
	}
	reqModelReference := &ark.ModelReferenceForCreateBatchInferenceJobInput{
		FoundationModel: reqFoundationModel,
	}
	reqOutputDirTosLocation := &ark.OutputDirTosLocationForCreateBatchInferenceJobInput{
		BucketName: volcengine.String("batch-job-jiang"),
		ObjectKey:  volcengine.String("20250716/1_4_mf1QQZfU/"),
	}
	createBatchInferenceJobInput := &ark.CreateBatchInferenceJobInput{
		CompletionWindow:     volcengine.String("1d"),
		Description:          volcengine.String("test"),
		DryRun:               volcengine.Bool(true),
		InputFileTosLocation: reqInputFileTosLocation,
		ModelReference:       reqModelReference,
		Name:                 volcengine.String("test"),
		OutputDirTosLocation: reqOutputDirTosLocation,
		ProjectName:          volcengine.String("jiang"),
	}

	common.LogInfo(context.Background(), "createBatchInferenceJobInput: "+fmt.Sprintf("%+v", createBatchInferenceJobInput))
	// 复制代码运行示例，请自行打印API返回值。
	_, err = svc.CreateBatchInferenceJob(createBatchInferenceJobInput)
	if err != nil {
		// 复制代码运行示例，请自行打印API错误信息。
		panic(err)
	}
}
