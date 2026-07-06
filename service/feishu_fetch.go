package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcontact "github.com/larksuite/oapi-sdk-go/v3/service/contact/v3"
)

// feishuNotConfiguredErr 飞书未配置时的哨兵错误（不对外暴露，内部判断用）
var feishuNotConfiguredErr = fmt.Errorf("feishu app_id/app_secret is not configured")

// FetchFeishuJobTitle 拉取单个飞书用户的岗位（job_title）。
// feishuUserId 为用户的 open_id。
// 飞书未配置时返回 ("", feishuNotConfiguredErr)，调用方据此跳过。
func FetchFeishuJobTitle(feishuUserId string) (string, error) {
	feishuUserId = strings.TrimSpace(feishuUserId)
	if feishuUserId == "" {
		return "", fmt.Errorf("feishu user id is empty")
	}
	settings := system_setting.GetFeishuSettings()
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		return "", feishuNotConfiguredErr
	}
	client := lark.NewClient(appID, appSecret)

	req := larkcontact.NewGetUserReqBuilder().
		UserId(feishuUserId).
		UserIdType("open_id").
		Build()
	resp, err := client.Contact.User.Get(context.Background(), req)
	if err != nil {
		return "", err
	}
	if !resp.Success() {
		return "", fmt.Errorf("feishu get user failed: code=%d msg=%s", resp.Code, resp.Msg)
	}
	if resp.Data == nil || resp.Data.User == nil {
		return "", fmt.Errorf("feishu user not found")
	}
	if resp.Data.User.JobTitle == nil {
		return "", nil
	}
	return strings.TrimSpace(*resp.Data.User.JobTitle), nil
}

// TryAutoGroupOnUserCreate 在用户创建后尝试自动分组。
// 它会：拉取飞书岗位 -> 根据规则决策 -> 应用变更（含订阅同步）。
// 安全失败：任何错误（包括飞书未配置、网络超时、SDK panic）只记日志，不影响用户创建。
// 返回最终的 group。
func TryAutoGroupOnUserCreate(userId int, currentGroup, feishuId string) string {
	defer func() {
		if r := recover(); r != nil {
			common.SysLog(fmt.Sprintf("auto-group: panic during create for user %d: %v", userId, r))
		}
	}()
	jobTitle, err := FetchFeishuJobTitle(feishuId)
	if err != nil {
		// 飞书未配置或拉取失败，静默跳过（首次登录时拿不到 job_title 是正常的）
		if err != feishuNotConfiguredErr {
			common.SysLog(fmt.Sprintf("auto-group: fetch jobtitle failed for user %d: %s", userId, err.Error()))
		}
		return currentGroup
	}
	// 拉到 job_title 后顺便写入用户表（首次创建时可能还没同步过）
	if strings.TrimSpace(jobTitle) != "" {
		if uerr := model.DB.Model(&model.User{}).Where("id = ?", userId).
			Update("job_title", jobTitle).Error; uerr != nil {
			common.SysLog(fmt.Sprintf("auto-group: update job_title failed for user %d: %s", userId, uerr.Error()))
		}
	}
	finalGroup, _ := TryAutoGroupOnJobTitle(userId, currentGroup, jobTitle)
	return finalGroup
}
