package model

import (
	"errors"
	"sort"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ModelPolicyPriorityMin = -999
	ModelPolicyPriorityMax = 9999
)

var (
	ErrModelPolicyInvalidPriority           = errors.New("invalid model policy priority")
	ErrModelPolicyInvalidOrder              = errors.New("invalid model policy order")
	ErrModelPolicyNotFound                  = errors.New("model policy not found")
	ErrModelPolicyStaleSnapshot             = errors.New("stale model policy snapshot")
	ErrModelPolicyDuplicatePriorityConflict = errors.New("duplicate model policy priority conflict")
	ErrModelPolicyPriorityRangeExhausted    = errors.New("model policy priority range exhausted")
)

type ModelPolicyPrioritySnapshot struct {
	ChannelID      int64 `json:"channel_id"`
	ManualPriority int   `json:"manual_priority"`
}

type ModelPolicyPriorityChange struct {
	ChannelID      int64 `json:"channel_id"`
	ManualPriority int   `json:"manual_priority"`
}

type ModelPolicyPriorityMutationResult struct {
	RequestedModel string                      `json:"requested_model"`
	Changed        []ModelPolicyPriorityChange `json:"changed"`
	Policies       []ChannelModelPolicy        `json:"policies"`
	PreviousOrder  []int64                     `json:"-"`
	CurrentOrder   []int64                     `json:"-"`
}

// ChannelModelPolicy is the persisted routing policy for channel_id × requested_model (PRD §31 / §32).
type ChannelModelPolicy struct {
	ChannelID      int64  `json:"channel_id" gorm:"primaryKey;autoIncrement:false"`
	RequestedModel string `json:"requested_model" gorm:"size:191;primaryKey;autoIncrement:false"`
	ManualPriority int    `json:"manual_priority" gorm:"not null;default:0"`
	// Enabled is set in code / BeforeCreate; avoid gorm default:true (MySQL/PG AutoMigrate churn).
	Enabled   bool   `json:"enabled"`
	Source    string `json:"source" gorm:"size:32;not null;default:configured"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;not null"`
}

func (ChannelModelPolicy) TableName() string {
	return "channel_model_policy"
}

func (p *ChannelModelPolicy) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	if p.UpdatedAt == 0 {
		p.UpdatedAt = now
	}
	if p.Source == "" {
		p.Source = PolicySourceConfigured
	}
	// default enabled when creating via zero-value path; callers may set false explicitly
	return nil
}

func (p *ChannelModelPolicy) BeforeUpdate(_ *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *ChannelModelPolicy) PolicyKey() PolicyKey {
	return PolicyKey{ChannelID: p.ChannelID, RequestedModel: p.RequestedModel}
}

// GetChannelModelPolicy loads one policy row.
func GetChannelModelPolicy(channelID int64, requestedModel string) (*ChannelModelPolicy, error) {
	var p ChannelModelPolicy
	err := DB.Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ListChannelModelPoliciesByRequestedModel returns all policies for a requested_model.
func ListChannelModelPoliciesByRequestedModel(requestedModel string) ([]ChannelModelPolicy, error) {
	var rows []ChannelModelPolicy
	err := DB.Where("requested_model = ?", requestedModel).Find(&rows).Error
	return rows, err
}

// ListChannelModelPoliciesByChannel returns all policies for a channel.
func ListChannelModelPoliciesByChannel(channelID int64) ([]ChannelModelPolicy, error) {
	var rows []ChannelModelPolicy
	err := DB.Where("channel_id = ?", channelID).Find(&rows).Error
	return rows, err
}

// ListAllChannelModelPolicies returns every policy row.
func ListAllChannelModelPolicies() ([]ChannelModelPolicy, error) {
	var rows []ChannelModelPolicy
	err := DB.Find(&rows).Error
	return rows, err
}

// UpsertChannelModelPolicy inserts or updates a policy by primary key.
// On conflict, updates manual_priority / enabled / source / updated_at.
func UpsertChannelModelPolicy(p *ChannelModelPolicy) error {
	if p == nil {
		return errors.New("nil channel model policy")
	}
	now := common.GetTimestamp()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	if p.Source == "" {
		p.Source = PolicySourceConfigured
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "requested_model"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"manual_priority",
			"enabled",
			"source",
			"updated_at",
		}),
	}).Create(p).Error
}

// UpsertChannelModelPolicies batch-upserts policies.
func UpsertChannelModelPolicies(policies []ChannelModelPolicy) error {
	if len(policies) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	for i := range policies {
		if policies[i].CreatedAt == 0 {
			policies[i].CreatedAt = now
		}
		policies[i].UpdatedAt = now
		if policies[i].Source == "" {
			policies[i].Source = PolicySourceConfigured
		}
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "requested_model"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"manual_priority",
			"enabled",
			"source",
			"updated_at",
		}),
	}).CreateInBatches(policies, 100).Error
}

// UpdateChannelModelPolicyManualPriority updates only manual_priority.
func UpdateChannelModelPolicyManualPriority(channelID int64, requestedModel string, priority int) error {
	return DB.Model(&ChannelModelPolicy{}).
		Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).
		Updates(map[string]interface{}{
			"manual_priority": priority,
			"updated_at":      common.GetTimestamp(),
		}).Error
}

func UpdateChannelModelPolicyPriority(
	channelID int64,
	requestedModel string,
	priority int,
	expectedPriority int,
) (*ModelPolicyPriorityMutationResult, error) {
	if channelID == 0 || requestedModel == "" ||
		priority < ModelPolicyPriorityMin || priority > ModelPolicyPriorityMax ||
		expectedPriority < ModelPolicyPriorityMin || expectedPriority > ModelPolicyPriorityMax {
		return nil, ErrModelPolicyInvalidPriority
	}

	result := &ModelPolicyPriorityMutationResult{RequestedModel: requestedModel}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var policies []ChannelModelPolicy
		if err := tx.Where("requested_model = ?", requestedModel).Find(&policies).Error; err != nil {
			return err
		}
		sortModelPolicies(policies)
		result.PreviousOrder = modelPolicyChannelIDs(policies)

		targetIndex := -1
		conflictIndexes := make([]int, 0, 1)
		for i := range policies {
			if policies[i].ChannelID == channelID {
				targetIndex = i
				continue
			}
			if policies[i].ManualPriority == priority {
				conflictIndexes = append(conflictIndexes, i)
			}
		}
		if targetIndex < 0 {
			return ErrModelPolicyNotFound
		}
		if policies[targetIndex].ManualPriority != expectedPriority {
			return ErrModelPolicyStaleSnapshot
		}
		if priority == expectedPriority {
			result.Policies = policies
			result.CurrentOrder = append([]int64(nil), result.PreviousOrder...)
			result.Changed = []ModelPolicyPriorityChange{}
			return nil
		}
		if len(conflictIndexes) > 1 {
			return ErrModelPolicyDuplicatePriorityConflict
		}

		changes := []ModelPolicyPriorityChange{{ChannelID: channelID, ManualPriority: priority}}
		if len(conflictIndexes) == 1 {
			conflict := &policies[conflictIndexes[0]]
			changes = append(changes, ModelPolicyPriorityChange{
				ChannelID:      conflict.ChannelID,
				ManualPriority: expectedPriority,
			})
		}
		if err := applyModelPolicyPriorityChanges(tx, requestedModel, policies, changes); err != nil {
			return err
		}

		for i := range policies {
			for _, change := range changes {
				if policies[i].ChannelID == change.ChannelID {
					policies[i].ManualPriority = change.ManualPriority
					break
				}
			}
		}
		sortModelPolicies(policies)
		result.Changed = changes
		result.Policies = policies
		result.CurrentOrder = modelPolicyChannelIDs(policies)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func ReorderChannelModelPolicies(
	requestedModel string,
	orderedChannelIDs []int64,
	expected []ModelPolicyPrioritySnapshot,
) (*ModelPolicyPriorityMutationResult, error) {
	return reorderChannelModelPolicies(requestedModel, orderedChannelIDs, expected, 0)
}

func ReorderChannelModelPoliciesForChannel(
	requestedModel string,
	orderedChannelIDs []int64,
	expected []ModelPolicyPrioritySnapshot,
	movedChannelID int64,
) (*ModelPolicyPriorityMutationResult, error) {
	return reorderChannelModelPolicies(requestedModel, orderedChannelIDs, expected, movedChannelID)
}

func reorderChannelModelPolicies(
	requestedModel string,
	orderedChannelIDs []int64,
	expected []ModelPolicyPrioritySnapshot,
	movedChannelID int64,
) (*ModelPolicyPriorityMutationResult, error) {
	if requestedModel == "" || len(orderedChannelIDs) == 0 || len(orderedChannelIDs) != len(expected) {
		return nil, ErrModelPolicyInvalidOrder
	}
	expectedByID := make(map[int64]int, len(expected))
	orderedSet := make(map[int64]struct{}, len(orderedChannelIDs))
	for _, snapshot := range expected {
		if snapshot.ChannelID == 0 || snapshot.ManualPriority < ModelPolicyPriorityMin || snapshot.ManualPriority > ModelPolicyPriorityMax {
			return nil, ErrModelPolicyInvalidPriority
		}
		if _, exists := expectedByID[snapshot.ChannelID]; exists {
			return nil, ErrModelPolicyInvalidOrder
		}
		expectedByID[snapshot.ChannelID] = snapshot.ManualPriority
	}
	for _, channelID := range orderedChannelIDs {
		if channelID == 0 {
			return nil, ErrModelPolicyInvalidOrder
		}
		if _, exists := orderedSet[channelID]; exists {
			return nil, ErrModelPolicyInvalidOrder
		}
		if _, exists := expectedByID[channelID]; !exists {
			return nil, ErrModelPolicyInvalidOrder
		}
		orderedSet[channelID] = struct{}{}
	}
	if movedChannelID != 0 {
		if _, exists := orderedSet[movedChannelID]; !exists {
			return nil, ErrModelPolicyInvalidOrder
		}
	}

	result := &ModelPolicyPriorityMutationResult{RequestedModel: requestedModel}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var policies []ChannelModelPolicy
		if err := tx.Where("requested_model = ?", requestedModel).Find(&policies).Error; err != nil {
			return err
		}
		if len(policies) > len(orderedChannelIDs) {
			return ErrModelPolicyInvalidOrder
		}
		if len(policies) < len(orderedChannelIDs) {
			return ErrModelPolicyNotFound
		}
		for i := range policies {
			expectedPriority, exists := expectedByID[policies[i].ChannelID]
			if !exists {
				return ErrModelPolicyInvalidOrder
			}
			if policies[i].ManualPriority < ModelPolicyPriorityMin || policies[i].ManualPriority > ModelPolicyPriorityMax {
				return ErrModelPolicyInvalidPriority
			}
			if policies[i].ManualPriority != expectedPriority {
				return ErrModelPolicyStaleSnapshot
			}
		}

		sortModelPolicies(policies)
		result.PreviousOrder = modelPolicyChannelIDs(policies)
		if equalChannelIDOrder(result.PreviousOrder, orderedChannelIDs) {
			result.Changed = []ModelPolicyPriorityChange{}
			result.Policies = policies
			result.CurrentOrder = append([]int64(nil), orderedChannelIDs...)
			return nil
		}

		var best *modelPolicyReorderCandidate
		validMove := false
		for _, movedID := range orderedChannelIDs {
			if movedChannelID != 0 && movedID != movedChannelID {
				continue
			}
			if !isSinglePolicyMove(result.PreviousOrder, orderedChannelIDs, movedID) {
				continue
			}
			validMove = true
			candidate := buildModelPolicyReorderCandidate(policies, orderedChannelIDs, movedID)
			if candidate == nil {
				continue
			}
			if betterModelPolicyMovedCandidate(candidate, best) {
				best = candidate
			}
		}
		if !validMove {
			return ErrModelPolicyInvalidOrder
		}
		if best == nil {
			return ErrModelPolicyPriorityRangeExhausted
		}
		if err := applyModelPolicyPriorityChanges(tx, requestedModel, policies, best.changes); err != nil {
			return err
		}

		policyByID := make(map[int64]ChannelModelPolicy, len(policies))
		for i := range policies {
			policy := policies[i]
			if priority, changed := best.priorities[policy.ChannelID]; changed {
				policy.ManualPriority = priority
			}
			policyByID[policy.ChannelID] = policy
		}
		result.Policies = make([]ChannelModelPolicy, 0, len(policies))
		for _, channelID := range orderedChannelIDs {
			result.Policies = append(result.Policies, policyByID[channelID])
		}
		result.Changed = best.changes
		result.CurrentOrder = append([]int64(nil), orderedChannelIDs...)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

type modelPolicyReorderCandidate struct {
	priorities   map[int64]int
	changes      []ModelPolicyPriorityChange
	changedCount int
	upwardCount  int
	movedUpward  bool
	maxDelta     int
	totalDelta   int
}

func buildModelPolicyReorderCandidate(
	policies []ChannelModelPolicy,
	desired []int64,
	movedID int64,
) *modelPolicyReorderCandidate {
	policyByID := make(map[int64]ChannelModelPolicy, len(policies))
	rest := make([]ChannelModelPolicy, 0, len(policies)-1)
	for i := range policies {
		policyByID[policies[i].ChannelID] = policies[i]
		if policies[i].ChannelID != movedID {
			rest = append(rest, policies[i])
		}
	}
	moved, exists := policyByID[movedID]
	if !exists {
		return nil
	}
	occupiedPriorities := make(map[int]struct{}, len(rest))
	for i := range rest {
		occupiedPriorities[rest[i].ManualPriority] = struct{}{}
	}
	if len(occupiedPriorities) == ModelPolicyPriorityMax-ModelPolicyPriorityMin+1 {
		return nil
	}
	insertAt := 0
	for insertAt < len(desired) && desired[insertAt] != movedID {
		insertAt++
	}
	if insertAt == len(desired) {
		return nil
	}
	previousIndex := 0
	for previousIndex < len(policies) && policies[previousIndex].ChannelID != movedID {
		previousIndex++
	}

	build := func(upwardCount, downwardCount, movedPriority int) *modelPolicyReorderCandidate {
		priorities := make(map[int64]int, len(policies))
		for i := range policies {
			priorities[policies[i].ChannelID] = policies[i].ManualPriority
		}
		priorities[movedID] = movedPriority

		nextPriority := movedPriority
		for i := insertAt - 1; i >= insertAt-upwardCount; i-- {
			priority := priorities[rest[i].ChannelID]
			if priority <= nextPriority {
				priority = nextPriority + 1
			}
			priorities[rest[i].ChannelID] = priority
			nextPriority = priority
		}
		previousPriority := movedPriority
		for i := insertAt; i < insertAt+downwardCount; i++ {
			priority := priorities[rest[i].ChannelID]
			if priority >= previousPriority {
				priority = previousPriority - 1
			}
			priorities[rest[i].ChannelID] = priority
			previousPriority = priority
		}

		for _, value := range priorities {
			if value < ModelPolicyPriorityMin || value > ModelPolicyPriorityMax {
				return nil
			}
		}
		if insertAt > 0 && priorities[rest[insertAt-1].ChannelID] <= movedPriority {
			return nil
		}
		if insertAt < len(rest) && movedPriority <= priorities[rest[insertAt].ChannelID] {
			return nil
		}
		if upwardCount > 0 && insertAt-upwardCount > 0 {
			before := priorities[rest[insertAt-upwardCount-1].ChannelID]
			shifted := priorities[rest[insertAt-upwardCount].ChannelID]
			if before <= shifted {
				return nil
			}
		}
		if downwardCount > 0 && insertAt+downwardCount < len(rest) {
			shifted := priorities[rest[insertAt+downwardCount-1].ChannelID]
			after := priorities[rest[insertAt+downwardCount].ChannelID]
			if shifted <= after {
				return nil
			}
		}
		ordered := append([]ChannelModelPolicy(nil), policies...)
		sort.SliceStable(ordered, func(i, j int) bool {
			left := priorities[ordered[i].ChannelID]
			right := priorities[ordered[j].ChannelID]
			if left != right {
				return left > right
			}
			return ordered[i].ChannelID < ordered[j].ChannelID
		})
		if !equalChannelIDOrder(modelPolicyChannelIDs(ordered), desired) {
			return nil
		}

		changes := make([]ModelPolicyPriorityChange, 0, upwardCount+downwardCount+1)
		actualUpwardCount := 0
		maxDelta := 0
		totalDelta := 0
		for _, channelID := range desired {
			if priorities[channelID] != policyByID[channelID].ManualPriority {
				delta := priorities[channelID] - policyByID[channelID].ManualPriority
				if delta < 0 {
					delta = -delta
				}
				if delta > maxDelta {
					maxDelta = delta
				}
				totalDelta += delta
				changes = append(changes, ModelPolicyPriorityChange{
					ChannelID:      channelID,
					ManualPriority: priorities[channelID],
				})
				for i := insertAt - upwardCount; i < insertAt; i++ {
					if rest[i].ChannelID == channelID {
						actualUpwardCount++
						break
					}
				}
			}
		}
		return &modelPolicyReorderCandidate{
			priorities:   priorities,
			changes:      changes,
			changedCount: len(changes),
			upwardCount:  actualUpwardCount,
			movedUpward:  insertAt < previousIndex,
			maxDelta:     maxDelta,
			totalDelta:   totalDelta,
		}
	}

	low, high := ModelPolicyPriorityMin, ModelPolicyPriorityMax
	if insertAt > 0 {
		high = rest[insertAt-1].ManualPriority - 1
	}
	if insertAt < len(rest) {
		low = rest[insertAt].ManualPriority + 1
	}
	if low <= high {
		priority := moved.ManualPriority
		switch {
		case insertAt == 0:
			priority = low
		case insertAt == len(rest):
			priority = high
		default:
			priority = low + (high-low)/2
		}
		if direct := build(0, 0, priority); direct != nil {
			return direct
		}
	}

	var best *modelPolicyReorderCandidate
	for changed := 1; changed <= len(rest); changed++ {
		for upwardCount := 0; upwardCount <= changed; upwardCount++ {
			downwardCount := changed - upwardCount
			if upwardCount > insertAt || downwardCount > len(rest)-insertAt {
				continue
			}
			priorityCandidates := make([]int, 0, 4)
			if insertAt == 0 {
				priorityCandidates = append(priorityCandidates, rest[0].ManualPriority)
			} else if insertAt == len(rest) {
				priorityCandidates = append(priorityCandidates, rest[len(rest)-1].ManualPriority)
			} else {
				upper := rest[insertAt-1].ManualPriority
				lower := rest[insertAt].ManualPriority
				if upwardCount > 0 {
					priorityCandidates = append(priorityCandidates, upper, lower+1)
				}
				if downwardCount > 0 {
					priorityCandidates = append(priorityCandidates, lower, upper-1)
				}
			}
			for _, priority := range priorityCandidates {
				if priority < ModelPolicyPriorityMin || priority > ModelPolicyPriorityMax {
					continue
				}
				candidate := build(upwardCount, downwardCount, priority)
				if candidate == nil {
					continue
				}
				if betterModelPolicyLocalCandidate(candidate, best) {
					best = candidate
				}
			}
		}
		if best != nil {
			return best
		}
	}
	return nil
}

func betterModelPolicyLocalCandidate(candidate, current *modelPolicyReorderCandidate) bool {
	if current == nil || candidate.changedCount != current.changedCount {
		return current == nil || candidate.changedCount < current.changedCount
	}
	if candidate.upwardCount != current.upwardCount {
		return candidate.upwardCount < current.upwardCount
	}
	return candidate.movedUpward && !current.movedUpward
}

func betterModelPolicyMovedCandidate(candidate, current *modelPolicyReorderCandidate) bool {
	if current == nil || candidate.maxDelta != current.maxDelta {
		return current == nil || candidate.maxDelta < current.maxDelta
	}
	if candidate.totalDelta != current.totalDelta {
		return candidate.totalDelta < current.totalDelta
	}
	return betterModelPolicyLocalCandidate(candidate, current)
}

func applyModelPolicyPriorityChanges(
	tx *gorm.DB,
	requestedModel string,
	policies []ChannelModelPolicy,
	changes []ModelPolicyPriorityChange,
) error {
	oldPriorityByID := make(map[int64]int, len(policies))
	for i := range policies {
		oldPriorityByID[policies[i].ChannelID] = policies[i].ManualPriority
	}
	now := common.GetTimestamp()
	for _, change := range changes {
		oldPriority, exists := oldPriorityByID[change.ChannelID]
		if !exists {
			return ErrModelPolicyNotFound
		}
		update := tx.Model(&ChannelModelPolicy{}).
			Where("channel_id = ? AND requested_model = ? AND manual_priority = ?", change.ChannelID, requestedModel, oldPriority).
			Updates(map[string]interface{}{
				"manual_priority": change.ManualPriority,
				"updated_at":      now,
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return ErrModelPolicyStaleSnapshot
		}
	}
	return nil
}

func sortModelPolicies(policies []ChannelModelPolicy) {
	sort.SliceStable(policies, func(i, j int) bool {
		if policies[i].ManualPriority != policies[j].ManualPriority {
			return policies[i].ManualPriority > policies[j].ManualPriority
		}
		return policies[i].ChannelID < policies[j].ChannelID
	})
}

func modelPolicyChannelIDs(policies []ChannelModelPolicy) []int64 {
	ids := make([]int64, 0, len(policies))
	for i := range policies {
		ids = append(ids, policies[i].ChannelID)
	}
	return ids
}

func equalChannelIDOrder(left, right []int64) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func isSinglePolicyMove(previous, current []int64, movedID int64) bool {
	left := make([]int64, 0, len(previous)-1)
	right := make([]int64, 0, len(current)-1)
	for _, channelID := range previous {
		if channelID != movedID {
			left = append(left, channelID)
		}
	}
	for _, channelID := range current {
		if channelID != movedID {
			right = append(right, channelID)
		}
	}
	return equalChannelIDOrder(left, right)
}

// UpdateChannelModelPolicyEnabled updates only enabled.
func UpdateChannelModelPolicyEnabled(channelID int64, requestedModel string, enabled bool) error {
	return DB.Model(&ChannelModelPolicy{}).
		Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).
		Updates(map[string]interface{}{
			"enabled":    enabled,
			"updated_at": common.GetTimestamp(),
		}).Error
}

// DeleteChannelModelPolicy removes one policy row.
func DeleteChannelModelPolicy(channelID int64, requestedModel string) error {
	return DB.Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).
		Delete(&ChannelModelPolicy{}).Error
}

// EnsureChannelModelPolicy returns existing policy or creates a lazy default (PRD §5.3).
func EnsureChannelModelPolicy(channelID int64, requestedModel string, source string, manualPriority int) (*ChannelModelPolicy, error) {
	existing, err := GetChannelModelPolicy(channelID, requestedModel)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	if source == "" {
		source = PolicySourceLazyCreated
	}
	p := &ChannelModelPolicy{
		ChannelID:      channelID,
		RequestedModel: requestedModel,
		ManualPriority: manualPriority,
		Enabled:        true,
		Source:         source,
	}
	if err := UpsertChannelModelPolicy(p); err != nil {
		// race: another writer may have inserted
		return GetChannelModelPolicy(channelID, requestedModel)
	}
	return p, nil
}
