package model

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

// BlockRunChannel is a lightweight projection of a BlockRun-family channel.
type BlockRunChannel struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
	Type int    `json:"type"`
}

type blockRunModelChannelRow struct {
	Model string
	Id    int
	Name  string
	Type  int
}

// usageReconLogColumns is the projection used by the reconciliation queries —
// only the columns needed to aggregate / render, skipping content/ip/username/
// upstream_request_id to keep transfer light on large windows.
const usageReconLogColumns = "id, channel_id, token_id, token_name, model_name, prompt_tokens, completion_tokens, quota, use_time, is_stream, request_id, created_at, other"

// BlockRunChannelTypes returns every channel type number whose display name in
// constant.ChannelTypeNames starts with "blockrun" (case-insensitive): currently
// 100/101/102, plus any future BlockRun* type — zero maintenance.
func BlockRunChannelTypes() []int {
	types := make([]int, 0, 4)
	for typ, name := range constant.ChannelTypeNames {
		if strings.HasPrefix(strings.ToLower(name), "blockrun") {
			types = append(types, typ)
		}
	}
	return types
}

// GetBlockRunChannels returns id -> {name,type} for all BlockRun-family channels.
func GetBlockRunChannels() (map[int]BlockRunChannel, error) {
	out := make(map[int]BlockRunChannel)
	types := BlockRunChannelTypes()
	if len(types) == 0 {
		return out, nil
	}
	var chs []BlockRunChannel
	if err := DB.Model(&Channel{}).
		Select("id", "name", "type").
		Where("type IN ?", types).
		Find(&chs).Error; err != nil {
		return nil, err
	}
	for _, ch := range chs {
		out[ch.Id] = ch
	}
	return out, nil
}

// GetBlockRunEnabledModelChannels returns model -> BlockRun channels for every
// enabled ability backed by a BlockRun-family channel. Duplicate abilities from
// multiple groups are collapsed so each channel appears once per model.
func GetBlockRunEnabledModelChannels() (map[string][]BlockRunChannel, error) {
	out := make(map[string][]BlockRunChannel)
	types := BlockRunChannelTypes()
	if len(types) == 0 {
		return out, nil
	}

	var rows []blockRunModelChannelRow
	if err := DB.Table("abilities").
		Select("abilities.model, channels.id, channels.name, channels.type").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.enabled = ? AND channels.type IN ?", true, types).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	seen := make(map[string]map[int]struct{})
	for _, row := range rows {
		if row.Model == "" {
			continue
		}
		if _, ok := seen[row.Model]; !ok {
			seen[row.Model] = make(map[int]struct{})
		}
		if _, ok := seen[row.Model][row.Id]; ok {
			continue
		}
		seen[row.Model][row.Id] = struct{}{}
		out[row.Model] = append(out[row.Model], BlockRunChannel{
			Id:   row.Id,
			Name: row.Name,
			Type: row.Type,
		})
	}
	return out, nil
}

func blockRunUsageQuery(channelIDs []int, startUnix, endUnix int64) *gorm.DB {
	return LOG_DB.Model(&Log{}).
		Where("type = ? AND channel_id IN ? AND created_at >= ? AND created_at < ?",
			LogTypeConsume, channelIDs, startUnix, endUnix)
}

// StreamBlockRunUsageLogs scans matching consume logs row-by-row (bounded
// memory) ordered by created_at,id and invokes fn for each. Used by the summary
// aggregation so a wide window does not materialize every row at once.
func StreamBlockRunUsageLogs(channelIDs []int, startUnix, endUnix int64, fn func(*Log) error) error {
	if len(channelIDs) == 0 {
		return nil
	}
	rows, err := blockRunUsageQuery(channelIDs, startUnix, endUnix).
		Select(usageReconLogColumns).
		Order("created_at asc, id asc").
		Rows()
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var log Log
		if err := LOG_DB.ScanRows(rows, &log); err != nil {
			return err
		}
		if err := fn(&log); err != nil {
			return err
		}
	}
	return rows.Err()
}

// CountBlockRunUsageLogs returns the total matching rows (for pagination meta).
func CountBlockRunUsageLogs(channelIDs []int, startUnix, endUnix int64) (int64, error) {
	if len(channelIDs) == 0 {
		return 0, nil
	}
	var total int64
	err := blockRunUsageQuery(channelIDs, startUnix, endUnix).Count(&total).Error
	return total, err
}

// QueryBlockRunUsageLogsPaged returns one page of matching rows, ordered
// created_at,id, for the transactions endpoint.
func QueryBlockRunUsageLogsPaged(channelIDs []int, startUnix, endUnix int64, limit, offset int) ([]*Log, error) {
	if len(channelIDs) == 0 {
		return []*Log{}, nil
	}
	var logs []*Log
	err := blockRunUsageQuery(channelIDs, startUnix, endUnix).
		Select(usageReconLogColumns).
		Order("created_at asc, id asc").
		Limit(limit).Offset(offset).
		Find(&logs).Error
	return logs, err
}

// QueryBlockRunUsageLogsAfterCursor returns rows after the stable
// (created_at,id) cursor. The caller should request limit+1 rows when it needs
// to compute has_more without doing an offset scan.
func QueryBlockRunUsageLogsAfterCursor(channelIDs []int, startUnix, endUnix int64, limit int, cursorCreatedAt int64, cursorID int) ([]*Log, error) {
	if len(channelIDs) == 0 {
		return []*Log{}, nil
	}
	var logs []*Log
	err := blockRunUsageQuery(channelIDs, startUnix, endUnix).
		Where("(created_at > ? OR (created_at = ? AND id > ?))", cursorCreatedAt, cursorCreatedAt, cursorID).
		Select(usageReconLogColumns).
		Order("created_at asc, id asc").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}
