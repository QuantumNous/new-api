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

type FeishuGroupInfo struct {
	Id      string `json:"id"`
	GroupId string `json:"group_id"`
	Name    string `json:"name"`
}

func FetchFeishuGroupCatalog() (map[string]FeishuGroupInfo, error) {
	settings := system_setting.GetFeishuSettings()
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		return nil, feishuNotConfiguredErr
	}
	client := lark.NewClient(appID, appSecret)
	catalog := map[string]FeishuGroupInfo{}
	for _, groupType := range []int{larkcontact.GroupTypeSimplelistGroupAssign, larkcontact.GroupTypeSimplelistGroupDynamic} {
		pageToken := ""
		for {
			builder := larkcontact.NewSimplelistGroupReqBuilder().PageSize(100).Type(groupType)
			if pageToken != "" {
				builder.PageToken(pageToken)
			}
			resp, err := client.Contact.Group.Simplelist(context.Background(), builder.Build())
			if err != nil {
				return nil, err
			}
			if !resp.Success() {
				return nil, fmt.Errorf("feishu list user groups failed: code=%d msg=%s", resp.Code, resp.Msg)
			}
			if resp.Data != nil {
				for _, group := range resp.Data.Grouplist {
					if group == nil {
						continue
					}
					info := FeishuGroupInfo{}
					if group.Id != nil {
						info.Id = strings.TrimSpace(*group.Id)
					}
					if group.GroupId != nil {
						info.GroupId = strings.TrimSpace(*group.GroupId)
					}
					if group.Name != nil {
						info.Name = strings.TrimSpace(*group.Name)
					}
					for _, key := range []string{info.Id, info.GroupId, info.Name} {
						if key != "" {
							catalog[key] = info
						}
					}
				}
				if resp.Data.HasMore != nil && *resp.Data.HasMore && resp.Data.PageToken != nil {
					pageToken = *resp.Data.PageToken
					continue
				}
			}
			break
		}
	}
	return catalog, nil
}

func FetchFeishuUserGroupMembership(feishuOpenId string, catalog map[string]FeishuGroupInfo) ([]string, []string, error) {
	feishuOpenId = strings.TrimSpace(feishuOpenId)
	if feishuOpenId == "" {
		return nil, nil, fmt.Errorf("feishu open id is empty")
	}
	settings := system_setting.GetFeishuSettings()
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		return nil, nil, feishuNotConfiguredErr
	}
	client := lark.NewClient(appID, appSecret)
	ids := make([]string, 0)
	names := make([]string, 0)
	for _, groupType := range []int{larkcontact.ListMemberGroupsGroupTypeAssign, larkcontact.ListMemberGroupsGroupTypeDynamic} {
		pageToken := ""
		for {
			builder := larkcontact.NewMemberBelongGroupReqBuilder().
				MemberId(feishuOpenId).
				MemberIdType(larkcontact.ListMemberGroupsMemberIDTypeOpenID).
				GroupType(groupType).
				PageSize(1000)
			if pageToken != "" {
				builder.PageToken(pageToken)
			}
			resp, err := client.Contact.Group.MemberBelong(context.Background(), builder.Build())
			if err != nil {
				return nil, nil, err
			}
			if !resp.Success() {
				return nil, nil, fmt.Errorf("feishu get user groups failed: code=%d msg=%s", resp.Code, resp.Msg)
			}
			if resp.Data != nil {
				for _, rawGroupId := range resp.Data.GroupList {
					groupId := strings.TrimSpace(rawGroupId)
					if groupId == "" {
						continue
					}
					ids = append(ids, groupId)
					if info, ok := catalog[groupId]; ok {
						if info.GroupId != "" && info.GroupId != groupId {
							ids = append(ids, info.GroupId)
						}
						if info.Name != "" {
							names = append(names, info.Name)
						}
					}
				}
				if resp.Data.HasMore != nil && *resp.Data.HasMore && resp.Data.PageToken != nil {
					pageToken = *resp.Data.PageToken
					continue
				}
			}
			break
		}
	}
	return dedupeStrings(ids), dedupeStrings(names), nil
}

func dedupeStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
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
		jobTitle = ""
	}
	// 拉到 job_title 后顺便写入用户表（首次创建时可能还没同步过）
	if strings.TrimSpace(jobTitle) != "" {
		if uerr := model.DB.Model(&model.User{}).Where("id = ?", userId).
			Update("job_title", jobTitle).Error; uerr != nil {
			common.SysLog(fmt.Sprintf("auto-group: update job_title failed for user %d: %s", userId, uerr.Error()))
		}
	}
	ctx := AutoGroupContext{UserId: userId, FeishuOpenId: feishuId, CurrentGroup: currentGroup, JobTitle: jobTitle}
	catalog, catalogErr := FetchFeishuGroupCatalog()
	if catalogErr == nil {
		groupIds, groupNames, groupErr := FetchFeishuUserGroupMembership(feishuId, catalog)
		if groupErr == nil {
			ctx.FeishuGroupIds = groupIds
			ctx.FeishuGroupNames = groupNames
		}
	}
	decision := ClassifyAutoGroup(ctx)
	if decision.Action == model.AutoGroupActionAutoApply && decision.SuggestedGroup != "" {
		if applyErr := ApplyAutoGroupChange(userId, currentGroup, decision.SuggestedGroup); applyErr == nil {
			return decision.SuggestedGroup
		}
	}
	return currentGroup
}
