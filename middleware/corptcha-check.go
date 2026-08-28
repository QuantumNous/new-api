package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type corptchaVerifyResponse struct {
	Success   bool   `json:"success"`
	SiteID    string `json:"siteId"`
	Purpose   string `json:"purpose"`
	RiskLevel string `json:"riskLevel"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}

// CorptchaCheck Corptcha 人机验证二次校验：
// 前端验证通过后返回一次性令牌 token，服务端携带站点密钥请求验证服务核验，
// 令牌只能被成功核验一次，重复使用会返回 TOKEN_NOT_FOUND。
func CorptchaCheck(scene CaptchaScene) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.CorptchaCheckEnabled {
			c.Next()
			return
		}
		token := c.Query("corptcha")
		if token == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Corptcha 校验参数缺失，请刷新重试！",
			})
			c.Abort()
			return
		}
		payload, err := json.Marshal(map[string]string{
			"token":   token,
			"purpose": string(scene),
			"siteKey": common.CorptchaSiteId,
		})
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		verifyURL := common.CorptchaApiServer + "/v1/verify"
		req, err := http.NewRequest(http.MethodPost, verifyURL, bytes.NewReader(payload))
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		req.Header.Set("content-type", "application/json")
		req.Header.Set("authorization", "Bearer "+common.CorptchaSecret)
		client := &http.Client{Timeout: 5 * time.Second}
		rawRes, err := client.Do(req)
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		defer rawRes.Body.Close()
		rawBody, err := io.ReadAll(rawRes.Body)
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		var res corptchaVerifyResponse
		err = json.Unmarshal(rawBody, &res)
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		if rawRes.StatusCode < http.StatusOK || rawRes.StatusCode >= http.StatusMultipleChoices || !res.Success {
			code := res.ErrorCode
			if code == "" {
				code = res.Message
			}
			common.SysLog("Corptcha verify failed: status=" + strconv.Itoa(rawRes.StatusCode) + " code=" + code + " body=" + string(rawBody))
			msg := "Corptcha 校验失败，请刷新重试！"
			if code != "" {
				msg = "Corptcha 校验失败（" + code + "），请刷新重试！"
			}
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": msg,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
