package agent

import (
	"context"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/agent_setting"
)

func SearchKnowledge(ctx context.Context, query string) ([]map[string]interface{}, error) {
	query = strings.TrimSpace(query)
	limit := agent_setting.GetAgentSetting().KBTopK
	if limit <= 0 || limit > 20 {
		limit = 5
	}
	var chunks []model.AgentKBChunk
	tx := model.DB.WithContext(ctx).Order("id desc").Limit(limit)
	if query != "" {
		tx = tx.Where("content LIKE ?", "%"+query+"%")
	}
	if err := tx.Find(&chunks).Error; err != nil {
		return nil, err
	}
	results := make([]map[string]interface{}, 0, len(chunks))
	for _, chunk := range chunks {
		results = append(results, map[string]interface{}{"id": chunk.Id, "doc_id": chunk.DocId, "content": chunk.Content, "score": 1})
	}
	if len(results) == 0 {
		results = append(results, map[string]interface{}{"id": 0, "doc_id": 0, "content": "Common help: create API keys in Token, check usage in Logs, and top up from Wallet.", "score": 0.1})
	}
	return results, nil
}
