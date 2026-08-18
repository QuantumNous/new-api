package controller

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/modellab"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
)

const (
	channelLabBalanceAuditAction   = "channel.lab_balance_sync"
	channelLabModelTestAuditAction = "channel.lab_model_test"
	channelLabDeleteAuditAction    = "channel.lab_delete"
)

// channelLabAuditContext is accepted as optional request metadata for legacy
// batch endpoints. The server ignores its derived values and recomputes them
// from channel IDs before writing an audit record.
type channelLabAuditContext struct {
	GroupSlug       string   `json:"group_slug,omitempty"`
	GroupKind       string   `json:"group_kind,omitempty"`
	ChannelIDs      []int    `json:"channel_ids,omitempty"`
	MatchedLabs     []string `json:"matched_labs,omitempty"`
	MatchedModels   []string `json:"matched_models,omitempty"`
	MatchSources    []string `json:"match_sources,omitempty"`
	CatalogVersion  string   `json:"catalog_version,omitempty"`
	UnresolvedCount int      `json:"unresolved_count,omitempty"`
}

type channelLabAuditRequest struct {
	Action          string   `json:"action"`
	GroupSlug       string   `json:"group_slug,omitempty"`
	GroupKind       string   `json:"group_kind,omitempty"`
	ChannelIDs      []int    `json:"channel_ids,omitempty"`
	MatchedLabs     []string `json:"matched_labs,omitempty"`
	MatchedModels   []string `json:"matched_models,omitempty"`
	MatchSources    []string `json:"match_sources,omitempty"`
	CatalogVersion  string   `json:"catalog_version,omitempty"`
	UnresolvedCount int      `json:"unresolved_count,omitempty"`
}

func normalizeChannelIDs(ids []int) ([]int, error) {
	if len(ids) == 0 {
		return nil, fmt.Errorf("channel ids are required")
	}
	seen := make(map[int]struct{}, len(ids))
	result := make([]int, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, fmt.Errorf("channel id must be positive")
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	sort.Ints(result)
	return result, nil
}

func channelLabAuditParams(ids []int) (map[string]interface{}, error) {
	normalizedIDs, err := normalizeChannelIDs(ids)
	if err != nil {
		return nil, err
	}
	channels, err := model.GetChannelsByIds(normalizedIDs)
	if err != nil {
		return nil, err
	}
	byID := make(map[int]*model.Channel, len(channels))
	for _, channel := range channels {
		if channel != nil {
			byID[channel.Id] = channel
		}
	}

	labs := make(map[string]modellab.LabMatch)
	models := make([]string, 0)
	modelMatches := make([]modellab.ModelMatch, 0)
	sources := make(map[string]struct{})
	unresolved := 0
	catalogVersion := modellab.DefaultCatalog().Version
	for _, id := range normalizedIDs {
		channel := byID[id]
		if channel == nil {
			continue
		}
		mapping := channel.GetModelMapping()
		resolution := modellab.Resolve(channel.Models, mapping)
		if resolution.CatalogVersion != "" {
			catalogVersion = resolution.CatalogVersion
		}
		unresolved += resolution.UnresolvedCount
		for _, lab := range resolution.Labs {
			previous, exists := labs[lab.Slug]
			if !exists || lab.Confidence > previous.Confidence {
				labs[lab.Slug] = lab
			}
		}
		for _, match := range resolution.Models {
			modelMatches = append(modelMatches, match)
			modelID := strings.TrimSpace(match.CanonicalID)
			if modelID == "" {
				modelID = strings.TrimSpace(match.RealModel)
			}
			if modelID != "" {
				models = append(models, modelID)
			}
			sources[match.Source] = struct{}{}
		}
	}

	labMatches := make([]modellab.LabMatch, 0, len(labs))
	matchedLabSlugs := make([]string, 0, len(labs))
	for slug, lab := range labs {
		labMatches = append(labMatches, lab)
		matchedLabSlugs = append(matchedLabSlugs, slug)
	}
	sort.Slice(labMatches, func(i, j int) bool { return labMatches[i].Slug < labMatches[j].Slug })
	sort.Strings(matchedLabSlugs)
	models = uniqueStrings(models)
	matchedSources := make([]string, 0, len(sources))
	for source := range sources {
		matchedSources = append(matchedSources, source)
	}
	sort.Strings(matchedSources)

	groupSlug := modellab.GroupUnknown
	groupKind := "unknown"
	if len(matchedLabSlugs) == 1 {
		groupSlug = matchedLabSlugs[0]
		groupKind = "single"
	} else if len(matchedLabSlugs) > 1 {
		groupSlug = modellab.GroupMixed
		groupKind = "mixed"
	}
	return map[string]interface{}{
		"group_slug":       groupSlug,
		"group_kind":       groupKind,
		"channel_ids":      normalizedIDs,
		"matched_labs":     matchedLabSlugs,
		"lab_matches":      labMatches,
		"matched_models":   models,
		"model_matches":    modelMatches,
		"match_sources":    matchedSources,
		"catalog_version":  catalogVersion,
		"unresolved_count": unresolved,
	}, nil
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func recordChannelLabAudit(c *gin.Context, action string, ids []int) error {
	params, err := channelLabAuditParams(ids)
	if err != nil {
		return err
	}
	params["count"] = len(params["channel_ids"].([]int))
	params["action_scope"] = "lab_group"
	recordManageAudit(c, action, params)
	return nil
}

// RecordChannelLabAudit records one group-level operation for the Vue batch
// balance/test flows, which otherwise call one channel endpoint per ID.
func RecordChannelLabAudit(c *gin.Context) {
	var request channelLabAuditRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "invalid lab audit request")
		return
	}
	var permission = authz.ChannelOperate
	if request.Action == channelLabDeleteAuditAction {
		permission = authz.ChannelSensitiveWrite
	}
	if request.Action != channelLabBalanceAuditAction &&
		request.Action != channelLabModelTestAuditAction &&
		request.Action != channelLabDeleteAuditAction {
		common.ApiErrorMsg(c, "invalid lab audit action")
		return
	}
	if !authz.Can(c.GetInt("id"), c.GetInt("role"), permission) {
		common.ApiErrorMsg(c, "insufficient permission")
		return
	}
	if err := recordChannelLabAudit(c, request.Action, request.ChannelIDs); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"recorded": true})
}
