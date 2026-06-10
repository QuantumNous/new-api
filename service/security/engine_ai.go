package security

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// AIDetector AI 智能检测引擎
type AIDetector struct {
}

func (ad *AIDetector) Name() string {
	return "ai"
}

// Detect 实现接口（不带上下文，默认超时）
func (ad *AIDetector) Detect(content string, rules []*model.SecurityRule) (*EngineResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(constant.SecurityAITimeoutSeconds)*time.Second)
	defer cancel()
	return ad.DetectWithContext(ctx, content, rules)
}

// DetectWithContext 带上下文的 AI 检测
func (ad *AIDetector) DetectWithContext(ctx context.Context, content string, rules []*model.SecurityRule) (*EngineResult, error) {
	result := &EngineResult{
		EngineName: ad.Name(),
		Detected:   false,
		Matches:    make([]*dto.SecurityMatchResult, 0),
		RiskScore:  0,
	}

	// 获取 AI 检测规则
	var aiRules []*model.SecurityRule
	for _, rule := range rules {
		if rule.Type == constant.SecurityRuleTypeAI && rule.Status == constant.SecurityStatusEnabled {
			aiRules = append(aiRules, rule)
		}
	}

	if len(aiRules) == 0 {
		return result, nil
	}

	// 调用 AI 检测服务
	detected, riskScore, reason, err := ad.callAIDetection(ctx, content)
	if err != nil {
		result.Error = err
		return result, err
	}

	if detected {
		result.Detected = true
		result.RiskScore = riskScore
		for _, rule := range aiRules {
			result.Matches = append(result.Matches, &dto.SecurityMatchResult{
				RuleID:      rule.ID,
				GroupID:     rule.GroupID,
				Type:        rule.Type,
				MatchedText: reason,
				Position:    [2]int{0, len(content)},
			})
		}
	}

	return result, nil
}

// callAIDetection 调用 AI 检测服务
func (ad *AIDetector) callAIDetection(ctx context.Context, content string) (bool, int, string, error) {
	// 从配置获取 AI 检测服务 URL 和密钥
	aiURL := common.GetEnvOrDefaultString("SECURITY_AI_URL", "")
	aiKey := common.GetEnvOrDefaultString("SECURITY_AI_KEY", "")

	if aiURL == "" {
		return false, 0, "", errors.New("AI 检测服务未配置")
	}

	reqBody := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": "判断以下内容是否包含企业机密信息或个人敏感信息。如果包含，返回 JSON: {\"risk\": true, \"reason\": \"原因\", \"category\": \"分类\", \"confidence\": 0.9}。如果不包含，返回 {\"risk\": false}",
			},
			{
				"role":    "user",
				"content": content,
			},
		},
	}

	jsonBody, err := common.Marshal(reqBody)
	if err != nil {
		return false, 0, "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", aiURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return false, 0, "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+aiKey)

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, 0, "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, 0, "", err
	}

	// 简单解析响应
	var aiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := common.Unmarshal(body, &aiResp); err != nil {
		return false, 0, "", err
	}

	if len(aiResp.Choices) == 0 {
		return false, 0, "", errors.New("AI 响应为空")
	}

	contentStr := aiResp.Choices[0].Message.Content

	// 尝试解析 JSON
	var result struct {
		Risk       bool    `json:"risk"`
		Reason     string  `json:"reason"`
		Category   string  `json:"category"`
		Confidence float64 `json:"confidence"`
	}

	// 提取 JSON 部分
	start := strings.Index(contentStr, "{")
	end := strings.LastIndex(contentStr, "}")
	if start != -1 && end != -1 && end > start {
		jsonStr := contentStr[start : end+1]
		if err := common.Unmarshal([]byte(jsonStr), &result); err != nil {
			common.SysLog("AI 检测结果解析失败: " + err.Error())
			return false, 0, "", nil
		}
	}

	if result.Risk {
		riskScore := int(result.Confidence * 100)
		if riskScore > 100 {
			riskScore = 100
		}
		return true, riskScore, result.Reason, nil
	}

	return false, 0, "", nil
}
