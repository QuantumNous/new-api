package dto

type CreateAssessmentRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	StartTime   int64  `json:"start_time"`
	EndTime     int64  `json:"end_time"`
	Status      *int   `json:"status"`
	MaxScore    *int   `json:"max_score"`
}

type UpdateAssessmentRequest struct {
	Id          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	StartTime   int64  `json:"start_time"`
	EndTime     int64  `json:"end_time"`
	Status      *int   `json:"status"`
	MaxScore    *int   `json:"max_score"`
}

type SubmitAssessmentRequest struct {
	AssessmentId int    `json:"assessment_id"`
	Content      string `json:"content"`
}

type ReviewSubmissionRequest struct {
	Id      int     `json:"id"`
	Status  int     `json:"status"`
	Score   float64 `json:"score"`
	Comment string  `json:"comment"`
}
