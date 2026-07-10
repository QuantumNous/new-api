package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/bytedance/gopkg/util/gopool"
	lark "github.com/larksuite/oapi-sdk-go/v3"
	larkcontact "github.com/larksuite/oapi-sdk-go/v3/service/contact/v3"
)

type FeishuUserInfoSyncResult struct {
	Total   int      `json:"total"`
	Success int      `json:"success"`
	Skipped int      `json:"skipped"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors,omitempty"`
}

type feishuDepartmentInfo struct {
	ID       string
	Name     string
	ParentID string
}

type feishuOrgPathInfo struct {
	Path       string
	Level1Name string
	Level2Name string
}

var feishuUserInfoSyncOnce sync.Once

func StartFeishuUserInfoSyncTask() {
	feishuUserInfoSyncOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				runFeishuUserInfoSyncIfNeeded()
			}
		})
	})
}

func runFeishuUserInfoSyncIfNeeded() {
	now := time.Now()
	if now.Hour() != 2 || now.Minute() != 0 {
		return
	}
	common.SysLog("feishu user info sync: start daily sync")
	result := SyncFeishuUserInfo(context.Background())
	common.SysLog(fmt.Sprintf("feishu user info sync: completed daily sync, total=%d success=%d skipped=%d failed=%d", result.Total, result.Success, result.Skipped, result.Failed))
}

func SyncOneFeishuUserInfoByOpenID(ctx context.Context, user *model.User, openID string) error {
	settings := system_setting.GetFeishuSettings()
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		return fmt.Errorf("feishu app_id/app_secret is not configured")
	}
	client := lark.NewClient(appID, appSecret)
	return syncOneFeishuUserInfo(ctx, client, user, openID)
}

func SyncFeishuUserInfo(ctx context.Context) FeishuUserInfoSyncResult {
	result := FeishuUserInfoSyncResult{Errors: make([]string, 0)}
	settings := system_setting.GetFeishuSettings()
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		result.Errors = append(result.Errors, "feishu app_id/app_secret is not configured")
		return result
	}

	var users []model.User
	if err := model.DB.
		Where("feishu_id <> ?", "").
		Where("status = ?", common.UserStatusEnabled).
		Find(&users).Error; err != nil {
		result.Errors = append(result.Errors, err.Error())
		return result
	}

	client := lark.NewClient(appID, appSecret)
	result.Total = len(users)
	for _, user := range users {
		openID := strings.TrimSpace(user.FeishuId)
		if openID == "" {
			result.Skipped++
			continue
		}
		if err := syncOneFeishuUserInfo(ctx, client, &user, openID); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("user %d: %s", user.Id, err.Error()))
			continue
		}
		result.Success++
	}
	return result
}

func syncOneFeishuUserInfo(ctx context.Context, client *lark.Client, user *model.User, openID string) error {
	req := larkcontact.NewGetUserReqBuilder().
		UserId(openID).
		UserIdType("open_id").
		DepartmentIdType("open_department_id").
		Build()
	resp, err := client.Contact.User.Get(ctx, req)
	if err != nil {
		return err
	}
	if !resp.Success() {
		return fmt.Errorf("feishu get user failed: code=%d msg=%s", resp.Code, resp.Msg)
	}
	if resp.Data == nil || resp.Data.User == nil {
		return fmt.Errorf("feishu user not found")
	}

	feishuUser := resp.Data.User
	departmentID := ""
	if len(feishuUser.DepartmentIds) > 0 {
		departmentID = strings.TrimSpace(feishuUser.DepartmentIds[0])
	}
	department := feishuDepartmentInfo{ID: departmentID}
	if departmentID != "" {
		got, deptErr := getFeishuDepartmentInfo(ctx, client, departmentID)
		if deptErr == nil {
			department = got
		}
	}

	parent := feishuDepartmentInfo{ID: department.ParentID}
	if department.ParentID != "" && department.ParentID != "0" {
		got, deptErr := getFeishuDepartmentInfo(ctx, client, department.ParentID)
		if deptErr == nil {
			parent = got
		}
	}

	orgPath := feishuOrgPathInfo{}
	if department.ID != "" {
		orgPath = buildFeishuOrgPath(ctx, client, department)
	}

	updates := map[string]any{
		"feishu_id":                     strings.TrimSpace(openID),
		"feishu_department_id":          department.ID,
		"feishu_department_name":        department.Name,
		"feishu_parent_department_id":   parent.ID,
		"feishu_parent_department_name": parent.Name,
		"feishu_employment_status":      formatFeishuEmploymentStatus(feishuUser.Status),
		"feishu_synced_at":              common.GetTimestamp(),
		"org_path":                      orgPath.Path,
		"org_level1_name":               orgPath.Level1Name,
		"org_level2_name":               orgPath.Level2Name,
	}
	membership := FeishuUserGroupMembership{}
	if catalog, catalogErr := FetchFeishuGroupCatalog(); catalogErr == nil {
		if got, groupErr := FetchFeishuUserGroupMembershipDetail(openID, catalog); groupErr == nil {
			membership = got
			for key, value := range BuildFeishuUserGroupMembershipUpdates(membership) {
				updates[key] = value
			}
		} else if groupErr != feishuNotConfiguredErr {
			common.SysLog(fmt.Sprintf("feishu user info sync: fetch user groups failed for user %d: %s", user.Id, groupErr.Error()))
		}
	} else if catalogErr != feishuNotConfiguredErr {
		common.SysLog(fmt.Sprintf("feishu user info sync: fetch group catalog failed for user %d: %s", user.Id, catalogErr.Error()))
	}
	if feishuUser.UserId != nil && strings.TrimSpace(*feishuUser.UserId) != "" {
		updates["feishu_user_id"] = strings.TrimSpace(*feishuUser.UserId)
	}
	if feishuUser.UnionId != nil && strings.TrimSpace(*feishuUser.UnionId) != "" {
		updates["feishu_union_id"] = strings.TrimSpace(*feishuUser.UnionId)
	}
	if feishuUser.JobTitle != nil {
		updates["job_title"] = strings.TrimSpace(*feishuUser.JobTitle)
	}
	if feishuUser.EmployeeNo != nil {
		updates["feishu_employee_no"] = strings.TrimSpace(*feishuUser.EmployeeNo)
	}
	if department.Name != "" {
		updates["org_name"] = department.Name
	}

	// 离职用户自动禁用系统账号
	if isFeishuUserResigned(feishuUser.Status) {
		updates["status"] = common.UserStatusDisabled
	}

	err = model.DB.Model(user).Updates(updates).Error
	if err != nil {
		return err
	}

	oldGroup := user.Group
	jobTitle, _ := updates["job_title"].(string)
	agCtx := AutoGroupContext{
		UserId:               user.Id,
		FeishuOpenId:         strings.TrimSpace(openID),
		CurrentGroup:         oldGroup,
		ManualGroupLocked:    user.ManualGroupLocked,
		JobTitle:             jobTitle,
		OrgLevel1Name:        orgPath.Level1Name,
		OrgLevel2Name:        orgPath.Level2Name,
		DepartmentName:       department.Name,
		ParentDepartmentName: parent.Name,
		OrgPath:              orgPath.Path,
	}
	if len(membership.Ids) > 0 || len(membership.Names) > 0 {
		agCtx.FeishuGroupIds = membership.Ids
		agCtx.FeishuGroupNames = membership.Names
	}
	decision := ClassifyAutoGroup(agCtx)
	if decision.Action == model.AutoGroupActionAutoApply && decision.SuggestedGroup != "" && decision.SuggestedGroup != oldGroup {
		if err := ApplyAutoGroupChange(user.Id, oldGroup, decision.SuggestedGroup); err == nil {
			user.Group = decision.SuggestedGroup
		}
	}

	// 状态变更后刷新缓存
	if _, ok := updates["status"]; ok {
		_ = model.InvalidateUserCache(user.Id)
	}
	return nil
}

func getFeishuDepartmentInfo(ctx context.Context, client *lark.Client, departmentID string) (feishuDepartmentInfo, error) {
	departmentID = strings.TrimSpace(departmentID)
	if departmentID == "" {
		return feishuDepartmentInfo{}, nil
	}
	req := larkcontact.NewGetDepartmentReqBuilder().
		DepartmentId(departmentID).
		DepartmentIdType("open_department_id").
		UserIdType("open_id").
		Build()
	resp, err := client.Contact.Department.Get(ctx, req)
	if err != nil {
		return feishuDepartmentInfo{}, err
	}
	if !resp.Success() {
		return feishuDepartmentInfo{}, fmt.Errorf("feishu get department failed: code=%d msg=%s", resp.Code, resp.Msg)
	}
	if resp.Data == nil || resp.Data.Department == nil {
		return feishuDepartmentInfo{ID: departmentID}, nil
	}
	dept := resp.Data.Department
	info := feishuDepartmentInfo{ID: departmentID}
	if dept.OpenDepartmentId != nil && strings.TrimSpace(*dept.OpenDepartmentId) != "" {
		info.ID = strings.TrimSpace(*dept.OpenDepartmentId)
	}
	if dept.Name != nil {
		info.Name = strings.TrimSpace(*dept.Name)
	}
	if dept.ParentDepartmentId != nil {
		info.ParentID = strings.TrimSpace(*dept.ParentDepartmentId)
	}
	return info, nil
}

func buildFeishuOrgPath(ctx context.Context, client *lark.Client, current feishuDepartmentInfo) feishuOrgPathInfo {
	departments := make([]feishuDepartmentInfo, 0, 8)
	visited := make(map[string]bool)
	department := current
	for department.ID != "" && !visited[department.ID] {
		visited[department.ID] = true
		if department.Name != "" {
			departments = append(departments, department)
		}
		if department.ParentID == "" || department.ParentID == "0" {
			break
		}
		parent, err := getFeishuDepartmentInfo(ctx, client, department.ParentID)
		if err != nil {
			break
		}
		department = parent
	}

	names := make([]string, 0, len(departments))
	for i := len(departments) - 1; i >= 0; i-- {
		name := strings.TrimSpace(departments[i].Name)
		if name != "" {
			names = append(names, name)
		}
	}
	info := feishuOrgPathInfo{Path: strings.Join(names, "/")}
	if len(names) > 0 {
		info.Level1Name = names[0]
	}
	if len(names) > 1 {
		info.Level2Name = names[1]
	}
	return info
}

func formatFeishuEmploymentStatus(status *larkcontact.UserStatus) string {
	if status == nil {
		return "unknown"
	}
	states := make([]string, 0, 4)
	if status.IsActivated != nil && *status.IsActivated {
		states = append(states, "activated")
	}
	if status.IsFrozen != nil && *status.IsFrozen {
		states = append(states, "frozen")
	}
	if status.IsResigned != nil && *status.IsResigned {
		states = append(states, "resigned")
	}
	if status.IsExited != nil && *status.IsExited {
		states = append(states, "exited")
	}
	if status.IsUnjoin != nil && *status.IsUnjoin {
		states = append(states, "unjoin")
	}
	if len(states) == 0 {
		return "unknown"
	}
	return strings.Join(states, ",")
}

func isFeishuUserResigned(status *larkcontact.UserStatus) bool {
	if status == nil {
		return false
	}
	if status.IsResigned != nil && *status.IsResigned {
		return true
	}
	if status.IsExited != nil && *status.IsExited {
		return true
	}
	return false
}
