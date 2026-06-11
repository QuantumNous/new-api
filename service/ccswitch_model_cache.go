package service

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

type ccSwitchModelCatalogEntry struct {
	dto.CCSwitchModelOption
	EnableGroups []string
}

var ccSwitchModelCatalog = struct {
	sync.RWMutex
	entries     []ccSwitchModelCatalogEntry
	initialized bool
}{}

var (
	ccSwitchModelCatalogRefreshLock sync.Mutex
	ccSwitchModelCacheTaskOnce      sync.Once
	buildCCSwitchModelCatalogFunc   = buildCCSwitchModelCatalog
)

func GetCCSwitchModelOptionsForUser(userID int) ([]dto.CCSwitchModelOption, error) {
	user, err := model.GetUserById(userID, true)
	if err != nil {
		return nil, err
	}
	entries, err := getCCSwitchModelCatalog()
	if err != nil {
		return nil, err
	}

	usableGroups := GetUserUsableGroups(user.Group)
	items := make([]dto.CCSwitchModelOption, 0, len(entries))
	for _, entry := range entries {
		if !ccSwitchModelAvailableToUser(entry.EnableGroups, usableGroups) {
			continue
		}
		items = append(items, entry.CCSwitchModelOption)
	}
	return items, nil
}

func InvalidateCCSwitchModelCache() {
	ccSwitchModelCatalog.Lock()
	ccSwitchModelCatalog.initialized = false
	ccSwitchModelCatalog.Unlock()
}

func StartCCSwitchModelCacheRefreshTask() {
	ccSwitchModelCacheTaskOnce.Do(func() {
		gopool.Go(func() {
			if err := refreshCCSwitchModelCatalog(); err != nil {
				logger.LogWarn(context.Background(), "failed to refresh CC Switch model cache: "+err.Error())
			}
			for {
				timer := time.NewTimer(time.Until(nextCCSwitchModelCacheRefresh(time.Now())))
				<-timer.C
				if err := refreshCCSwitchModelCatalog(); err != nil {
					logger.LogWarn(context.Background(), "failed to refresh CC Switch model cache: "+err.Error())
				}
			}
		})
	})
}

func nextCCSwitchModelCacheRefresh(now time.Time) time.Time {
	return now.Truncate(time.Hour).Add(time.Hour)
}

func getCCSwitchModelCatalog() ([]ccSwitchModelCatalogEntry, error) {
	ccSwitchModelCatalog.RLock()
	if ccSwitchModelCatalog.initialized {
		entries := cloneCCSwitchModelCatalog(ccSwitchModelCatalog.entries)
		ccSwitchModelCatalog.RUnlock()
		return entries, nil
	}
	ccSwitchModelCatalog.RUnlock()

	if err := refreshCCSwitchModelCatalog(); err != nil {
		ccSwitchModelCatalog.RLock()
		entries := cloneCCSwitchModelCatalog(ccSwitchModelCatalog.entries)
		ccSwitchModelCatalog.RUnlock()
		if len(entries) > 0 {
			return entries, nil
		}
		return nil, err
	}
	ccSwitchModelCatalog.RLock()
	entries := cloneCCSwitchModelCatalog(ccSwitchModelCatalog.entries)
	ccSwitchModelCatalog.RUnlock()
	return entries, nil
}

func refreshCCSwitchModelCatalog() error {
	ccSwitchModelCatalogRefreshLock.Lock()
	defer ccSwitchModelCatalogRefreshLock.Unlock()

	entries, err := buildCCSwitchModelCatalogFunc()
	if err != nil {
		return err
	}
	ccSwitchModelCatalog.Lock()
	ccSwitchModelCatalog.entries = nil
	ccSwitchModelCatalog.initialized = false
	ccSwitchModelCatalog.entries = entries
	ccSwitchModelCatalog.initialized = true
	ccSwitchModelCatalog.Unlock()
	return nil
}

func buildCCSwitchModelCatalog() ([]ccSwitchModelCatalogEntry, error) {
	abilities, err := model.GetAllEnableAbilityWithChannels()
	if err != nil {
		return nil, err
	}
	metadata, err := model.GetAllModelsMetadata()
	if err != nil {
		return nil, err
	}
	metadataByModelName := buildCCSwitchModelMetadataMap(metadata, abilities)

	vendors, err := model.GetAllVendorsMetadata()
	if err != nil {
		return nil, err
	}
	vendorNames := make(map[int]string, len(vendors))
	for _, vendor := range vendors {
		vendorNames[vendor.Id] = vendor.Name
	}

	groupsByModelName := make(map[string]map[string]struct{}, len(abilities))
	for _, ability := range abilities {
		modelName := strings.TrimSpace(ability.Model)
		groupName := strings.TrimSpace(ability.Group)
		if modelName == "" || groupName == "" {
			continue
		}
		groups, ok := groupsByModelName[modelName]
		if !ok {
			groups = make(map[string]struct{})
			groupsByModelName[modelName] = groups
		}
		groups[groupName] = struct{}{}
	}

	entries := make([]ccSwitchModelCatalogEntry, 0, len(groupsByModelName))
	for modelName, groupSet := range groupsByModelName {
		meta := metadataByModelName[modelName]
		vendorID := 0
		createdTime := int64(0)
		if meta != nil {
			vendorID = meta.VendorID
			createdTime = meta.CreatedTime
		}
		vendorName := strings.TrimSpace(vendorNames[vendorID])
		if vendorName == "" {
			vendorName = inferCCSwitchVendorName(modelName)
		}
		if vendorName == "" {
			vendorName = "Other"
		}
		entries = append(entries, ccSwitchModelCatalogEntry{
			CCSwitchModelOption: dto.CCSwitchModelOption{
				Name:        modelName,
				VendorID:    vendorID,
				VendorName:  vendorName,
				CreatedTime: createdTime,
			},
			EnableGroups: sortedCCSwitchModelGroups(groupSet),
		})
	}

	sortCCSwitchModelCatalog(entries)
	return entries, nil
}

func buildCCSwitchModelMetadataMap(metadata []model.Model, abilities []model.AbilityWithChannel) map[string]*model.Model {
	exact := make(map[string]*model.Model, len(metadata))
	prefix := make([]*model.Model, 0)
	contains := make([]*model.Model, 0)
	suffix := make([]*model.Model, 0)
	for i := range metadata {
		item := &metadata[i]
		switch item.NameRule {
		case model.NameRulePrefix:
			prefix = append(prefix, item)
		case model.NameRuleContains:
			contains = append(contains, item)
		case model.NameRuleSuffix:
			suffix = append(suffix, item)
		default:
			exact[item.ModelName] = item
		}
	}

	for _, ability := range abilities {
		modelName := strings.TrimSpace(ability.Model)
		if modelName == "" {
			continue
		}
		if _, ok := exact[modelName]; ok {
			continue
		}
		if item := matchCCSwitchModelMetadata(modelName, prefix, strings.HasPrefix); item != nil {
			exact[modelName] = item
			continue
		}
		if item := matchCCSwitchModelMetadata(modelName, contains, strings.Contains); item != nil {
			exact[modelName] = item
			continue
		}
		if item := matchCCSwitchModelMetadata(modelName, suffix, strings.HasSuffix); item != nil {
			exact[modelName] = item
		}
	}
	return exact
}

func matchCCSwitchModelMetadata(modelName string, candidates []*model.Model, match func(string, string) bool) *model.Model {
	for _, item := range candidates {
		if item.ModelName != "" && match(modelName, item.ModelName) {
			return item
		}
	}
	return nil
}

func sortedCCSwitchModelGroups(groupSet map[string]struct{}) []string {
	groups := make([]string, 0, len(groupSet))
	for group := range groupSet {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	return groups
}

func inferCCSwitchVendorName(modelName string) string {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if modelName == "" {
		return ""
	}
	for _, rule := range ccSwitchVendorInferenceRules {
		if strings.Contains(modelName, rule.Pattern) {
			return rule.VendorName
		}
	}
	return ""
}

type ccSwitchVendorInferenceRule struct {
	Pattern    string
	VendorName string
}

var ccSwitchVendorInferenceRules = []ccSwitchVendorInferenceRule{
	{Pattern: "gpt", VendorName: "OpenAI"},
	{Pattern: "dall-e", VendorName: "OpenAI"},
	{Pattern: "whisper", VendorName: "OpenAI"},
	{Pattern: "o1", VendorName: "OpenAI"},
	{Pattern: "o3", VendorName: "OpenAI"},
	{Pattern: "o4", VendorName: "OpenAI"},
	{Pattern: "claude", VendorName: "Anthropic"},
}

func sortCCSwitchModelCatalog(entries []ccSwitchModelCatalogEntry) {
	vendorLatest := make(map[string]int64)
	for _, entry := range entries {
		vendorKey := ccSwitchVendorSortKey(entry.VendorName)
		if entry.CreatedTime > vendorLatest[vendorKey] {
			vendorLatest[vendorKey] = entry.CreatedTime
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		leftVendor := ccSwitchVendorSortKey(entries[i].VendorName)
		rightVendor := ccSwitchVendorSortKey(entries[j].VendorName)
		if leftVendor != rightVendor {
			if vendorLatest[leftVendor] != vendorLatest[rightVendor] {
				return vendorLatest[leftVendor] > vendorLatest[rightVendor]
			}
			return leftVendor < rightVendor
		}
		if entries[i].CreatedTime != entries[j].CreatedTime {
			return entries[i].CreatedTime > entries[j].CreatedTime
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
}

func ccSwitchVendorSortKey(vendorName string) string {
	vendorName = strings.TrimSpace(vendorName)
	if vendorName == "" {
		return "other"
	}
	return strings.ToLower(vendorName)
}

func selectDefaultCCSwitchModel(items []dto.CCSwitchModelOption) string {
	preferredIndex := -1
	latestIndex := -1
	for i := range items {
		if latestIndex < 0 || ccSwitchModelIsNewerDefault(items[i], items[latestIndex], false) {
			latestIndex = i
		}
		if ccSwitchDefaultVendorPriority(items[i].VendorName) < 2 {
			if preferredIndex < 0 || ccSwitchModelIsNewerDefault(items[i], items[preferredIndex], true) {
				preferredIndex = i
			}
		}
	}
	if preferredIndex >= 0 {
		return items[preferredIndex].Name
	}
	if latestIndex >= 0 {
		return items[latestIndex].Name
	}
	return CCSwitchDefaultModel
}

func ccSwitchModelIsNewerDefault(candidate dto.CCSwitchModelOption, current dto.CCSwitchModelOption, preferOpenAI bool) bool {
	if candidate.CreatedTime != current.CreatedTime {
		return candidate.CreatedTime > current.CreatedTime
	}
	if preferOpenAI {
		candidatePriority := ccSwitchDefaultVendorPriority(candidate.VendorName)
		currentPriority := ccSwitchDefaultVendorPriority(current.VendorName)
		if candidatePriority != currentPriority {
			return candidatePriority < currentPriority
		}
	}
	return strings.ToLower(candidate.Name) < strings.ToLower(current.Name)
}

func ccSwitchDefaultVendorPriority(vendorName string) int {
	switch strings.ToLower(strings.TrimSpace(vendorName)) {
	case "openai":
		return 0
	case "anthropic":
		return 1
	default:
		return 2
	}
}

func ccSwitchModelAvailableToUser(modelGroups []string, usableGroups map[string]string) bool {
	for _, group := range modelGroups {
		if _, ok := usableGroups[group]; ok {
			return true
		}
	}
	return false
}

func cloneCCSwitchModelCatalog(entries []ccSwitchModelCatalogEntry) []ccSwitchModelCatalogEntry {
	cloned := make([]ccSwitchModelCatalogEntry, len(entries))
	for i, entry := range entries {
		cloned[i] = entry
		cloned[i].EnableGroups = append([]string(nil), entry.EnableGroups...)
	}
	return cloned
}
