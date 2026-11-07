package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Keep priorities lossless in the web console's JSON number representation.
const maxSortablePriority int64 = 1<<53 - 1

var ErrChannelPriorityConflict = errors.New("Channel priorities changed. Refresh and try again.")
var ErrChannelPriorityInvalid = errors.New("Invalid channel priority move")
var ErrChannelPriorityRange = errors.New("Channel priority is outside the sortable range")

type ChannelPriority struct {
	ID       int    `json:"id"`
	Priority *int64 `json:"priority"`
}

func (item ChannelPriority) value() int64 {
	if item.Priority == nil {
		return 0
	}
	return *item.Priority
}

type ChannelPriorityChange struct {
	ID       int    `json:"id"`
	Previous *int64 `json:"previous"`
	Priority *int64 `json:"priority"`
}

type ChannelPriorityOrder struct {
	Revision string                  `json:"revision"`
	Items    []ChannelPriority       `json:"items"`
	Changes  []ChannelPriorityChange `json:"changes"`
}

type ChannelPriorityMove struct {
	Revision string                  `json:"revision"`
	ID       int                     `json:"id"`
	TargetID int                     `json:"target_id"`
	Position string                  `json:"position"` // before / after use descending priority order
	Preview  bool                    `json:"preview"`
	Restore  []ChannelPriorityChange `json:"restore,omitempty"`
}

func channelPriorityRevision(items []ChannelPriority) string {
	data, _ := common.Marshal(items)
	return fmt.Sprintf("%x", sha256.Sum256(data))
}

func GetChannelPriorityOrder() (ChannelPriorityOrder, error) {
	result := ChannelPriorityOrder{Items: []ChannelPriority{}, Changes: []ChannelPriorityChange{}}
	err := DB.Model(&Channel{}).Select("id", "priority").Order("id").Find(&result.Items).Error
	result.Revision = channelPriorityRevision(result.Items)
	return result, err
}

// ReorderChannelPriority updates only priorities, including the routing copy in
// abilities. A snapshot check also protects preview/commit and undo from stale
// clients; row locks serialize concurrent reorders on MySQL and PostgreSQL.
func ReorderChannelPriority(move ChannelPriorityMove) (ChannelPriorityOrder, error) {
	result := ChannelPriorityOrder{Items: []ChannelPriority{}, Changes: []ChannelPriorityChange{}}
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := tx.Model(&Channel{}).Select("id", "priority").Order("id")
		if !move.Preview {
			query = lockForUpdate(query)
		}
		if err := query.Find(&result.Items).Error; err != nil {
			return err
		}
		if move.Revision == "" || move.Revision != channelPriorityRevision(result.Items) {
			return ErrChannelPriorityConflict
		}
		changes, err := planChannelPriorityMove(result.Items, move)
		if err != nil {
			return err
		}
		result.Changes = changes
		byID := make(map[int]*ChannelPriority, len(result.Items))
		for i := range result.Items {
			byID[result.Items[i].ID] = &result.Items[i]
		}
		for _, change := range changes {
			byID[change.ID].Priority = change.Priority
			if move.Preview {
				continue
			}
			if err := tx.Model(&Channel{}).Where("id = ?", change.ID).Update("priority", change.Priority).Error; err != nil {
				return err
			}
			if err := tx.Model(&Ability{}).Where("channel_id = ?", change.ID).Update("priority", change.Priority).Error; err != nil {
				return err
			}
		}
		result.Revision = channelPriorityRevision(result.Items)
		return nil
	})
	return result, err
}

// Equal-priority channels remain together. Opening a slot shifts the shorter
// contiguous run of occupied integer priorities, measured by affected channels.
func planChannelPriorityMove(items []ChannelPriority, move ChannelPriorityMove) ([]ChannelPriorityChange, error) {
	changes := []ChannelPriorityChange{}
	byID := make(map[int]ChannelPriority, len(items))
	for _, item := range items {
		if item.value() < -maxSortablePriority || item.value() > maxSortablePriority {
			return nil, ErrChannelPriorityRange
		}
		byID[item.ID] = item
	}
	if len(move.Restore) > 0 {
		if move.ID != 0 || move.TargetID != 0 || move.Position != "" {
			return nil, ErrChannelPriorityInvalid
		}
		seen := make(map[int]bool, len(move.Restore))
		for _, change := range move.Restore {
			item, ok := byID[change.ID]
			if !ok || seen[change.ID] || (change.Priority != nil && (*change.Priority < -maxSortablePriority || *change.Priority > maxSortablePriority)) {
				return nil, ErrChannelPriorityInvalid
			}
			if !equalPriority(item.Priority, change.Previous) {
				return nil, ErrChannelPriorityConflict
			}
			seen[change.ID] = true
			if !equalPriority(item.Priority, change.Priority) {
				changes = append(changes, change)
			}
		}
		return changes, nil
	}
	item, ok := byID[move.ID]
	target, targetOK := byID[move.TargetID]
	if !ok || !targetOK || move.ID == move.TargetID || !slices.Contains([]string{"before", "after", "same"}, move.Position) {
		return nil, ErrChannelPriorityInvalid
	}
	values := make(map[int]int64, len(items))
	for _, entry := range items {
		values[entry.ID] = entry.value()
	}
	if move.Position == "same" {
		values[item.ID] = target.value()
	} else {
		counts := make(map[int64]int)
		for _, entry := range items {
			if entry.ID != item.ID {
				counts[entry.value()]++
			}
		}
		levels := make([]int64, 0, len(counts))
		for level := range counts {
			levels = append(levels, level)
		}
		slices.SortFunc(levels, func(a, b int64) int {
			if a > b {
				return -1
			}
			if a < b {
				return 1
			}
			return 0
		})
		index := slices.Index(levels, target.value())
		if move.Position == "after" {
			index++
		}
		hi, lo := maxSortablePriority+1, -maxSortablePriority-1
		if index > 0 {
			hi = levels[index-1]
		}
		if index < len(levels) {
			lo = levels[index]
		}
		// Dropping into the channel's existing slot must not renumber it.
		if item.value() < hi && item.value() > lo {
			return changes, nil
		}
		if hi-lo < 2 {
			up, down := index-1, index
			upCost, downCost := 0, 0
			for up >= 0 {
				upCost += counts[levels[up]]
				if (up == 0 && levels[up] < maxSortablePriority) || (up > 0 && levels[up-1]-levels[up] > 1) {
					break
				}
				up--
			}
			for down < len(levels) {
				downCost += counts[levels[down]]
				if (down == len(levels)-1 && levels[down] > -maxSortablePriority) || (down+1 < len(levels) && levels[down]-levels[down+1] > 1) {
					break
				}
				down++
			}
			canUp, canDown := up >= 0 && index > 0, down < len(levels) && index < len(levels)
			if !canUp && !canDown {
				return nil, ErrChannelPriorityRange
			}
			if canUp && (!canDown || upCost < downCost) {
				for id, value := range values {
					if id != item.ID && value >= levels[index-1] && value <= levels[up] {
						values[id]++
					}
				}
				hi++
			} else {
				for id, value := range values {
					if id != item.ID && value <= levels[index] && value >= levels[down] {
						values[id]--
					}
				}
				lo--
			}
		}
		value := lo + (hi-lo)/2
		if index == 0 {
			value = min(maxSortablePriority, lo+10)
		} else if index == len(levels) {
			value = max(-maxSortablePriority, hi-10)
		}
		values[item.ID] = value
	}
	for _, entry := range items {
		value := values[entry.ID]
		if value != entry.value() {
			changes = append(changes, ChannelPriorityChange{ID: entry.ID, Previous: entry.Priority, Priority: &value})
		}
	}
	return changes, nil
}

func equalPriority(a, b *int64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
