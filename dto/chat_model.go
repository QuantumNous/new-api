package dto

type UserChatModelsResponse struct {
	Total  int                 `json:"total"`
	Models []UserChatModelItem `json:"models"`
}

type UserChatModelItem struct {
	Model string  `json:"model"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type AdminChatModelItem struct {
	Id          int     `json:"id"`
	Model       string  `json:"model"`
	Name        string  `json:"name"`
	Enabled     bool    `json:"enabled"`
	IsAuto      bool    `json:"is_auto"`
	Sort        int     `json:"sort"`
	Price       float64 `json:"price"`
	Available   bool    `json:"available"`
	CreatedTime int64   `json:"created_time"`
	UpdatedTime int64   `json:"updated_time"`
}

type ChatModelCandidate struct {
	Model      string  `json:"model"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	Configured bool    `json:"configured"`
}

type CreateChatModelRequest struct {
	Model   string `json:"model"`
	Name    string `json:"name"`
	Enabled *bool  `json:"enabled"`
	IsAuto  *bool  `json:"is_auto"`
	Sort    *int   `json:"sort"`
}

type BatchCreateChatModelsRequest struct {
	Models []string `json:"models"`
}

type BatchCreateChatModelsResponse struct {
	Created      []AdminChatModelItem `json:"created"`
	Skipped      []string             `json:"skipped"`
	CreatedCount int                  `json:"created_count"`
	SkippedCount int                  `json:"skipped_count"`
}

type UpdateChatModelRequest struct {
	Model   *string `json:"model"`
	Name    *string `json:"name"`
	Enabled *bool   `json:"enabled"`
	IsAuto  *bool   `json:"is_auto"`
	Sort    *int    `json:"sort"`
}
