package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type qqLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

type qqBindRequest struct {
	Code string `json:"code"`
}

type qqCreateRequest struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id"`
	Username      string `json:"username"`
	QQNumber      string `json:"qq_number"`
	QQAdminNumber string `json:"qq_admin_number"`
}

type qqUnbindRequest struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id"`
	Username      string `json:"username"`
	QQId          string `json:"qq_id"`
	QQNumber      string `json:"qq_number"`
	QQAdminNumber string `json:"qq_admin_number"`
}

func qqServiceURL(path string) string {
	return strings.TrimRight(common.QQCallbackAddress, "/") + path
}

func setQQServiceAuthHeader(req *http.Request) {
	if common.QQCallbackAccessToken != "" {
		req.Header.Set("Authorization", common.QQCallbackAccessToken)
		req.Header.Set("X-Access-Token", common.QQCallbackAccessToken)
	}
}

func getQQIdByCode(code string) (string, error) {
	if code == "" {
		return "", errors.New("无效的参数")
	}
	if common.QQCallbackAddress == "" {
		return "", errors.New("管理员未配置 QQ 服务地址")
	}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s?code=%s", qqServiceURL("/api/nachoai/user"), url.QueryEscape(code)), nil)
	if err != nil {
		return "", err
	}
	setQQServiceAuthHeader(req)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer httpResponse.Body.Close()
	var res qqLoginResponse
	err = common.DecodeJson(httpResponse.Body, &res)
	if err != nil {
		return "", err
	}
	if !res.Success {
		return "", errors.New(res.Message)
	}
	if res.Data == "" {
		return "", errors.New("验证码错误或已过期")
	}
	return res.Data, nil
}

func notifyQQServiceUnbind(user model.User, qqId string) error {
	if qqId == "" {
		return nil
	}
	if common.QQCallbackAddress == "" || common.QQCallbackAccessToken == "" {
		return errors.New("管理员未配置 QQ 服务地址或 accessToken")
	}
	payload, err := common.Marshal(qqUnbindRequest{
		Id:            user.Id,
		UserId:        user.Id,
		Username:      user.Username,
		QQId:          qqId,
		QQNumber:      common.QQNumber,
		QQAdminNumber: common.QQAdminNumber,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", qqServiceURL("/api/nachoai/delete"), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	setQQServiceAuthHeader(req)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		return err
	}
	defer httpResponse.Body.Close()
	if httpResponse.StatusCode < 200 || httpResponse.StatusCode >= 300 {
		return errors.New("通知 QQ 服务端解绑失败")
	}
	var res qqLoginResponse
	if err := common.DecodeJson(httpResponse.Body, &res); err == nil && !res.Success && res.Message != "" {
		return errors.New(res.Message)
	}
	return nil
}

func QQCreate(c *gin.Context) {
	if !common.QQAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员未开启 QQ 账户绑定",
			"success": false,
		})
		return
	}
	if common.QQCallbackAddress == "" || common.QQCallbackAccessToken == "" || common.QQNumber == "" || common.QQAdminNumber == "" {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员未配置 QQ 服务地址、accessToken、QQ 号或管理员 QQ",
			"success": false,
		})
		return
	}
	userId := c.GetInt("id")
	username := c.GetString("username")
	payload, err := common.Marshal(qqCreateRequest{
		Id:            userId,
		UserId:        userId,
		Username:      username,
		QQNumber:      common.QQNumber,
		QQAdminNumber: common.QQAdminNumber,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req, err := http.NewRequest("POST", qqServiceURL("/api/nachoai/create"), bytes.NewReader(payload))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	setQQServiceAuthHeader(req)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer httpResponse.Body.Close()
	if httpResponse.StatusCode < 200 || httpResponse.StatusCode >= 300 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "创建 QQ 绑定会话失败",
		})
		return
	}
	var res qqLoginResponse
	if err := common.DecodeJson(httpResponse.Body, &res); err == nil && !res.Success && res.Message != "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": res.Message,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"qq_number": common.QQNumber,
			"command":   fmt.Sprintf("/nachoai b %d", userId),
		},
	})
}

func QQBind(c *gin.Context) {
	if !common.QQAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员未开启 QQ 账户绑定",
			"success": false,
		})
		return
	}
	var req qqBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求",
		})
		return
	}
	qqId, err := getQQIdByCode(req.Code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	if model.IsQQIdAlreadyTaken(qqId) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该 QQ 账号已被绑定",
		})
		return
	}
	user := model.User{
		Id: c.GetInt("id"),
	}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.QQId = qqId
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"qq_id": qqId,
		},
	})
}
