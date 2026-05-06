package controller

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const assessmentScreenshotDir = "data/assessment_screenshots"

func init() {
	os.MkdirAll(assessmentScreenshotDir, 0755)
}

func getAssessmentScreenshotPath(filename string) string {
	return filepath.Join(assessmentScreenshotDir, filename)
}

func GetAssessmentScreenshot(c *gin.Context) {
	filename := c.Param("filename")
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid filename"})
		return
	}
	filePath := getAssessmentScreenshotPath(filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "file not found"})
		return
	}
	c.File(filePath)
}

func UploadAssessmentScreenshot(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "请选择文件")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".gif" && ext != ".webp" {
		common.ApiErrorMsg(c, "仅支持 png/jpg/jpeg/gif/webp 格式")
		return
	}

	if header.Size > 10*1024*1024 {
		common.ApiErrorMsg(c, "文件大小不能超过10MB")
		return
	}

	filename := uuid.New().String() + ext
	outPath := getAssessmentScreenshotPath(filename)
	outFile, err := os.Create(outPath)
	if err != nil {
		common.ApiErrorMsg(c, "文件保存失败")
		return
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, file)
	if err != nil {
		common.ApiErrorMsg(c, "文件保存失败")
		return
	}

	common.ApiSuccess(c, gin.H{"filename": filename})
}

func CreateAssessment(c *gin.Context) {
	var req dto.CreateAssessmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Title == "" {
		common.ApiErrorMsg(c, "标题不能为空")
		return
	}

	status := model.AssessmentStatusPending
	if req.Status != nil {
		status = *req.Status
	}
	maxScore := 100
	if req.MaxScore != nil {
		maxScore = *req.MaxScore
	}

	assessment := model.Assessment{
		Title:       req.Title,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Status:      status,
		MaxScore:    maxScore,
		CreatedBy:   c.GetInt("id"),
	}
	if err := assessment.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建失败："+err.Error())
		return
	}
	common.ApiSuccess(c, assessment)
}

func UpdateAssessment(c *gin.Context) {
	var req dto.UpdateAssessmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	existing, err := model.GetAssessmentByID(req.Id)
	if err != nil {
		common.ApiErrorMsg(c, "考核不存在")
		return
	}

	existing.Title = req.Title
	existing.Description = req.Description
	existing.StartTime = req.StartTime
	existing.EndTime = req.EndTime
	if req.Status != nil {
		existing.Status = *req.Status
	}
	if req.MaxScore != nil {
		existing.MaxScore = *req.MaxScore
	}

	if err := existing.Update(); err != nil {
		common.ApiErrorMsg(c, "更新失败："+err.Error())
		return
	}
	common.ApiSuccess(c, existing)
}

func DeleteAssessment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.DeleteAssessmentByID(id); err != nil {
		common.ApiErrorMsg(c, "删除失败："+err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

func GetAllAssessments(c *gin.Context) {
	list, err := model.GetAllAssessments()
	if err != nil {
		common.ApiErrorMsg(c, "查询失败："+err.Error())
		return
	}
	if list == nil {
		list = []model.Assessment{}
	}
	common.ApiSuccess(c, list)
}

func GetActiveAssessmentsForUser(c *gin.Context) {
	model.UpdateAssessmentStatus()
	list, err := model.GetActiveAssessments()
	if err != nil {
		common.ApiErrorMsg(c, "查询失败："+err.Error())
		return
	}
	if list == nil {
		list = []model.Assessment{}
	}

	userId := c.GetInt("id")
	type AssessmentWithSubmission struct {
		Id               int      `json:"id"`
		Title            string   `json:"title"`
		Description      string   `json:"description"`
		StartTime        int64    `json:"start_time"`
		EndTime          int64    `json:"end_time"`
		AssessmentStatus int      `json:"status"`
		MaxScore         int      `json:"max_score"`
		CreatedBy        int      `json:"created_by"`
		CreatedAt        int64    `json:"created_at"`
		UpdatedAt        int64    `json:"updated_at"`
		Submitted        bool     `json:"submitted"`
		Score            *float64 `json:"score"`
		SubmissionStatus int      `json:"submission_status"`
	}

	result := make([]AssessmentWithSubmission, len(list))
	for i, a := range list {
		result[i].Id = a.Id
		result[i].Title = a.Title
		result[i].Description = a.Description
		result[i].StartTime = a.StartTime
		result[i].EndTime = a.EndTime
		result[i].AssessmentStatus = a.Status
		result[i].MaxScore = a.MaxScore
		result[i].CreatedBy = a.CreatedBy
		result[i].CreatedAt = a.CreatedAt
		result[i].UpdatedAt = a.UpdatedAt
		if sub, err := model.GetUserSubmissionByAssessment(userId, a.Id); err == nil {
			result[i].Submitted = true
			result[i].Score = sub.Score
			result[i].SubmissionStatus = sub.Status
		}
	}
	common.ApiSuccess(c, result)
}

func SubmitAssessment(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		common.ApiErrorMsg(c, "请求解析失败")
		return
	}

	assessmentId, err := strconv.Atoi(c.PostForm("assessment_id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	content := c.PostForm("content")
	userId := c.GetInt("id")

	model.UpdateAssessmentStatus()
	assessment, err := model.GetAssessmentByID(assessmentId)
	if err != nil {
		common.ApiErrorMsg(c, "考核不存在")
		return
	}
	if assessment.Status != model.AssessmentStatusActive {
		common.ApiErrorMsg(c, "考核不在进行中")
		return
	}

	existing, err := model.GetUserSubmissionByAssessment(userId, assessmentId)
	if err == nil && existing != nil {
		common.ApiErrorMsg(c, "已提交过该考核")
		return
	}

	form := c.Request.MultipartForm
	var screenshots []string
	files := form.File["screenshots"]
	for _, fh := range files {
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".gif" && ext != ".webp" {
			common.ApiErrorMsg(c, "仅支持 png/jpg/jpeg/gif/webp 格式")
			return
		}
		if fh.Size > 10*1024*1024 {
			common.ApiErrorMsg(c, "单张图片不能超过10MB")
			return
		}

		file, err := fh.Open()
		if err != nil {
			continue
		}

		filename := uuid.New().String() + ext
		outPath := getAssessmentScreenshotPath(filename)
		outFile, err := os.Create(outPath)
		if err != nil {
			file.Close()
			continue
		}

		io.Copy(outFile, file)
		outFile.Close()
		file.Close()

		screenshots = append(screenshots, filename)
	}

	submission := model.AssessmentSubmission{
		AssessmentId: assessmentId,
		UserId:       userId,
		Content:      content,
		Screenshots:  model.ScreenshotsJSON(screenshots),
		Status:       model.SubmissionStatusPending,
	}
	if len(screenshots) == 0 {
		submission.Screenshots = model.ScreenshotsJSON{}
	}
	if err := submission.Insert(); err != nil {
		common.ApiErrorMsg(c, "提交失败："+err.Error())
		return
	}
	common.ApiSuccess(c, submission)
}

func GetMySubmissions(c *gin.Context) {
	userId := c.GetInt("id")
	submissions, err := model.GetUserSubmissions(userId)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败："+err.Error())
		return
	}
	if submissions == nil {
		submissions = []model.AssessmentSubmission{}
	}

	type SubmissionWithAssessment struct {
		model.AssessmentSubmission
		AssessmentTitle string `json:"assessment_title"`
	}

	result := make([]SubmissionWithAssessment, len(submissions))
	for i, s := range submissions {
		result[i].AssessmentSubmission = s
		if a, err := model.GetAssessmentByID(s.AssessmentId); err == nil {
			result[i].AssessmentTitle = a.Title
		}
	}
	common.ApiSuccess(c, result)
}

func GetAssessmentSubmissionsAdmin(c *gin.Context) {
	assessmentId, err := strconv.Atoi(c.Param("assessment_id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	submissions, err := model.GetSubmissionsByAssessment(assessmentId)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败："+err.Error())
		return
	}
	if submissions == nil {
		submissions = []model.AssessmentSubmission{}
	}

	type SubmissionWithUser struct {
		model.AssessmentSubmission
		Username string `json:"username"`
		Email    string `json:"email"`
	}

	result := make([]SubmissionWithUser, len(submissions))
	for i, s := range submissions {
		result[i].AssessmentSubmission = s
		if user, err := model.GetUserById(s.UserId, false); err == nil {
			result[i].Username = user.Username
			result[i].Email = user.Email
		}
	}
	common.ApiSuccess(c, result)
}

func ReviewSubmission(c *gin.Context) {
	var req dto.ReviewSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	submission, err := model.GetSubmissionByID(req.Id)
	if err != nil {
		common.ApiErrorMsg(c, "提交记录不存在")
		return
	}

	if err := model.ReviewSubmission(req.Id, req.Status, req.Score, req.Comment, c.GetInt("id")); err != nil {
		common.ApiErrorMsg(c, "评审失败："+err.Error())
		return
	}

	assessment, _ := model.GetAssessmentByID(submission.AssessmentId)
	title := ""
	if assessment != nil {
		title = assessment.Title
	}
	go service.NotifyAssessmentReview(submission.UserId, title, req.Status, req.Score, req.Comment)

	common.ApiSuccess(c, nil)
}

func GetAssessmentStats(c *gin.Context) {
	assessmentId, err := strconv.Atoi(c.Param("assessment_id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	stats, err := model.GetAssessmentSubmissionStats(assessmentId)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败："+err.Error())
		return
	}
	common.ApiSuccess(c, stats)
}

func GetMyAssessmentStats(c *gin.Context) {
	userId := c.GetInt("id")
	stats, err := model.GetUserAssessmentStats(userId)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败："+err.Error())
		return
	}
	common.ApiSuccess(c, stats)
}

