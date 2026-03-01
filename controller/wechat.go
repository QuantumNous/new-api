package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

type wechatLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

func getWeChatIdByCode(code string) (string, error) {
	if code == "" {
		return "", errors.New("无效的参数")
	}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/wechat/user?code=%s", common.WeChatServerAddress, code), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", common.WeChatServerToken)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer httpResponse.Body.Close()
	var res wechatLoginResponse
	err = json.NewDecoder(httpResponse.Body).Decode(&res)
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

func WeChatAuth(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		c.JSON(http.StatusOK, dto.ApiResponse{Message: "管理员未开启通过微信登录以及注册"})
		return
	}
	code := c.Query("code")
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		c.JSON(http.StatusOK, dto.ApiResponse{Message: err.Error()})
		return
	}
	user := model.User{
		WeChatId: wechatId,
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		err := user.FillUserByWeChatId()
		if err != nil {
			c.JSON(http.StatusOK, dto.ApiResponse{Message: err.Error()})
			return
		}
		if user.Id == 0 {
			c.JSON(http.StatusOK, dto.ApiResponse{Message: "用户已注销"})
			return
		}
	} else {
		if common.RegisterEnabled {
			user.Username = "wechat_" + strconv.Itoa(model.GetMaxUserId()+1)
			user.DisplayName = "WeChat User"
			user.Role = common.RoleCommonUser
			user.Status = common.UserStatusEnabled

			if err := user.Insert(0); err != nil {
				c.JSON(http.StatusOK, dto.ApiResponse{Message: err.Error()})
				return
			}
		} else {
			c.JSON(http.StatusOK, dto.ApiResponse{Message: "管理员关闭了新用户注册"})
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusOK, dto.ApiResponse{Message: "用户已被封禁"})
		return
	}
	setupLogin(&user, c)
}

func WeChatBind(c fuego.ContextWithParams[dto.WeChatBindParams]) (dto.MessageResponse, error) {
	if !common.WeChatAuthEnabled {
		return dto.FailMsg("管理员未开启通过微信登录以及注册")
	}
	p, err := dto.ParseParams[dto.WeChatBindParams](c)
	if err != nil {
		return dto.FailMsg("参数错误")
	}
	wechatId, err := getWeChatIdByCode(p.Code)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		return dto.FailMsg("该微信账号已被绑定")
	}
	ginCtx := dto.GinCtx(c)
	session := sessions.Default(ginCtx)
	idVal := session.Get("id")
	userId, ok := idVal.(int)
	if !ok || userId <= 0 {
		return dto.FailMsg("未登录或会话已失效")
	}
	user := model.User{
		Id: userId,
	}
	if err = user.FillUserById(); err != nil {
		return dto.FailMsg(err.Error())
	}
	user.WeChatId = wechatId
	if err = user.Update(false); err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}
