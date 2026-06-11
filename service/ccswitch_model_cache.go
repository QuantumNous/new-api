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

const ccSwitchRecentModelsPerVendor = 3

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

func GetCCSwitchModels(userID int, tokenID int, keyword string) (*dto.CCSwitchModelsResponse, error) {
	if _, err := model.GetTokenByIds(tokenID, userID); err != nil {
		return nil, err
	}
	user, err := model.GetUserCache(userID)
	if err != nil {
		return nil, err
	}
	entries, err := getCCSwitchModelCatalog()
	if err != nil {
		return nil, err
	}

	usableGroups := GetUserUsableGroups(user.Group)
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	filtered := make([]ccSwitchModelCatalogEntry, 0, len(entries))
	for _, entry := range entries {
		if !ccSwitchModelAvailableToUser(entry.EnableGroups, usableGroups) {
			continue
		}
		if keyword != "" && !strings.Contains(strings.ToLower(entry.Name), keyword) {
			continue
		}
		filtered = append(filtered, entry)
	}

	if keyword == "" {
		vendorCounts := make(map[int]int)
		recent := filtered[:0]
		for _, entry := range filtered {
			if vendorCounts[entry.VendorID] >= ccSwitchRecentModelsPerVendor {
				continue
			}
			vendorCounts[entry.VendorID]++
			recent = append(recent, entry)
		}
		filtered = recent
	}

	items := make([]dto.CCSwitchModelOption, 0, len(filtered))
	for _, entry := range filtered {
		items = append(items, entry.CCSwitchModelOption)
	}
	return &dto.CCSwitchModelsResponse{Items: items}, nil
}

func InvalidateCCSwitchModelCache() {
	ccSwitchModelCatalog.Lock()
	ccSwitchModelCatalog.initialized = false
	ccSwitchModelCatalog.Unlock()
}

func StartCCSwitchModelCacheRefreshTask() {
	ccSwitchModelCacheTaskOnce.Do(func() {
		gopool.Go(func() {
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
	return time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
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
	ccSwitchModelCatalog.entries = entries
	ccSwitchModelCatalog.initialized = true
	ccSwitchModelCatalog.Unlock()
	return nil
}

func buildCCSwitchModelCatalog() ([]ccSwitchModelCatalogEntry, error) {
	pricing := model.GetPricing()
	metadata, err := model.GetAllModelsMetadata()
	if err != nil {
		return nil, err
	}
	createdTimeByName := make(map[string]int64, len(metadata))
	for _, item := range metadata {
		createdTimeByName[item.ModelName] = item.CreatedTime
	}

	vendors, err := model.GetAllVendorsMetadata()
	if err != nil {
		return nil, err
	}
	vendorNames := make(map[int]string, len(vendors))
	for _, vendor := range vendors {
		vendorNames[vendor.Id] = vendor.Name
	}

	entries := make([]ccSwitchModelCatalogEntry, 0, len(pricing))
	seen := make(map[string]struct{}, len(pricing))
	for _, item := range pricing {
		if _, ok := seen[item.ModelName]; ok {
			continue
		}
		seen[item.ModelName] = struct{}{}
		vendorName := strings.TrimSpace(vendorNames[item.VendorID])
		if vendorName == "" {
			vendorName = "Other"
		}
		entries = append(entries, ccSwitchModelCatalogEntry{
			CCSwitchModelOption: dto.CCSwitchModelOption{
				Name:        item.ModelName,
				VendorID:    item.VendorID,
				VendorName:  vendorName,
				CreatedTime: createdTimeByName[item.ModelName],
			},
			EnableGroups: append([]string(nil), item.EnableGroup...),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].CreatedTime != entries[j].CreatedTime {
			return entries[i].CreatedTime > entries[j].CreatedTime
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
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
