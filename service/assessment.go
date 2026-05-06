package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const (
	NotifyTypeAssessmentReview = "assessment_review"
)

func NotifyAssessmentReview(userId int, assessmentTitle string, status int, score float64, comment string) {
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return
	}

	var resultText string
	switch status {
	case model.SubmissionStatusPassed:
		resultText = "通过"
	case model.SubmissionStatusFailed:
		resultText = "未通过"
	default:
		resultText = "已评审"
	}

	title := "考核评审结果通知"
	content := fmt.Sprintf("您在考核「%s」中的提交已被评审，结果：%s，得分：%.1f分", assessmentTitle, resultText, score)
	if comment != "" {
		content += fmt.Sprintf("\n评语：%s", comment)
	}

	notification := dto.NewNotify(NotifyTypeAssessmentReview, title, content, nil)
	userSetting := user.GetSetting()
	_ = NotifyUser(userId, user.Email, userSetting, notification)
}
