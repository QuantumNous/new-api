package service

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type AssetReadinessClass int

const (
	AssetReadinessIneligible     AssetReadinessClass = -1
	AssetReadinessVerifiedTarget AssetReadinessClass = 0
	AssetReadinessAllBound       AssetReadinessClass = 1
	AssetReadinessPartialBound   AssetReadinessClass = 2
	AssetReadinessRecoverable    AssetReadinessClass = 3
)

type ChannelReadinessRanker interface {
	ChannelReadiness(channel *model.Channel) (AssetReadinessClass, bool)
}

type AssetReferenceSet struct {
	references          []assetReference
	assets              map[string]assetReferenceAsset
	strictCoverage      bool
	scope               AssetModelScope
	target              *model.AssetModelCoverageTarget
	readinessByPublicID map[string]model.AssetModelReadiness
	preparationChannels map[int]struct{}
}

type assetReference struct {
	PublicID          string
	ExpectedAssetType string
}

type assetReferenceAsset struct {
	ID              int64
	PublicID        string
	AssetType       string
	Status          string
	SourceStatus    string
	StorageBackend  string
	StorageBucket   string
	ObjectKey       string
	SourceExpiresAt int64
	LegacyBytePlus  bool
	Bindings        []assetReferenceBinding
}

type assetReferenceBinding struct {
	ChannelID       int
	BindingScope    string
	UpstreamAssetID string
	Status          string
}

func (s AssetReferenceSet) HasReferences() bool {
	return len(s.references) > 0
}

func (s AssetReferenceSet) ChannelRanker(modelName ...string) ChannelReadinessRanker {
	if !s.HasReferences() {
		return nil
	}
	originModel := ""
	if len(modelName) > 0 {
		originModel = strings.TrimSpace(modelName[0])
	}
	return assetReferenceRanker{set: s, originModel: originModel}
}

func (s AssetReferenceSet) ReadinessForChannel(channel *model.Channel, modelName ...string) (AssetReadinessClass, bool) {
	originModel := ""
	if len(modelName) > 0 {
		originModel = strings.TrimSpace(modelName[0])
	}
	return s.readinessForChannelModel(channel, originModel)
}

func (s AssetReferenceSet) readinessForChannelModel(channel *model.Channel, originModel string) (AssetReadinessClass, bool) {
	if !s.HasReferences() || channel == nil {
		return AssetReadinessIneligible, false
	}
	if s.strictCoverage {
		if s.target == nil {
			return s.preparationReadinessForChannel(channel)
		}
		return s.targetReadinessForChannel(channel, originModel)
	}
	techMobiScopes, scopesOK := assetBindingScopesForRequest(channel, originModel)
	if !scopesOK {
		return AssetReadinessIneligible, false
	}
	if !assetBindingScopesRequireSingleScope(channel) {
		return s.readinessForChannelScope(channel, techMobiScopes)
	}
	bestReadiness := AssetReadinessIneligible
	for scope := range techMobiScopes {
		readiness, eligible := s.readinessForChannelScope(channel, map[string]struct{}{scope: {}})
		if eligible && (bestReadiness == AssetReadinessIneligible || readiness < bestReadiness) {
			bestReadiness = readiness
		}
	}
	return bestReadiness, bestReadiness != AssetReadinessIneligible
}

func assetBindingScopesRequireSingleScope(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err == nil && explicit {
		descriptor, ok := assetMaterializationProviderDescriptors[config.Provider]
		return ok && descriptor.CredentialScoped
	}
	return channel.Type == constant.ChannelTypeTechMobiVideo
}

func (s AssetReferenceSet) preparationReadinessForChannel(channel *model.Channel) (AssetReadinessClass, bool) {
	if channel == nil || len(s.preparationChannels) == 0 {
		return AssetReadinessIneligible, false
	}
	if _, ok := s.preparationChannels[channel.Id]; !ok {
		return AssetReadinessIneligible, false
	}
	for _, reference := range s.references {
		asset, ok := s.assets[reference.PublicID]
		if !ok || asset.AssetType != reference.ExpectedAssetType || !channelCanConsumeAssetType(channel, asset.AssetType) {
			return AssetReadinessIneligible, false
		}
	}
	return AssetReadinessRecoverable, true
}

func (s AssetReferenceSet) readinessForChannelScope(channel *model.Channel, techMobiScopes map[string]struct{}) (AssetReadinessClass, bool) {
	activeBindings := 0
	recoverableSources := 0
	for _, reference := range s.references {
		asset, ok := s.assets[reference.PublicID]
		if !ok || asset.AssetType != reference.ExpectedAssetType || !channelCanConsumeAssetType(channel, asset.AssetType) {
			return AssetReadinessIneligible, false
		}
		if binding, ok := activeAssetReferenceBindingForRequest(asset.Bindings, channel, techMobiScopes); ok {
			if asset.LegacyBytePlus && channel.Type != constant.ChannelTypeBytePlus {
				return AssetReadinessIneligible, false
			}
			if strings.TrimSpace(binding.UpstreamAssetID) == "" {
				return AssetReadinessIneligible, false
			}
			activeBindings++
			continue
		}
		if assetReferenceSourceRecoverable(asset) {
			recoverableSources++
			continue
		}
		return AssetReadinessIneligible, false
	}
	switch {
	case activeBindings == len(s.references):
		return AssetReadinessAllBound, true
	case activeBindings > 0 && activeBindings+recoverableSources == len(s.references):
		return AssetReadinessPartialBound, true
	case recoverableSources == len(s.references):
		return AssetReadinessRecoverable, true
	default:
		return AssetReadinessIneligible, false
	}
}

func (s AssetReferenceSet) targetReadinessForChannel(channel *model.Channel, originModel string) (AssetReadinessClass, bool) {
	if s.target == nil || channel == nil || channel.Id != s.target.ChannelId {
		return AssetReadinessIneligible, false
	}
	if !assetReferenceTargetMatchesScope(s.scope, *s.target, originModel) {
		return AssetReadinessIneligible, false
	}
	for _, reference := range s.references {
		asset, ok := s.assets[reference.PublicID]
		if !ok || asset.AssetType != reference.ExpectedAssetType || !channelCanConsumeAssetType(channel, asset.AssetType) {
			return AssetReadinessIneligible, false
		}
		row, ok := s.readinessByPublicID[reference.PublicID]
		if !ok || !assetModelReadinessMatchesTarget(row, *s.target) || row.AssetId != asset.ID || row.Status != model.AssetModelReadinessStatusActive {
			return AssetReadinessRecoverable, true
		}
		if AssetModelChannelUsesSourceURLForChannel(channel) && s.target.BindingScope == assetModelSourceURLBindingScopeModelAPI {
			if assetReferenceSourceURLRecoverable(asset) {
				continue
			}
			return AssetReadinessRecoverable, true
		}
		if _, ok := activeAssetReferenceBindingForScope(asset.Bindings, channel.Id, s.target.BindingScope); !ok {
			return AssetReadinessRecoverable, true
		}
	}
	return AssetReadinessVerifiedTarget, true
}

func assetReferenceTargetMatchesScope(scope AssetModelScope, target model.AssetModelCoverageTarget, originModel string) bool {
	if target.Status != model.AssetModelTargetStatusActive ||
		strings.TrimSpace(target.ScopeKey) == "" ||
		strings.TrimSpace(target.ModelName) == "" ||
		target.ChannelId <= 0 {
		return false
	}
	if strings.TrimSpace(originModel) != "" && strings.TrimSpace(originModel) != strings.TrimSpace(target.ModelName) {
		return false
	}
	if strings.TrimSpace(scope.ScopeKey) == "" {
		return false
	}
	return activeAssetModelTargetForScope(scope, target)
}

func (s AssetReferenceSet) RewriteMapForChannel(channelID int) map[string]string {
	if !s.HasReferences() || channelID <= 0 {
		return nil
	}
	return s.rewriteMapForChannel(&model.Channel{Id: channelID}, nil)
}

func (s AssetReferenceSet) RewriteMapForSelectedChannel(channel *model.Channel, originModel string, apiKey string) map[string]string {
	if !s.HasReferences() || channel == nil || channel.Id <= 0 {
		return nil
	}
	if s.strictCoverage {
		if s.target == nil {
			return nil
		}
		if readiness, ok := s.targetReadinessForChannel(channel, originModel); !ok || readiness != AssetReadinessVerifiedTarget {
			return nil
		}
		return s.rewriteMapForChannel(channel, map[string]struct{}{s.target.BindingScope: {}})
	}
	bindingScopes, ok := assetBindingScopesForSelectedKey(channel, originModel, apiKey)
	if !ok {
		return nil
	}
	return s.rewriteMapForChannel(channel, bindingScopes)
}

func (s AssetReferenceSet) rewriteMapForChannel(channel *model.Channel, techMobiScopes map[string]struct{}) map[string]string {
	rewriteMap := make(map[string]string)
	for _, reference := range s.references {
		asset := s.assets[reference.PublicID]
		if binding, ok := activeAssetReferenceBindingForRequest(asset.Bindings, channel, techMobiScopes); ok {
			upstreamURI := assetBindingRewriteURI(binding.UpstreamAssetID)
			if upstreamURI != "" {
				rewriteMap["asset://"+reference.PublicID] = upstreamURI
			}
		}
	}
	if len(rewriteMap) == 0 {
		return nil
	}
	return rewriteMap
}

type assetReferenceRanker struct {
	set         AssetReferenceSet
	originModel string
}

func (r assetReferenceRanker) ChannelReadiness(channel *model.Channel) (AssetReadinessClass, bool) {
	return r.set.readinessForChannelModel(channel, r.originModel)
}

func activeAssetReferenceBindingForRequest(bindings []assetReferenceBinding, channel *model.Channel, techMobiScopes map[string]struct{}) (assetReferenceBinding, bool) {
	if channel == nil {
		return assetReferenceBinding{}, false
	}
	if techMobiScopes == nil {
		return activeAssetReferenceBindingForChannel(bindings, channel.Id)
	}
	for _, binding := range bindings {
		if binding.ChannelID != channel.Id || !isActiveAssetReferenceBinding(binding) {
			continue
		}
		if _, ok := techMobiScopes[binding.BindingScope]; ok {
			return binding, true
		}
	}
	return assetReferenceBinding{}, false
}

func assetBindingScopesForRequest(channel *model.Channel, originModel string) (map[string]struct{}, bool) {
	if channel == nil {
		return nil, false
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return nil, false
	}
	if explicit {
		switch config.Provider {
		case assetMaterializationProviderSeedanceProxy, assetMaterializationProviderTokenSpaceMaterial:
		default:
			return nil, false
		}
		mappedModel, ok := assetReferenceMappedModel(channel.GetModelMapping(), originModel)
		if !ok || strings.TrimSpace(mappedModel) == "" {
			return nil, false
		}
		keys := enabledAssetMaterializeKeys(channel)
		if len(keys) == 0 {
			return nil, false
		}
		scopes := make(map[string]struct{}, len(keys))
		for _, key := range keys {
			scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: mappedModel, APIKey: key.key})
			if err != nil {
				continue
			}
			scopes[scope] = struct{}{}
		}
		return scopes, len(scopes) > 0
	}
	if channel.Type != constant.ChannelTypeTechMobiVideo {
		return nil, true
	}
	if strings.TrimSpace(originModel) == "" {
		return nil, false
	}
	mappedModel, ok := assetReferenceMappedModel(channel.GetModelMapping(), originModel)
	if !ok {
		return nil, false
	}
	keys := enabledAssetMaterializeKeys(channel)
	if len(keys) == 0 {
		return nil, false
	}
	scopes := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: mappedModel, APIKey: key.key})
		if err != nil {
			continue
		}
		scopes[scope] = struct{}{}
	}
	return scopes, len(scopes) > 0
}

func assetBindingScopesForSelectedKey(channel *model.Channel, originModel string, apiKey string) (map[string]struct{}, bool) {
	if channel == nil {
		return nil, false
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return nil, false
	}
	if explicit {
		switch config.Provider {
		case assetMaterializationProviderSeedanceProxy, assetMaterializationProviderTokenSpaceMaterial:
		default:
			return nil, false
		}
		mappedModel, ok := assetReferenceMappedModel(channel.GetModelMapping(), originModel)
		if !ok || strings.TrimSpace(mappedModel) == "" {
			return nil, false
		}
		scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: mappedModel, APIKey: strings.TrimSpace(apiKey)})
		if err != nil {
			return nil, false
		}
		return map[string]struct{}{scope: {}}, true
	}
	if channel.Type != constant.ChannelTypeTechMobiVideo {
		return nil, true
	}
	mappedModel, ok := assetReferenceMappedModel(channel.GetModelMapping(), originModel)
	if !ok {
		return nil, false
	}
	scope, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{
		Model:  mappedModel,
		APIKey: strings.TrimSpace(apiKey),
	})
	if err != nil {
		return nil, false
	}
	return map[string]struct{}{scope: {}}, true
}

func assetReferenceMappedModel(rawMapping string, originModel string) (string, bool) {
	current := strings.TrimSpace(originModel)
	if current == "" {
		return "", false
	}
	rawMapping = strings.TrimSpace(rawMapping)
	if rawMapping == "" || rawMapping == "{}" {
		return current, true
	}
	modelMap := make(map[string]string)
	if err := common.Unmarshal([]byte(rawMapping), &modelMap); err != nil {
		return "", false
	}
	visited := map[string]struct{}{current: {}}
	for {
		mapped := strings.TrimSpace(modelMap[current])
		if mapped == "" || mapped == current {
			return current, true
		}
		if _, exists := visited[mapped]; exists {
			return "", false
		}
		visited[mapped] = struct{}{}
		current = mapped
	}
}

func ResolveAssetReferences(c *gin.Context, userID int, req *dto.SeedanceVideoRequest) (AssetReferenceSet, *types.NewAPIError) {
	references, apiErr := extractAssetReferences(req)
	if apiErr != nil {
		return AssetReferenceSet{}, apiErr
	}
	if len(references) == 0 {
		return AssetReferenceSet{}, nil
	}
	publicIDs := make([]string, 0, len(references))
	for _, reference := range references {
		publicIDs = append(publicIDs, reference.PublicID)
	}
	generalized, err := model.GetAssetsWithBindingsByPublicIDsForUser(userID, publicIDs)
	if err != nil {
		return AssetReferenceSet{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	missing := make([]string, 0, len(publicIDs))
	for _, publicID := range publicIDs {
		if _, ok := generalized[publicID]; !ok {
			missing = append(missing, publicID)
		}
	}
	legacy, err := model.GetBytePlusAssetsByPublicIDsForUser(userID, missing)
	if err != nil {
		return AssetReferenceSet{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}

	assets := make(map[string]assetReferenceAsset, len(generalized)+len(legacy))
	for publicID, item := range generalized {
		asset := assetReferenceAsset{
			ID:              item.Asset.Id,
			PublicID:        publicID,
			AssetType:       item.Asset.AssetType,
			Status:          item.Asset.Status,
			SourceStatus:    item.Asset.SourceStatus,
			StorageBackend:  item.Asset.StorageBackend,
			StorageBucket:   item.Asset.StorageBucket,
			ObjectKey:       item.Asset.ObjectKey,
			SourceExpiresAt: item.Asset.SourceExpiresAt,
			Bindings:        make([]assetReferenceBinding, 0, len(item.Bindings)),
		}
		for _, binding := range item.Bindings {
			asset.Bindings = append(asset.Bindings, assetReferenceBinding{
				ChannelID:       binding.ChannelId,
				BindingScope:    binding.BindingScope,
				UpstreamAssetID: binding.UpstreamAssetId,
				Status:          binding.Status,
			})
		}
		sort.SliceStable(asset.Bindings, func(i, j int) bool {
			return asset.Bindings[i].ChannelID < asset.Bindings[j].ChannelID
		})
		assets[publicID] = asset
	}
	for _, legacyAsset := range legacy {
		assets[legacyAsset.PublicId] = assetReferenceAsset{
			PublicID:       legacyAsset.PublicId,
			AssetType:      legacyAsset.AssetType,
			Status:         legacyAsset.Status,
			SourceStatus:   model.AssetSourceStatusUnavailable,
			LegacyBytePlus: true,
			Bindings: []assetReferenceBinding{{
				ChannelID:       legacyAsset.ChannelId,
				UpstreamAssetID: legacyAsset.UpstreamAssetId,
				Status:          legacyAsset.Status,
			}},
		}
	}

	set := AssetReferenceSet{references: references, assets: assets, strictCoverage: AssetModelCoverageStrictEnabled}
	for _, reference := range references {
		asset, ok := assets[reference.PublicID]
		if !ok {
			return AssetReferenceSet{}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		}
		if asset.AssetType != reference.ExpectedAssetType {
			return AssetReferenceSet{}, assetError(errors.New("asset type does not match media type"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
		if apiErr := validateAssetReferenceLifecycle(asset.Status); apiErr != nil {
			return AssetReferenceSet{}, apiErr
		}
		if !assetHasActiveBinding(asset) && assetReferenceSourceExpired(asset) {
			return AssetReferenceSet{}, assetError(errors.New("asset expired"), types.ErrorCodeAssetExpired, http.StatusGone)
		}
	}
	if AssetModelCoverageStrictEnabled {
		if err := set.loadAssetModelTargetReadiness(c, userID, req); err != nil {
			return AssetReferenceSet{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
	}
	return set, nil
}

func (s *AssetReferenceSet) loadAssetModelTargetReadiness(c *gin.Context, userID int, req *dto.SeedanceVideoRequest) error {
	if s == nil || !s.HasReferences() || req == nil || strings.TrimSpace(req.Model) == "" {
		return nil
	}
	scope, err := ResolveAssetModelScopeForContext(c, userID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(scope.ScopeKey) == "" {
		scope.ScopeKey, err = assetModelScopeKey(scope)
		if err != nil {
			return err
		}
	}
	s.scope = scope
	now, err := model.GetDBTimestampWithContext(ginRequestContext(c))
	if err != nil {
		return err
	}
	for _, reference := range s.references {
		asset := s.assets[reference.PublicID]
		if asset.ID <= 0 {
			continue
		}
		if err := model.EnsureAssetModelReadiness(asset.ID, scope.ScopeKey, []string{req.Model}, now); err != nil {
			return err
		}
	}
	target, err := EnsureAssetModelCoverageTargetContext(ginRequestContext(c), scope, req.Model, assetBindingLeaseOwner())
	if err != nil {
		if errors.Is(err, ErrAssetBindingInitializing) {
			candidates, candidateErr := AssetModelTargetCandidates(scope, req.Model)
			if candidateErr != nil {
				return candidateErr
			}
			s.preparationChannels = make(map[int]struct{}, len(candidates))
			for _, candidate := range candidates {
				if candidate.ChannelID > 0 {
					s.preparationChannels[candidate.ChannelID] = struct{}{}
				}
			}
			return nil
		}
		if errors.Is(err, ErrAssetBindingUnavailable) {
			return nil
		}
		return err
	}
	if target == nil {
		return nil
	}
	readinessByPublicID := make(map[string]model.AssetModelReadiness, len(s.references))
	for _, reference := range s.references {
		asset := s.assets[reference.PublicID]
		if asset.ID <= 0 {
			continue
		}
		rows, err := model.ListAssetModelReadiness(asset.ID, scope.ScopeKey, []string{req.Model})
		if err != nil {
			return err
		}
		if len(rows) > 0 {
			readinessByPublicID[reference.PublicID] = rows[len(rows)-1]
		}
	}
	s.target = target
	s.readinessByPublicID = readinessByPublicID
	return nil
}

func ginRequestContext(c *gin.Context) context.Context {
	if c != nil && c.Request != nil {
		return c.Request.Context()
	}
	return context.Background()
}

func ResolveLegacyBytePlusAssetBindingReferences(userID int, req *dto.SeedanceVideoRequest) (BytePlusAssetReferenceResolution, *types.NewAPIError) {
	references, apiErr := extractAssetReferences(req)
	if apiErr != nil {
		return BytePlusAssetReferenceResolution{}, apiErr
	}
	if len(references) == 0 {
		return BytePlusAssetReferenceResolution{}, nil
	}
	publicIDs := make([]string, 0, len(references))
	for _, reference := range references {
		publicIDs = append(publicIDs, reference.PublicID)
	}
	generalized, err := model.GetAssetsWithBindingsByPublicIDsForUser(userID, publicIDs)
	if err != nil {
		return BytePlusAssetReferenceResolution{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	legacyAssets, err := model.GetBytePlusAssetsByPublicIDsForUser(userID, publicIDs)
	if err != nil {
		return BytePlusAssetReferenceResolution{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	byPublicID := make(map[string]model.BytePlusAsset, len(legacyAssets))
	for _, asset := range legacyAssets {
		byPublicID[asset.PublicId] = asset
	}
	fallbackReferences := make([]assetReference, 0, len(references))
	for _, reference := range references {
		legacyAsset, hasLegacy := byPublicID[reference.PublicID]
		_, hasGeneralized := generalized[reference.PublicID]
		if hasGeneralized && (!hasLegacy || legacyAsset.RealPersonProfileId == nil) {
			continue
		}
		fallbackReferences = append(fallbackReferences, reference)
	}
	if len(fallbackReferences) == 0 {
		return BytePlusAssetReferenceResolution{}, nil
	}
	if apiErr := validateLegacyBytePlusRealPersonReferences(userID, fallbackReferences, byPublicID); apiErr != nil {
		return BytePlusAssetReferenceResolution{}, apiErr
	}
	for _, reference := range fallbackReferences {
		if _, ok := byPublicID[reference.PublicID]; !ok {
			return BytePlusAssetReferenceResolution{}, nil
		}
	}
	positiveChannels := map[int]struct{}{}
	rewriteByChannel := map[int]map[string]string{}
	hasBlankUpstream := false
	for _, reference := range fallbackReferences {
		asset, ok := byPublicID[reference.PublicID]
		if !ok {
			return BytePlusAssetReferenceResolution{}, nil
		}
		if asset.ChannelId <= 0 {
			continue
		}
		positiveChannels[asset.ChannelId] = struct{}{}
		if rewriteByChannel[asset.ChannelId] == nil {
			rewriteByChannel[asset.ChannelId] = map[string]string{}
		}
		upstreamID := strings.TrimSpace(asset.UpstreamAssetId)
		if upstreamID != "" {
			rewriteByChannel[asset.ChannelId]["asset://"+reference.PublicID] = "asset://" + upstreamID
		} else {
			hasBlankUpstream = true
		}
	}
	pinnedChannelID := lowestChannelID(positiveChannels)
	if pinnedChannelID == 0 {
		return BytePlusAssetReferenceResolution{}, nil
	}
	if len(positiveChannels) > 1 {
		return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset channels do not match"), types.ErrorCodeAssetChannelConflict, http.StatusConflict)
	}
	if hasBlankUpstream {
		return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
	}
	return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID, RewriteMap: rewriteByChannel[pinnedChannelID]}, nil
}

func validateLegacyBytePlusRealPersonReferences(userID int, references []assetReference, byPublicID map[string]model.BytePlusAsset) *types.NewAPIError {
	profileIDs := make(map[int64]struct{})
	for _, reference := range references {
		asset, ok := byPublicID[reference.PublicID]
		if !ok {
			continue
		}
		if asset.Status == model.BytePlusAssetStatusDeleted {
			return assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		}
		if asset.RealPersonProfileId != nil {
			profileIDs[*asset.RealPersonProfileId] = struct{}{}
		}
	}
	if len(profileIDs) > 1 {
		return assetError(errors.New("asset real person profiles do not match"), types.ErrorCodeAssetProfileConflict, http.StatusConflict)
	}
	for profileID := range profileIDs {
		profile, err := model.GetBytePlusRealPersonProfileByIDForUser(userID, profileID)
		if err != nil {
			if model.IsBytePlusRealPersonNotFound(err) {
				return assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
			}
			return assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		if profile.Status != model.BytePlusRealPersonProfileStatusActive {
			return assetError(errors.New("real person profile is not active"), types.ErrorCodeRealPersonNotActive, http.StatusConflict)
		}
		for _, reference := range references {
			asset, ok := byPublicID[reference.PublicID]
			if ok && asset.RealPersonProfileId != nil && *asset.RealPersonProfileId == profileID && asset.ChannelId != profile.ChannelId {
				return assetError(errors.New("asset channel does not match real person profile"), types.ErrorCodeAssetChannelConflict, http.StatusConflict)
			}
		}
	}
	return nil
}

func extractAssetReferences(req *dto.SeedanceVideoRequest) ([]assetReference, *types.NewAPIError) {
	if req == nil {
		return nil, nil
	}
	seen := make(map[string]struct{})
	references := make([]assetReference, 0)
	add := func(raw string, expectedAssetType string) *types.NewAPIError {
		matches := bytePlusAssetURIPattern.FindStringSubmatch(raw)
		if len(matches) != 2 {
			if isMalformedBytePlusAssetURI(raw) {
				return assetError(errors.New("invalid asset URI"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
			}
			return nil
		}
		key := matches[1] + "\x00" + expectedAssetType
		if _, ok := seen[key]; ok {
			return nil
		}
		seen[key] = struct{}{}
		references = append(references, assetReference{PublicID: matches[1], ExpectedAssetType: expectedAssetType})
		return nil
	}
	for _, item := range req.Content {
		if item.ImageURL != nil {
			if apiErr := add(item.ImageURL.URL, "Image"); apiErr != nil {
				return nil, apiErr
			}
		}
		if item.VideoURL != nil {
			if apiErr := add(item.VideoURL.URL, "Video"); apiErr != nil {
				return nil, apiErr
			}
		}
		if item.AudioURL != nil {
			if apiErr := add(item.AudioURL.URL, "Audio"); apiErr != nil {
				return nil, apiErr
			}
		}
	}
	return references, nil
}

func validateAssetReferenceLifecycle(status string) *types.NewAPIError {
	switch status {
	case model.AssetStatusActive:
		return nil
	case model.AssetStatusFailed:
		return assetError(errors.New("asset failed"), types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
	case model.AssetStatusCreating, model.AssetStatusProcessing:
		return assetError(errors.New("asset is not ready"), types.ErrorCodeAssetNotReady, http.StatusConflict)
	case model.AssetStatusExpired:
		return assetError(errors.New("asset expired"), types.ErrorCodeAssetExpired, http.StatusGone)
	default:
		return assetError(errors.New("asset is not ready"), types.ErrorCodeAssetNotReady, http.StatusConflict)
	}
}

func assetHasActiveBinding(asset assetReferenceAsset) bool {
	for _, binding := range asset.Bindings {
		if isActiveAssetReferenceBinding(binding) {
			return true
		}
	}
	return false
}

func activeAssetReferenceBindingForChannel(bindings []assetReferenceBinding, channelID int) (assetReferenceBinding, bool) {
	for _, binding := range bindings {
		if binding.ChannelID == channelID && isActiveAssetReferenceBinding(binding) {
			return binding, true
		}
	}
	return assetReferenceBinding{}, false
}

func isActiveAssetReferenceBinding(binding assetReferenceBinding) bool {
	return binding.ChannelID > 0 && binding.Status == model.AssetStatusActive && strings.TrimSpace(binding.UpstreamAssetID) != ""
}

func assetReferenceSourceRecoverable(asset assetReferenceAsset) bool {
	if asset.SourceStatus != model.AssetSourceStatusAvailable {
		return false
	}
	if strings.ToLower(strings.TrimSpace(asset.StorageBackend)) != defaultAssetStorageBackend {
		return false
	}
	if strings.TrimSpace(asset.StorageBucket) == "" || strings.TrimSpace(asset.ObjectKey) == "" {
		return false
	}
	return asset.SourceExpiresAt > assetNow().Unix()
}

func assetReferenceSourceURLRecoverable(asset assetReferenceAsset) bool {
	return asset.Status == model.AssetStatusActive && assetReferenceSourceRecoverable(asset)
}

func assetReferenceSourceExpired(asset assetReferenceAsset) bool {
	if asset.SourceStatus == model.AssetSourceStatusExpired || asset.Status == model.AssetStatusExpired {
		return true
	}
	return asset.SourceStatus == model.AssetSourceStatusAvailable && asset.SourceExpiresAt > 0 && asset.SourceExpiresAt <= assetNow().Unix()
}

func channelCanConsumeAssetType(channel *model.Channel, assetType string) bool {
	if channel == nil {
		return false
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if explicit {
		if err != nil {
			return false
		}
		switch config.Provider {
		case assetMaterializationProviderSeedanceProxy:
			return assetType == "Image" || assetType == "Video" || assetType == "Audio"
		case assetMaterializationProviderTokenSpaceMaterial:
			return assetType == "Image" || assetType == "Video" || assetType == "Audio"
		default:
			return false
		}
	}
	switch channel.Type {
	case constant.ChannelTypeBytePlus:
		return assetType == "Image" || assetType == "Video" || assetType == "Audio"
	case constant.ChannelTypeModelAPISeedance:
		return assetType == "Image" || assetType == "Video" || assetType == "Audio"
	case constant.ChannelTypeBlockRunSeedance, constant.ChannelTypeBlockRunVideo, constant.ChannelTypeSora, constant.ChannelTypeTechMobiVideo, constant.ChannelTypeXaiGrokVideo:
		return assetType == "Image" || assetType == "Video"
	default:
		return assetType == "Image" || assetType == "Video"
	}
}

func assetReferenceBestBoundChannel(set AssetReferenceSet) (int, map[string]string, bool) {
	commonChannels := map[int]struct{}{}
	for idx, reference := range set.references {
		channels := map[int]struct{}{}
		for _, binding := range set.assets[reference.PublicID].Bindings {
			if isActiveAssetReferenceBinding(binding) {
				channels[binding.ChannelID] = struct{}{}
			}
		}
		if idx == 0 {
			commonChannels = channels
			continue
		}
		for channelID := range commonChannels {
			if _, ok := channels[channelID]; !ok {
				delete(commonChannels, channelID)
			}
		}
	}
	bestChannelID := lowestChannelID(commonChannels)
	if bestChannelID == 0 {
		return 0, nil, false
	}
	if readiness, ok := set.ReadinessForChannel(&model.Channel{Id: bestChannelID, Type: constant.ChannelTypeBytePlus}); !ok || readiness != AssetReadinessAllBound {
		return bestChannelID, nil, false
	}
	return bestChannelID, set.RewriteMapForChannel(bestChannelID), true
}
