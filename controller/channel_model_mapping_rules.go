package controller

import (
	"maps"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

type previewModelMappingRulesRequest struct {
	Models       []string              `json:"models"`
	ModelMapping map[string]string     `json:"model_mapping"`
	Rules        dto.ModelMappingRules `json:"rules"`
}

type modelMappingRuleChange struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Upstream string `json:"upstream"`
}

type modelMappingRulesPreview struct {
	Models       []string                   `json:"models"`
	ModelMapping map[string]string          `json:"model_mapping"`
	Changed      []modelMappingRuleChange   `json:"changed"`
	Conflicts    []modelMappingRuleConflict `json:"conflicts"`
}

// previewModelMappingRules applies the rules to every existing channel model.
// A model M that maps to upstream U (or is U itself) is renamed to rules(M),
// and the mapping is rewritten to point the new name at U. Renames that would
// collide with another model or with a mapping to a different upstream model
// keep the original name and are reported as conflicts.
func previewModelMappingRules(models []string, modelMapping map[string]string, rules dto.ModelMappingRules) modelMappingRulesPreview {
	models = normalizeModelNames(models)
	nextMapping := make(map[string]string, len(modelMapping))
	maps.Copy(nextMapping, modelMapping)
	preview := modelMappingRulesPreview{
		Models:       make([]string, 0, len(models)),
		ModelMapping: nextMapping,
		Changed:      []modelMappingRuleChange{},
		Conflicts:    []modelMappingRuleConflict{},
	}
	taken := make(map[string]struct{}, len(models))
	for _, modelName := range models {
		taken[modelName] = struct{}{}
	}
	for _, modelName := range models {
		upstream := modelName
		if target, ok := modelMapping[modelName]; ok {
			upstream = target
		}
		clientName := rules.Apply(modelName)
		if clientName == modelName {
			preview.Models = append(preview.Models, modelName)
			continue
		}
		_, nameTaken := taken[clientName]
		mappedTarget, mapped := nextMapping[clientName]
		if nameTaken || (mapped && mappedTarget != upstream) {
			preview.Models = append(preview.Models, modelName)
			preview.Conflicts = append(preview.Conflicts, modelMappingRuleConflict{Model: modelName, Target: clientName, Upstream: upstream})
			continue
		}
		taken[clientName] = struct{}{}
		delete(nextMapping, modelName)
		if clientName != upstream {
			nextMapping[clientName] = upstream
		}
		preview.Models = append(preview.Models, clientName)
		preview.Changed = append(preview.Changed, modelMappingRuleChange{From: modelName, To: clientName, Upstream: upstream})
	}
	return preview
}

func PreviewChannelModelMappingRules(c *gin.Context) {
	var req previewModelMappingRulesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := req.Rules.Validate(); err != nil {
		common.ApiErrorT(c, "Invalid model mapping rules: {{error}}", map[string]any{"error": err.Error()})
		return
	}
	modelMapping := make(map[string]string, len(req.ModelMapping))
	for source, target := range req.ModelMapping {
		source, target = strings.TrimSpace(source), strings.TrimSpace(target)
		if source != "" && target != "" {
			modelMapping[source] = target
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    previewModelMappingRules(req.Models, modelMapping, req.Rules),
	})
}
