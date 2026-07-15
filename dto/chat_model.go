package dto

type UserChatModelsResponse struct {
	Total  int                 `json:"total"`
	Models []UserChatModelItem `json:"models"`
}

type UserChatModelItem struct {
	Model            string   `json:"model"`
	Name             string   `json:"name"`
	Price            float64  `json:"price"`
	Api              string   `json:"api"`
	Input            []string `json:"input"`
	ContextWindow    int      `json:"contextWindow,omitempty"`
	ContextTokens    int      `json:"contextTokens,omitempty"`
	MaxTokens        int      `json:"maxTokens,omitempty"`
	Reasoning        bool     `json:"reasoning"`
	ThinkingLevels   []string `json:"thinkingLevels,omitempty"`
	ThinkingDefault  string   `json:"thinkingDefault,omitempty"`
	SupportsFastMode bool     `json:"supportsFastMode"`
}

type AdminChatModelItem struct {
	Id               int      `json:"id"`
	Model            string   `json:"model"`
	Name             string   `json:"name"`
	Enabled          bool     `json:"enabled"`
	IsAuto           bool     `json:"is_auto"`
	Sort             int      `json:"sort"`
	Price            float64  `json:"price"`
	Available        bool     `json:"available"`
	Api              string   `json:"api"`
	Input            []string `json:"input"`
	ContextWindow    int      `json:"contextWindow,omitempty"`
	ContextTokens    int      `json:"contextTokens,omitempty"`
	MaxTokens        int      `json:"maxTokens,omitempty"`
	Reasoning        bool     `json:"reasoning"`
	ThinkingLevels   []string `json:"thinkingLevels"`
	ThinkingDefault  string   `json:"thinkingDefault,omitempty"`
	SupportsFastMode bool     `json:"supportsFastMode"`
	CreatedTime      int64    `json:"created_time"`
	UpdatedTime      int64    `json:"updated_time"`
}

type ChatModelCandidate struct {
	Model      string  `json:"model"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	Configured bool    `json:"configured"`
}

type CreateChatModelRequest struct {
	Model            string    `json:"model"`
	Name             string    `json:"name"`
	Api              *string   `json:"api"`
	Input            *[]string `json:"input"`
	ContextWindow    *int      `json:"contextWindow"`
	ContextTokens    *int      `json:"contextTokens"`
	MaxTokens        *int      `json:"maxTokens"`
	Reasoning        *bool     `json:"reasoning"`
	ThinkingLevels   *[]string `json:"thinkingLevels"`
	ThinkingDefault  *string   `json:"thinkingDefault"`
	SupportsFastMode *bool     `json:"supportsFastMode"`
	Enabled          *bool     `json:"enabled"`
	IsAuto           *bool     `json:"is_auto"`
	Sort             *int      `json:"sort"`
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
	Model            *string   `json:"model"`
	Name             *string   `json:"name"`
	Api              *string   `json:"api"`
	Input            *[]string `json:"input"`
	ContextWindow    *int      `json:"contextWindow"`
	ContextTokens    *int      `json:"contextTokens"`
	MaxTokens        *int      `json:"maxTokens"`
	Reasoning        *bool     `json:"reasoning"`
	ThinkingLevels   *[]string `json:"thinkingLevels"`
	ThinkingDefault  *string   `json:"thinkingDefault"`
	SupportsFastMode *bool     `json:"supportsFastMode"`
	Enabled          *bool     `json:"enabled"`
	IsAuto           *bool     `json:"is_auto"`
	Sort             *int      `json:"sort"`
}
