package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type geeTestValidateResponse struct {
	Status string `json:"status"`
	Result string `json:"result"`
	Reason string `json:"reason"`
}

// GeeTestCheck 极验行为验证（第四代）二次校验：
// 前端验证通过后携带 lot_number / captcha_output / pass_token / gen_time，
// 服务端使用 captcha_key 对 lot_number 计算 HMAC-SHA256 签名后请求极验 validate 接口校验。
func GeeTestCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.GeeTestCheckEnabled {
			c.Next()
			return
		}
		lotNumber := c.Query("lot_number")
		captchaOutput := c.Query("captcha_output")
		passToken := c.Query("pass_token")
		genTime := c.Query("gen_time")
		if lotNumber == "" || captchaOutput == "" || passToken == "" || genTime == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "GeeTest 校验参数缺失，请刷新重试！",
			})
			c.Abort()
			return
		}
		mac := hmac.New(sha256.New, []byte(common.GeeTestCaptchaKey))
		mac.Write([]byte(lotNumber))
		signToken := hex.EncodeToString(mac.Sum(nil))

		validateURL := common.GeeTestApiServer + "/validate?captcha_id=" + url.QueryEscape(common.GeeTestCaptchaId)
		rawRes, err := http.PostForm(validateURL, url.Values{
			"lot_number":      {lotNumber},
			"captcha_output":  {captchaOutput},
			"pass_token":      {passToken},
			"gen_time":        {genTime},
			"sign_token":      {signToken},
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
		defer rawRes.Body.Close()
		var res geeTestValidateResponse
		err = common.DecodeJson(rawRes.Body, &res)
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		if res.Result != "success" {
			common.SysLog("GeeTest validate failed: " + res.Reason)
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "GeeTest 校验失败，请刷新重试！",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
