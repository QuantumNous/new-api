package service

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const (
	ModelAccessScopeSelectableGroup = "selectable_group"
	ModelAccessScopeFixedAccount    = "fixed_account"
	modelAccessPLGGroup             = "plg"
	ModelAvailabilityUnknown        = "unknown"
)

type ModelAccessVendor struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon,omitempty"`
}

type ModelAccessModel struct {
	ID                     string                  `json:"id"`
	AllowlistMatchKey      string                  `json:"allowlist_match_key"`
	Vendor                 *ModelAccessVendor      `json:"vendor"`
	SupportedEndpointTypes []constant.EndpointType `json:"supported_endpoint_types"`
	AvailabilityStatus     string                  `json:"availability_status"`
}

type ModelAccessScope struct {
	ID          string             `json:"id"`
	Label       string             `json:"label"`
	Description string             `json:"description,omitempty"`
	Ratio       *float64           `json:"ratio"`
	ModelIDs    []string           `json:"model_ids"`
	ModelRatios map[string]float64 `json:"model_ratios"`
}

type UserModelAccess struct {
	ScopeMode            string             `json:"scope_mode"`
	IdentityScope        *string            `json:"identity_scope"`
	IdentityModelIDs     []string           `json:"identity_model_ids"`
	IdentityModelRatios  map[string]float64 `json:"identity_model_ratios"`
	IdentityDefaultRatio *float64           `json:"identity_default_ratio"`
	CreateDefaultScope   *string            `json:"create_default_scope"`
	Groups               []ModelAccessScope `json:"groups"`
	AccountModelIDs      []string           `json:"account_model_ids"`
	AccountModelRatios   map[string]float64 `json:"account_model_ratios"`
	AccountDefaultRatio  *float64           `json:"account_default_ratio"`
	Models               []ModelAccessModel `json:"models"`
}

type TokenModelAccessInput struct {
	IdentityGroup      string
	TokenGroup         string
	AcceptUnpriced     bool
	ModelLimitsEnabled bool
	ModelLimits        map[string]bool
}

type ResolvedTokenModelAccess struct {
	ModelIDs []string
	Models   []ModelAccessModel
}

// AllowlistMatchKey exposes the server-side canonical matching key without
// requiring clients to duplicate FormatMatchingModelName.
func AllowlistMatchKey(modelName string) string {
	return ratio_setting.FormatMatchingModelName(modelName)
}

// TokenAllowsModel is the single allowlist matcher used by both the strict
// resolver and relay distribution.
func TokenAllowsModel(allowlist map[string]bool, modelName string) bool {
	if len(allowlist) == 0 {
		return false
	}
	return allowlist[AllowlistMatchKey(modelName)]
}

func UserAcceptsUnpricedModels(user *model.UserBase) bool {
	return operation_setting.SelfUseModeEnabled || (user != nil && user.GetSetting().AcceptUnsetRatioModel)
}

func ResolveTokenModelAccess(input TokenModelAccessInput) (*ResolvedTokenModelAccess, error) {
	groups := resolveTokenAccessGroups(input.IdentityGroup, input.TokenGroup)
	access, err := resolveStrictModelAccess(groups, input.AcceptUnpriced)
	if err != nil {
		return nil, err
	}
	if input.ModelLimitsEnabled {
		access = filterResolvedModelAccess(access, func(modelName string) bool {
			return TokenAllowsModel(input.ModelLimits, modelName)
		})
	}
	return &ResolvedTokenModelAccess{ModelIDs: access.modelIDs, Models: access.models}, nil
}

func ResolveUserModelAccess(user *model.UserBase) (*UserModelAccess, error) {
	if user == nil {
		return &UserModelAccess{
			ScopeMode:           ModelAccessScopeSelectableGroup,
			IdentityModelIDs:    []string{},
			IdentityModelRatios: map[string]float64{},
			Groups:              []ModelAccessScope{},
			AccountModelIDs:     []string{},
			AccountModelRatios:  map[string]float64{},
			Models:              []ModelAccessModel{},
		}, nil
	}

	acceptUnpriced := UserAcceptsUnpricedModels(user)
	if user.Group == modelAccessPLGGroup || strings.TrimSpace(user.Group) == "" {
		return resolveFixedAccountModelAccess(user.Group, acceptUnpriced)
	}
	return resolveSelectableGroupModelAccess(user.Group, acceptUnpriced)
}

type strictModelAccess struct {
	modelIDs []string
	models   []ModelAccessModel
	byGroup  map[string][]string
}

func resolveStrictModelAccess(groups []string, acceptUnpriced bool) (strictModelAccess, error) {
	groups = normalizedStrings(groups)
	rows, err := model.GetModelAccessRowsForGroups(groups)
	if err != nil {
		return strictModelAccess{}, err
	}

	modelsByGroup := make(map[string]map[string]struct{}, len(groups))
	channelTypesByModel := make(map[string]map[int]struct{})
	for _, group := range groups {
		modelsByGroup[group] = make(map[string]struct{})
	}
	for _, row := range rows {
		if !modelHasVisibleBilling(row.Model, acceptUnpriced) {
			continue
		}
		if _, ok := modelsByGroup[row.GroupName]; !ok {
			modelsByGroup[row.GroupName] = make(map[string]struct{})
		}
		modelsByGroup[row.GroupName][row.Model] = struct{}{}
		if _, ok := channelTypesByModel[row.Model]; !ok {
			channelTypesByModel[row.Model] = make(map[int]struct{})
		}
		channelTypesByModel[row.Model][row.ChannelType] = struct{}{}
	}

	allModelIDs := make([]string, 0, len(channelTypesByModel))
	for modelName := range channelTypesByModel {
		allModelIDs = append(allModelIDs, modelName)
	}
	sort.Strings(allModelIDs)

	metadataByModel, err := model.GetPublicModelMetadataMap(allModelIDs)
	if err != nil {
		return strictModelAccess{}, err
	}
	availabilityByModel, err := model.GetModelAvailabilityStateMap(allModelIDs)
	if err != nil {
		return strictModelAccess{}, err
	}

	models := make([]ModelAccessModel, 0, len(allModelIDs))
	for _, modelName := range allModelIDs {
		metadata := metadataByModel[modelName]
		endpoints := publicEndpointTypes(modelName, channelTypesByModel[modelName], metadata.Endpoints)
		availability := ModelAvailabilityUnknown
		if state, ok := availabilityByModel[modelName]; ok && strings.TrimSpace(state.Status) != "" {
			availability = state.Status
		}
		models = append(models, ModelAccessModel{
			ID:                     modelName,
			AllowlistMatchKey:      AllowlistMatchKey(modelName),
			Vendor:                 publicVendor(metadata.Vendor),
			SupportedEndpointTypes: endpoints,
			AvailabilityStatus:     availability,
		})
	}

	byGroup := make(map[string][]string, len(groups))
	for _, group := range groups {
		byGroup[group] = sortedSetItems(modelsByGroup[group])
	}
	return strictModelAccess{modelIDs: allModelIDs, models: models, byGroup: byGroup}, nil
}

func resolveSelectableGroupModelAccess(identityGroup string, acceptUnpriced bool) (*UserModelAccess, error) {
	usableGroups := GetUserUsableGroups(identityGroup)
	selectableIDs := make([]string, 0)
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroups[group]; ok && group != "auto" {
			selectableIDs = append(selectableIDs, group)
		}
	}
	sort.Strings(selectableIDs)

	autoGroups := GetUserAutoGroup(identityGroup)
	_, autoSelectable := usableGroups["auto"]
	if autoSelectable {
		selectableIDs = append(selectableIDs, "auto")
	}

	queryGroups := append([]string{identityGroup}, selectableIDs...)
	queryGroups = append(queryGroups, autoGroups...)
	strict, err := resolveStrictModelAccess(queryGroups, acceptUnpriced)
	if err != nil {
		return nil, err
	}

	groups := make([]ModelAccessScope, 0, len(selectableIDs))
	for _, group := range selectableIDs {
		modelIDs := strict.byGroup[group]
		var ratio *float64
		if group == "auto" {
			modelIDs = unionGroupModels(strict.byGroup, autoGroups)
		} else {
			value := GetUserGroupRatio(identityGroup, group)
			ratio = &value
		}
		groups = append(groups, ModelAccessScope{
			ID:          group,
			Label:       group,
			Description: usableGroups[group],
			Ratio:       ratio,
			ModelIDs:    modelIDs,
			ModelRatios: explicitGroupModelRatios(group, modelIDs),
		})
	}
	sort.Slice(groups, func(i, j int) bool { return groups[i].ID < groups[j].ID })

	identity := identityGroup
	identityModelIDs := strict.byGroup[identityGroup]
	identityDefaultRatio := GetUserGroupRatio(identityGroup, identityGroup)
	defaultScope := chooseCreateDefaultScope(groups, identityGroup)
	referenced := append([]string{}, identityModelIDs...)
	for _, group := range groups {
		referenced = append(referenced, group.ModelIDs...)
	}
	models := filterModelMetadata(strict.models, normalizedStrings(referenced))
	return &UserModelAccess{
		ScopeMode:            ModelAccessScopeSelectableGroup,
		IdentityScope:        &identity,
		IdentityModelIDs:     identityModelIDs,
		IdentityModelRatios:  explicitGroupModelRatios(identityGroup, identityModelIDs),
		IdentityDefaultRatio: &identityDefaultRatio,
		CreateDefaultScope:   defaultScope,
		Groups:               groups,
		AccountModelIDs:      []string{},
		AccountModelRatios:   map[string]float64{},
		Models:               models,
	}, nil
}

func resolveFixedAccountModelAccess(group string, acceptUnpriced bool) (*UserModelAccess, error) {
	group = strings.TrimSpace(group)
	if group == "" {
		group = modelAccessPLGGroup
	}
	strict, err := resolveStrictModelAccess([]string{group}, acceptUnpriced)
	if err != nil {
		return nil, err
	}
	accountDefaultRatio := GetUserGroupRatio(group, group)
	return &UserModelAccess{
		ScopeMode:           ModelAccessScopeFixedAccount,
		IdentityModelIDs:    []string{},
		IdentityModelRatios: map[string]float64{},
		Groups:              []ModelAccessScope{},
		AccountModelIDs:     strict.modelIDs,
		AccountModelRatios:  explicitGroupModelRatios(group, strict.modelIDs),
		AccountDefaultRatio: &accountDefaultRatio,
		Models:              strict.models,
	}, nil
}

func explicitGroupModelRatios(group string, modelIDs []string) map[string]float64 {
	ratios := make(map[string]float64)
	if group == "auto" {
		return ratios
	}
	for _, modelID := range modelIDs {
		if ratio, ok, _ := ratio_setting.GetGroupModelRatio(group, modelID); ok {
			ratios[modelID] = ratio
		}
	}
	return ratios
}

func resolveTokenAccessGroups(identityGroup, tokenGroup string) []string {
	identityGroup = strings.TrimSpace(identityGroup)
	tokenGroup = strings.TrimSpace(tokenGroup)
	if identityGroup == "" {
		return []string{}
	}
	if identityGroup == modelAccessPLGGroup {
		return []string{modelAccessPLGGroup}
	}
	if tokenGroup == "" {
		return []string{identityGroup}
	}
	if tokenGroup == "auto" {
		if _, ok := GetUserUsableGroups(identityGroup)["auto"]; !ok {
			return []string{}
		}
		return GetUserAutoGroup(identityGroup)
	}
	if tokenGroup != identityGroup && !GroupInUserUsableGroups(identityGroup, tokenGroup) {
		return []string{}
	}
	return []string{tokenGroup}
}

func modelHasVisibleBilling(modelName string, acceptUnpriced bool) bool {
	if acceptUnpriced {
		return true
	}
	if billing_setting.GetBillingMode(modelName) == billing_setting.BillingModeTieredExpr {
		expr, ok := billing_setting.GetBillingExpr(modelName)
		return ok && strings.TrimSpace(expr) != ""
	}
	if _, ok := ratio_setting.GetModelPrice(modelName, false); ok {
		return true
	}
	_, ok, _ := ratio_setting.GetModelRatio(modelName)
	return ok
}

func publicEndpointTypes(modelName string, channelTypes map[int]struct{}, customEndpoints string) []constant.EndpointType {
	if strings.TrimSpace(customEndpoints) != "" {
		var raw map[string]any
		if err := common.Unmarshal([]byte(customEndpoints), &raw); err == nil {
			endpoints := make([]constant.EndpointType, 0, len(raw))
			for endpoint, value := range raw {
				switch value.(type) {
				case string, map[string]any:
					endpoints = append(endpoints, constant.EndpointType(endpoint))
				}
			}
			if len(endpoints) > 0 {
				sort.Slice(endpoints, func(i, j int) bool { return endpoints[i] < endpoints[j] })
				return endpoints
			}
		}
	}

	set := make(map[constant.EndpointType]struct{})
	for channelType := range channelTypes {
		for _, endpoint := range common.GetEndpointTypesByChannelType(channelType, modelName) {
			set[endpoint] = struct{}{}
		}
	}
	endpoints := make([]constant.EndpointType, 0, len(set))
	for endpoint := range set {
		endpoints = append(endpoints, endpoint)
	}
	sort.Slice(endpoints, func(i, j int) bool { return endpoints[i] < endpoints[j] })
	return endpoints
}

func publicVendor(vendor *model.Vendor) *ModelAccessVendor {
	if vendor == nil || strings.TrimSpace(vendor.Name) == "" {
		return nil
	}
	return &ModelAccessVendor{ID: vendor.Id, Name: vendor.Name, Icon: vendor.Icon}
}

func chooseCreateDefaultScope(groups []ModelAccessScope, identityGroup string) *string {
	available := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		available[group.ID] = struct{}{}
	}
	if setting.DefaultUseAutoGroup {
		if _, ok := available["auto"]; ok {
			value := "auto"
			return &value
		}
	}
	for _, candidate := range []string{"default", identityGroup} {
		if _, ok := available[candidate]; ok {
			value := candidate
			return &value
		}
	}
	if len(groups) == 0 {
		return nil
	}
	value := groups[0].ID
	return &value
}

func unionGroupModels(byGroup map[string][]string, groups []string) []string {
	models := make([]string, 0)
	for _, group := range groups {
		models = append(models, byGroup[group]...)
	}
	return normalizedStrings(models)
}

func normalizedStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func sortedSetItems(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func filterResolvedModelAccess(access strictModelAccess, keep func(string) bool) strictModelAccess {
	ids := make([]string, 0, len(access.modelIDs))
	for _, modelName := range access.modelIDs {
		if keep(modelName) {
			ids = append(ids, modelName)
		}
	}
	access.modelIDs = ids
	access.models = filterModelMetadata(access.models, ids)
	for group, modelIDs := range access.byGroup {
		filtered := make([]string, 0, len(modelIDs))
		for _, modelName := range modelIDs {
			if keep(modelName) {
				filtered = append(filtered, modelName)
			}
		}
		access.byGroup[group] = filtered
	}
	return access
}

func filterModelMetadata(models []ModelAccessModel, modelIDs []string) []ModelAccessModel {
	wanted := make(map[string]struct{}, len(modelIDs))
	for _, modelID := range modelIDs {
		wanted[modelID] = struct{}{}
	}
	filtered := make([]ModelAccessModel, 0, len(wanted))
	for _, item := range models {
		if _, ok := wanted[item.ID]; ok {
			filtered = append(filtered, item)
		}
	}
	return filtered
}
