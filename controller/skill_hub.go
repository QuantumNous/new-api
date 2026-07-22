package controller

import (
	"archive/zip"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type skillHubSkillRequest struct {
	ID          string                    `json:"id"`
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Version     string                    `json:"version"`
	Author      string                    `json:"author"`
	Origin      string                    `json:"origin"`
	OriginURL   string                    `json:"originUrl"`
	License     string                    `json:"license"`
	Icon        string                    `json:"icon"`
	Tags        []string                  `json:"tags"`
	Verified    bool                      `json:"verified"`
	Recommended bool                      `json:"recommended"`
	Published   bool                      `json:"published"`
	Status      *int                      `json:"status"`
	Sort        int                       `json:"sort"`
	Evaluation  *model.SkillHubEvaluation `json:"evaluation"`
	Testcases   *model.SkillHubTestcases  `json:"testcases"`
	Source      model.SkillHubSource      `json:"source"`
}

type skillHubReportRequest struct {
	RequestID   string `json:"requestId"`
	Description string `json:"description"`
}

type skillHubReportResolutionRequest struct {
	Status    string `json:"status"`
	AdminNote string `json:"adminNote"`
	Revision  int    `json:"revision"`
}

type skillHubTagRequest struct {
	Name string `json:"name"`
	Sort int    `json:"sort"`
}

type skillHubDirectUploadInitRequest struct {
	Kind     string `json:"kind"`
	SkillID  string `json:"skillId"`
	Version  string `json:"version"`
	FileName string `json:"fileName"`
	Size     int64  `json:"size"`
}

type skillHubDirectUploadCompleteRequest struct {
	UploadTicket string `json:"uploadTicket"`
}

type skillHubBatchRequest struct {
	IDs []string `json:"ids"`
}

type skillHubExportManifestItem struct {
	ID          string                    `json:"id"`
	Name        string                    `json:"name"`
	Description string                    `json:"description,omitempty"`
	Version     string                    `json:"version"`
	Author      string                    `json:"author,omitempty"`
	Origin      string                    `json:"origin,omitempty"`
	OriginURL   string                    `json:"originUrl,omitempty"`
	License     string                    `json:"license,omitempty"`
	Tags        []string                  `json:"tags,omitempty"`
	Verified    bool                      `json:"verified"`
	Recommended bool                      `json:"recommended"`
	Sort        int                       `json:"sort"`
	Zip         string                    `json:"zip"`
	Icon        string                    `json:"icon,omitempty"`
	Evaluation  *model.SkillHubEvaluation `json:"evaluation,omitempty"`
	Testcases   string                    `json:"testcases,omitempty"`
}

func ListSkillHubSkills(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	skills, total, err := model.SearchSkillHubSkills(c.Query("keyword"), false, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), parseSkillHubRecommendedOnly(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := skillHubSkillResponses(c, skills, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubListResponse{
		Items: responses,
		Total: total,
	})
}

func ListSkillHubSkillsByTags(c *gin.Context) {
	listSkillHubSkillsByTags(c, false)
}

func ListRecommendedSkillHubSkills(c *gin.Context) {
	pageSize := parseRecommendedSkillHubPageSize(c)
	skills, total, err := model.SearchRecommendedSkillHubSkills(pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := skillHubSkillResponses(c, skills, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubListResponse{
		Items: responses,
		Total: total,
	})
}

func ListSkillHubTags(c *gin.Context) {
	listSkillHubTags(c, true)
}

func GetSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil || skill.Status != model.SkillHubStatusPublished {
		common.ApiErrorMsg(c, "skill not found")
		return
	}
	responses, err := skillHubSkillResponses(c, []*model.SkillHubSkill{skill}, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := skill.ToDetailResponse(false, strings.TrimSpace(common.SkillHubReportEmail) != "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail.SkillHubSkillResponse = responses[0]
	common.ApiSuccess(c, detail)
}

func ReportSkillHubSkill(c *gin.Context) {
	if strings.TrimSpace(common.SkillHubReportEmail) == "" {
		common.ApiErrorMsg(c, "skill reporting is not configured")
		return
	}
	// The payload only contains a short idempotency key and a 1,000-character
	// description. Bound the body before JSON decoding to avoid large allocation
	// attacks against this public authenticated endpoint.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var request skillHubReportRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil || skill.Status != model.SkillHubStatusPublished {
		common.ApiErrorMsg(c, "skill not found")
		return
	}
	userID := c.GetInt("id")
	report, created, err := model.CreateOrGetSkillHubReport(userID, request.RequestID, skill, request.Description)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !created && (report.SkillID != skill.SkillID || report.Description != strings.TrimSpace(request.Description)) {
		common.ApiErrorMsg(c, "skill report request id was already used")
		return
	}

	claimed, err := model.ClaimSkillHubReportNotification(report.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if claimed {
		report.NotificationStatus = model.SkillHubReportNotificationSending
		subject, content := buildSkillHubReportEmail(report)
		if sendErr := common.SendEmail(subject, strings.TrimSpace(common.SkillHubReportEmail), content); sendErr != nil {
			if finishErr := model.FinishSkillHubReportNotification(report.Id, model.SkillHubReportNotificationFailed, sendErr.Error()); finishErr != nil {
				common.ApiError(c, finishErr)
				return
			}
			common.ApiErrorMsg(c, "skill report was recorded but notification failed; retry with the same request id")
			return
		} else if finishErr := model.FinishSkillHubReportNotification(report.Id, model.SkillHubReportNotificationNotified, ""); finishErr != nil {
			common.ApiError(c, finishErr)
			return
		} else {
			report.NotificationStatus = model.SkillHubReportNotificationNotified
		}
	}
	common.ApiSuccess(c, gin.H{
		"id":                 report.Id,
		"recorded":           true,
		"notificationStatus": report.NotificationStatus,
	})
}

func buildSkillHubReportEmail(report *model.SkillHubReport) (string, string) {
	escape := func(value string) string { return html.EscapeString(strings.TrimSpace(value)) }
	subject := fmt.Sprintf("[%s] 新的 Skill 举报 #%d", common.SystemName, report.Id)
	managementURL := skillHubReportManagementURL(report.Id)
	managementAction := "<p>请登录管理后台的 Skill Hub 举报管理页查看并处理。</p>"
	if managementURL != "" {
		managementAction = fmt.Sprintf(
			"<p><a href=\"%s\" rel=\"noopener noreferrer\">打开 Skill Hub 举报管理页</a></p>",
			escape(managementURL),
		)
	}
	content := fmt.Sprintf(
		"<h2>收到新的 Skill 举报</h2><div style=\"padding:12px;border:1px solid #f0c36d;background:#fff8e6\"><strong>安全提示：</strong>邮件不会展示任何用户提交的举报正文，也不会包含用户提供的链接。请仅通过下方固定后台入口查看内容。</div><p><strong>举报编号：</strong>%d</p><p><strong>Skill：</strong>%s (%s)</p><p><strong>版本：</strong>%s</p><p><strong>举报用户 ID：</strong>%d</p><p><strong>提交时间：</strong>%s</p>%s",
		report.Id,
		escape(report.SkillName),
		escape(report.SkillID),
		escape(report.SkillVersion),
		report.UserID,
		time.Unix(report.CreatedTime, 0).UTC().Format(time.RFC3339),
		managementAction,
	)
	return subject, content
}

func skillHubReportManagementURL(reportID int) string {
	base := strings.TrimSpace(system_setting.ServerAddress)
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return ""
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/skill-hub/reports"
	parsed.RawPath = ""
	parsed.RawQuery = url.Values{"report": []string{strconv.Itoa(reportID)}}.Encode()
	parsed.Fragment = ""
	return parsed.String()
}

func AdminListSkillHubReports(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.SearchSkillHubReports(
		c.Query("keyword"),
		strings.TrimSpace(c.Query("status")),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubAdminReportList{Items: items, Total: total})
}

func AdminGetSkillHubReport(c *gin.Context) {
	reportID, err := strconv.Atoi(c.Param("id"))
	if err != nil || reportID <= 0 {
		common.ApiErrorMsg(c, "invalid skill report id")
		return
	}
	report, err := model.GetSkillHubAdminReport(reportID)
	if err != nil {
		if errors.Is(err, model.ErrSkillHubReportNotFound) {
			common.ApiErrorMsg(c, "skill report not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}

func AdminUpdateSkillHubReport(c *gin.Context) {
	reportID, err := strconv.Atoi(c.Param("id"))
	if err != nil || reportID <= 0 {
		common.ApiErrorMsg(c, "invalid skill report id")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var request skillHubReportResolutionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	report, err := model.UpdateSkillHubReportResolution(
		reportID,
		request.Revision,
		request.Status,
		request.AdminNote,
		c.GetInt("id"),
	)
	if err != nil {
		switch {
		case errors.Is(err, model.ErrSkillHubReportNotFound):
			common.ApiErrorMsg(c, "skill report not found")
		case errors.Is(err, model.ErrSkillHubReportConflict):
			common.ApiErrorMsg(c, "skill report was updated by another administrator; refresh and try again")
		default:
			common.ApiError(c, err)
		}
		return
	}
	common.ApiSuccess(c, report)
}

func ListFavoriteSkillHubSkills(c *gin.Context) {
	tagIDs, err := parseSkillHubTagIDs(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	userID := c.GetInt("id")
	skills, total, err := model.SearchFavoriteSkillHubSkills(
		userID,
		tagIDs,
		c.Query("keyword"),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := skillHubSkillResponses(c, skills, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubListResponse{Items: responses, Total: total})
}

func FavoriteSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil || skill.Status != model.SkillHubStatusPublished {
		common.ApiErrorMsg(c, "skill not found")
		return
	}
	if err := model.FavoriteSkillHubSkill(c.GetInt("id"), skill.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": skill.SkillID, "favorited": true})
}

func UnfavoriteSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}
	if err == nil {
		if removeErr := model.UnfavoriteSkillHubSkill(c.GetInt("id"), skill.Id); removeErr != nil {
			common.ApiError(c, removeErr)
			return
		}
	}
	common.ApiSuccess(c, gin.H{"id": strings.TrimSpace(c.Param("id")), "favorited": false})
}

func DownloadSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil || skill.Status != model.SkillHubStatusPublished {
		common.ApiErrorMsg(c, "skill not found")
		return
	}
	if strings.TrimSpace(skill.SourceRef) == "" {
		if strings.HasPrefix(strings.ToLower(skill.SourceURL), "http://") || strings.HasPrefix(strings.ToLower(skill.SourceURL), "https://") {
			c.Redirect(http.StatusFound, skill.SourceURL)
			return
		}
		common.ApiErrorMsg(c, "skill package is not available")
		return
	}
	signedURL, err := service.SignSkillHubZipURL(skill.SourceRef, skill.SkillID+"-"+skill.Version)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Redirect(http.StatusFound, signedURL)
}

func AdminListSkillHubSkills(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	skills, total, err := model.SearchSkillHubSkills(c.Query("keyword"), true, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), parseSkillHubRecommendedOnly(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubListResponse{
		Items: model.SkillHubSkillsToResponses(skills, true),
		Total: total,
	})
}

func AdminListSkillHubSkillsByTags(c *gin.Context) {
	listSkillHubSkillsByTags(c, true)
}

func AdminGetSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := skill.ToDetailResponse(true, strings.TrimSpace(common.SkillHubReportEmail) != "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func AdminInitSkillHubDirectUpload(c *gin.Context) {
	var request skillHubDirectUploadInitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.InitSkillHubDirectUpload(service.SkillHubDirectUploadInput{
		Kind:     request.Kind,
		SkillID:  request.SkillID,
		Version:  request.Version,
		FileName: request.FileName,
		Size:     request.Size,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func AdminCompleteSkillHubDirectUpload(c *gin.Context) {
	var request skillHubDirectUploadCompleteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.CompleteSkillHubDirectUpload(request.UploadTicket)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if result.Kind == service.SkillHubUploadKindZip {
		result.Upload.URL = skillHubDownloadURL(c, result.SkillID)
	}
	common.ApiSuccess(c, result.Upload)
}

func AdminDiscardSkillHubDirectUpload(c *gin.Context) {
	var request skillHubDirectUploadCompleteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.DiscardSkillHubDirectUpload(request.UploadTicket); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminCreateSkillHubSkill(c *gin.Context) {
	var request skillHubSkillRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	skill, err := skillHubRequestToModel(request, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	duplicated, err := model.IsSkillHubSkillIDDuplicated(0, skill.SkillID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if duplicated {
		common.ApiErrorMsg(c, "skill id already exists")
		return
	}
	promotion, err := service.PromoteSkillHubObjects(skill)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := skill.Insert(); err != nil {
		cleanupPromotedSkillHubFinalObjects(promotion)
		common.ApiError(c, err)
		return
	}
	cleanupPromotedSkillHubTempObjects(promotion)
	detail, err := skill.ToDetailResponse(true, strings.TrimSpace(common.SkillHubReportEmail) != "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func AdminUpdateSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var request skillHubSkillRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	skill, err = skillHubRequestToModel(request, skill)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if skill.SkillID == "" {
		skill.SkillID = c.Param("id")
	}
	duplicated, err := model.IsSkillHubSkillIDDuplicated(skill.Id, skill.SkillID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if duplicated {
		common.ApiErrorMsg(c, "skill id already exists")
		return
	}
	promotion, err := service.PromoteSkillHubObjects(skill)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	oldSourceRef, oldIcon, err := skill.UpdateReturningPreviousObjects()
	if err != nil {
		cleanupPromotedSkillHubFinalObjects(promotion)
		common.ApiError(c, err)
		return
	}
	cleanupPromotedSkillHubTempObjects(promotion)
	cleanupSkillHubObjectsIfChanged(oldSourceRef, oldIcon, skill.SourceRef, skill.Icon)
	detail, err := skill.ToDetailResponse(true, strings.TrimSpace(common.SkillHubReportEmail) != "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func AdminDeleteSkillHubSkill(c *gin.Context) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteSkillHubSkill(skill); err != nil {
		common.ApiError(c, err)
		return
	}
	cleanupSkillHubObjects(skill.SourceRef, skill.Icon)
	common.ApiSuccess(c, nil)
}

func AdminBatchDeleteSkillHubSkills(c *gin.Context) {
	skills, err := bindSkillHubBatch(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteSkillHubSkills(skills); err != nil {
		common.ApiError(c, err)
		return
	}
	for _, skill := range skills {
		cleanupSkillHubObjects(skill.SourceRef, skill.Icon)
	}
	common.ApiSuccess(c, gin.H{"deleted": len(skills)})
}

func AdminBatchExportSkillHubSkills(c *gin.Context) {
	skills, err := bindSkillHubBatch(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	file, err := os.CreateTemp("", "skill-hub-export-*.zip")
	if err != nil {
		skillHubExportError(c, err)
		return
	}
	fileName := file.Name()
	defer func() {
		_ = file.Close()
		_ = os.Remove(fileName)
	}()
	archive := zip.NewWriter(file)
	manifest := make([]skillHubExportManifestItem, 0, len(skills))
	for _, skill := range skills {
		zipPath := "packages/" + skill.SkillID + ".zip"
		if err := addSkillHubExportZip(archive, zipPath, skill.SourceRef); err != nil {
			_ = archive.Close()
			skillHubExportError(c, fmt.Errorf("failed to export skill %s package: %w", skill.SkillID, err))
			return
		}
		evaluation, parseErr := model.SkillHubEvaluationFromJSON(skill.EvaluationJSON)
		if parseErr != nil {
			_ = archive.Close()
			skillHubExportError(c, fmt.Errorf("failed to export skill %s evaluation: %w", skill.SkillID, parseErr))
			return
		}
		testcases, parseErr := model.SkillHubTestcasesFromJSON(skill.TestcasesJSON)
		if parseErr != nil {
			_ = archive.Close()
			skillHubExportError(c, fmt.Errorf("failed to export skill %s testcases: %w", skill.SkillID, parseErr))
			return
		}
		testcasesPath, writeErr := addSkillHubExportTestcases(archive, skill.SkillID, testcases)
		if writeErr != nil {
			_ = archive.Close()
			skillHubExportError(c, fmt.Errorf("failed to export skill %s testcases: %w", skill.SkillID, writeErr))
			return
		}
		item := skillHubExportManifestItem{
			ID: skill.SkillID, Name: skill.Name, Description: skill.Description,
			Version: skill.Version, Author: skill.Author, Origin: skill.Origin, OriginURL: skill.OriginURL, License: skill.License,
			Tags:     model.StringListFromJSON(skill.Tags),
			Verified: skill.Verified, Recommended: skill.Recommended, Sort: skill.Sort,
			Zip: "./" + zipPath, Evaluation: evaluation, Testcases: testcasesPath,
		}
		if strings.TrimSpace(skill.Icon) != "" {
			reader, ext, openErr := service.OpenSkillHubIconObject(skill.Icon)
			if openErr != nil {
				_ = archive.Close()
				skillHubExportError(c, fmt.Errorf("failed to export skill %s icon: %w", skill.SkillID, openErr))
				return
			}
			iconPath := "icons/" + skill.SkillID + ext
			if err := copySkillHubExportFile(archive, iconPath, reader); err != nil {
				_ = archive.Close()
				skillHubExportError(c, fmt.Errorf("failed to export skill %s icon: %w", skill.SkillID, err))
				return
			}
			item.Icon = "./" + iconPath
		}
		manifest = append(manifest, item)
	}
	data, err := common.Marshal(manifest)
	if err == nil {
		var writer io.Writer
		writer, err = archive.Create("manifest.json")
		if err == nil {
			_, err = writer.Write(data)
		}
	}
	if err != nil {
		_ = archive.Close()
		skillHubExportError(c, err)
		return
	}
	if err := archive.Close(); err != nil {
		skillHubExportError(c, err)
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		skillHubExportError(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="skill-hub-export.zip"`)
	http.ServeContent(c.Writer, c.Request, "skill-hub-export.zip", time.Time{}, file)
}

func skillHubExportError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
}

func bindSkillHubBatch(c *gin.Context) ([]*model.SkillHubSkill, error) {
	var request skillHubBatchRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return nil, err
	}
	if len(request.IDs) == 0 || len(request.IDs) > 200 {
		return nil, errors.New("select between 1 and 200 skills")
	}
	seen := make(map[string]struct{}, len(request.IDs))
	ids := make([]string, 0, len(request.IDs))
	for _, rawID := range request.IDs {
		id := strings.TrimSpace(rawID)
		if id == "" {
			return nil, errors.New("skill id is required")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	skills, err := model.GetSkillHubSkillsBySkillIDs(ids)
	if err != nil {
		return nil, err
	}
	if len(skills) != len(ids) {
		return nil, errors.New("one or more skills were not found")
	}
	return skills, nil
}

func addSkillHubExportZip(archive *zip.Writer, name string, objectKey string) error {
	reader, err := service.OpenSkillHubZipObject(objectKey)
	if err != nil {
		return err
	}
	return copySkillHubExportFile(archive, name, reader)
}

func addSkillHubExportTestcases(archive *zip.Writer, skillID string, testcases *model.SkillHubTestcases) (string, error) {
	if testcases == nil {
		return "", nil
	}
	data, err := common.Marshal(testcases)
	if err != nil {
		return "", err
	}
	testcasesPath := "testcases/" + skillID + ".json"
	writer, err := archive.Create(testcasesPath)
	if err != nil {
		return "", err
	}
	if _, err := writer.Write(data); err != nil {
		return "", err
	}
	return "./" + testcasesPath, nil
}

func copySkillHubExportFile(archive *zip.Writer, name string, reader io.ReadCloser) error {
	defer reader.Close()
	writer, err := archive.Create(name)
	if err != nil {
		return err
	}
	_, err = io.Copy(writer, reader)
	return err
}

func AdminPublishSkillHubSkill(c *gin.Context) {
	updateSkillHubPublishStatus(c, model.SkillHubStatusPublished)
}

func AdminUnpublishSkillHubSkill(c *gin.Context) {
	updateSkillHubPublishStatus(c, model.SkillHubStatusDraft)
}

func AdminListSkillHubTags(c *gin.Context) {
	listSkillHubTags(c, false)
}

func listSkillHubTags(c *gin.Context, publishedOnly bool) {
	pageInfo := common.GetPageQuery(c)
	var (
		tags  []*model.SkillHubTag
		total int64
		err   error
	)
	if publishedOnly {
		tags, total, err = model.SearchSkillHubTags(c.Query("keyword"), publishedOnly, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	} else {
		tags, total, err = model.SearchSkillHubTagsWithSync(c.Query("keyword"), publishedOnly, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := model.SkillHubTagsToResponses(tags, publishedOnly)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubTagListResponse{
		Items: responses,
		Total: total,
	})
}

func listSkillHubSkillsByTags(c *gin.Context, admin bool) {
	tagIDs, err := parseSkillHubTagIDs(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	if len(tagIDs) == 0 {
		skills, total, err := model.SearchSkillHubSkills(c.Query("keyword"), admin, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), parseSkillHubRecommendedOnly(c))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		responses, err := skillHubSkillResponses(c, skills, admin)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, model.SkillHubListResponse{
			Items: responses,
			Total: total,
		})
		return
	}
	skills, total, err := model.SearchSkillHubSkillsByTagIDs(tagIDs, c.Query("keyword"), admin, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), parseSkillHubRecommendedOnly(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := skillHubSkillResponses(c, skills, admin)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.SkillHubListResponse{
		Items: responses,
		Total: total,
	})
}

func skillHubSkillResponses(c *gin.Context, skills []*model.SkillHubSkill, admin bool) ([]model.SkillHubSkillResponse, error) {
	if admin {
		return model.SkillHubSkillsToResponses(skills, true), nil
	}
	c.Header("Vary", "Authorization, Cookie, New-Api-User")
	userID := c.GetInt("id")
	if userID > 0 {
		c.Header("Cache-Control", "private, no-store")
	}
	return model.SkillHubSkillsToResponsesForUser(skills, false, userID)
}

func parseSkillHubTagIDs(c *gin.Context) ([]int, error) {
	values := make([]string, 0)
	for _, key := range []string{"tag_ids", "tag_id", "ids"} {
		values = append(values, c.QueryArray(key)...)
	}

	seen := map[int]struct{}{}
	ids := make([]int, 0)
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			id, err := strconv.Atoi(part)
			if err != nil || id <= 0 {
				return nil, fmt.Errorf("invalid tag id: %s", part)
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	if len(ids) > 50 {
		return nil, fmt.Errorf("too many tag ids")
	}
	return ids, nil
}

func parseRecommendedSkillHubPageSize(c *gin.Context) int {
	const (
		defaultPageSize = 4
		maxPageSize     = 20
	)
	pageSize, err := strconv.Atoi(c.Query("page_size"))
	if err != nil || pageSize <= 0 {
		return defaultPageSize
	}
	if pageSize > maxPageSize {
		return maxPageSize
	}
	return pageSize
}

func parseSkillHubRecommendedOnly(c *gin.Context) bool {
	value := strings.ToLower(strings.TrimSpace(c.Query("recommended")))
	return value == "true" || value == "1" || value == "yes"
}

func AdminCreateSkillHubTag(c *gin.Context) {
	var request skillHubTagRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	tag, err := model.CreateSkillHubTag(request.Name, request.Sort)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, tag.ToResponse(0, true))
}

func AdminDeleteSkillHubTag(c *gin.Context) {
	if err := model.DeleteSkillHubTag(c.Param("name")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func updateSkillHubPublishStatus(c *gin.Context, status int) {
	skill, err := model.GetSkillHubSkillBySkillID(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	skill.Status = status
	if err := skill.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, skill.ToResponse(true))
}

func skillHubRequestToModel(request skillHubSkillRequest, existing *model.SkillHubSkill) (*model.SkillHubSkill, error) {
	skill := &model.SkillHubSkill{}
	if existing != nil {
		copy := *existing
		skill = &copy
	}
	if strings.TrimSpace(request.ID) != "" || existing == nil {
		skill.SkillID = strings.TrimSpace(request.ID)
	}
	skill.Name = strings.TrimSpace(request.Name)
	skill.Description = strings.TrimSpace(request.Description)
	skill.Version = strings.TrimSpace(request.Version)
	skill.Author = strings.TrimSpace(request.Author)
	skill.Origin = strings.TrimSpace(request.Origin)
	skill.OriginURL = strings.TrimSpace(request.OriginURL)
	skill.License = strings.TrimSpace(request.License)
	skill.Icon = strings.TrimSpace(request.Icon)
	skill.Tags = model.StringListToJSON(request.Tags)
	skill.Verified = request.Verified
	skill.Recommended = request.Recommended
	skill.Sort = request.Sort
	if request.Status != nil {
		skill.Status = *request.Status
	} else if request.Published {
		skill.Status = model.SkillHubStatusPublished
	} else {
		skill.Status = model.SkillHubStatusDraft
	}
	skill.ConnectorMinVersion = ""
	skill.Platforms = ""
	skill.Permissions = ""
	skill.ManifestEntry = "SKILL.md"
	skill.ManifestPermissions = ""
	skill.ManifestTools = ""
	skill.SourceType = "zip"
	skill.SourceURL = strings.TrimSpace(request.Source.URL)
	nextSourceRef := strings.TrimSpace(request.Source.Ref)
	if existing != nil && nextSourceRef != existing.SourceRef {
		skill.SkillMarkdown = ""
	}
	skill.SourceRef = nextSourceRef
	skill.SourceChecksum = strings.TrimSpace(request.Source.Checksum)
	evaluationJSON, err := model.SkillHubEvaluationToJSON(request.Evaluation)
	if err != nil {
		return nil, err
	}
	testcasesJSON, err := model.SkillHubTestcasesToJSON(request.Testcases)
	if err != nil {
		return nil, err
	}
	skill.EvaluationJSON = evaluationJSON
	skill.TestcasesJSON = testcasesJSON
	skill.Changelog = ""
	return skill, nil
}

func skillHubDownloadURL(c *gin.Context, skillID string) string {
	return fmt.Sprintf("%s/api/skill-hub/skills/%s/download", requestBaseURL(c), url.PathEscape(skillID))
}

func cleanupSkillHubObjectsIfChanged(oldSourceRef string, oldIcon string, newSourceRef string, newIcon string) {
	if strings.TrimSpace(oldSourceRef) != "" && strings.TrimSpace(oldSourceRef) != strings.TrimSpace(newSourceRef) {
		cleanupSkillHubZipObject(oldSourceRef)
	}
	if strings.TrimSpace(oldIcon) != "" && strings.TrimSpace(oldIcon) != strings.TrimSpace(newIcon) {
		cleanupSkillHubIconObject(oldIcon)
	}
}

func cleanupSkillHubObjects(sourceRef string, icon string) {
	cleanupSkillHubZipObject(sourceRef)
	cleanupSkillHubIconObject(icon)
}

func cleanupSkillHubZipObject(objectKey string) {
	if strings.TrimSpace(objectKey) == "" {
		return
	}
	if err := service.DeleteSkillHubZipObject(objectKey); err != nil {
		common.SysLog(fmt.Sprintf("skill hub zip OSS object cleanup failed for %s: %v", objectKey, err))
	}
}

func cleanupSkillHubIconObject(iconURL string) {
	if strings.TrimSpace(iconURL) == "" {
		return
	}
	if err := service.DeleteSkillHubIconByURL(iconURL); err != nil {
		common.SysLog(fmt.Sprintf("skill hub icon OSS object cleanup failed for %s: %v", iconURL, err))
	}
}

func cleanupPromotedSkillHubFinalObjects(result *service.SkillHubPromoteResult) {
	if result == nil {
		return
	}
	if result.ZipPromoted {
		cleanupSkillHubZipObject(result.FinalSourceRef)
	}
	if result.IconPromoted {
		cleanupSkillHubIconObjectByKey(result.FinalIconObject)
	}
}

func cleanupPromotedSkillHubTempObjects(result *service.SkillHubPromoteResult) {
	if result == nil {
		return
	}
	if result.ZipPromoted {
		cleanupSkillHubZipObject(result.TempSourceRef)
	}
	if result.IconPromoted {
		cleanupSkillHubIconObjectByKey(result.TempIconObject)
	}
}

func cleanupSkillHubIconObjectByKey(objectKey string) {
	if strings.TrimSpace(objectKey) == "" {
		return
	}
	if err := service.DeleteSkillHubIconObject(objectKey); err != nil {
		common.SysLog(fmt.Sprintf("skill hub icon OSS object cleanup failed for %s: %v", objectKey, err))
	}
}

func requestBaseURL(c *gin.Context) string {
	if base := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/"); base != "" {
		if parsed, err := url.Parse(base); err == nil && parsed.Scheme != "" && parsed.Host != "" {
			return base
		}
	}
	proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
	if proto == "" {
		proto = "https"
		if c.Request.TLS == nil {
			proto = "http"
		}
	}
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	return strings.TrimRight(proto+"://"+host, "/")
}
