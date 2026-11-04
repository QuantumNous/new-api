package channel

import (
	"errors"
	"math"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/logger"
	"gorm.io/gorm"
)

// PressureLevel classifies pool availability for a model's schedulable
// units.
type PressureLevel int

const (
	PressureNormal PressureLevel = iota
	PressureWarning
	PressureEmergency
)

// modelPressure tracks per-model availability counts for the hot-path
// pressure check. total = all schedulable units; healthy = those neither
// cooling nor terminal-disabled. A cache miss counts as healthy, so healthy
// starts equal to total and is adjusted incrementally as unit transitions
// occur.
type modelPressure struct {
	total   int
	healthy int
}

var pressureIDM = map[string]*modelPressure{}
var pressureLock sync.RWMutex

// modelPressureLevel reads the in-process counter with zero DB reads and
// zero traversal. total == 0 or no record → PressureNormal (fail-safe
// direction).
func modelPressureLevel(model string) PressureLevel {
	pressureLock.RLock()
	p := pressureIDM[model]
	pressureLock.RUnlock()
	if p == nil || p.total == 0 {
		return PressureNormal
	}
	ratio := float64(p.healthy) * 100 / float64(p.total)
	cfg := GetUnitHealthSetting()
	switch {
	case ratio < float64(cfg.EmergencyThreshold):
		return PressureEmergency
	case ratio < float64(cfg.WarningThreshold):
		return PressureWarning
	default:
		return PressureNormal
	}
}

// pressureOnUnitTransition adjusts the healthy counter when a unit crosses
// the healthy ↔ unhealthy boundary (unhealthy = cooling or terminal-
// disabled). Same-side transitions (rung climbs inside an active cooldown,
// idle anneal) do not move the counter. healthy is floored at zero.
func pressureOnUnitTransition(key RouteKey, wasUnhealthy, nowUnhealthy bool) {
	if wasUnhealthy == nowUnhealthy {
		return
	}
	pressureLock.Lock()
	defer pressureLock.Unlock()
	p := pressureIDM[key.Model]
	if p == nil {
		return
	}
	if nowUnhealthy {
		p.healthy--
	} else {
		p.healthy++
	}
	if p.healthy < 0 {
		p.healthy = 0
	}
}

// unitUnhealthySnapshot reports the mirror's unhealthy view of one unit. A
// cache miss counts as healthy, matching the recompute convention.
func unitUnhealthySnapshot(key RouteKey) bool {
	unitHealthLock.RLock()
	defer unitHealthLock.RUnlock()
	st, ok := unitHealthIDM[key]
	if !ok {
		return false
	}
	return isUnitUnhealthy(st, ChannelHealthNow().UnixMilli())
}

// pressureOnRemove decrements total (and healthy if the unit was healthy)
// when a schedulable unit is cleaned up. healthy is floored at zero.
func pressureOnRemove(key RouteKey) {
	unhealthy := unitUnhealthySnapshot(key)
	pressureLock.Lock()
	defer pressureLock.Unlock()
	p := pressureIDM[key.Model]
	if p == nil {
		return
	}
	p.total--
	if p.total < 0 {
		p.total = 0
	}
	if !unhealthy {
		p.healthy--
		if p.healthy < 0 {
			p.healthy = 0
		}
	}
}

// pressureRecomputeTotals rebuilds the pressure map from scratch: total =
// distinct channels × keys per channel for each model (from enabled
// abilities and channel info); healthy = total minus the units currently
// cooling or terminal-disabled. db is the handle to read through: callers
// inside a MutateGatewayRouting transaction MUST pass the tx — reading
// through a pooled dbx.DB connection while the transaction holds the
// SQLite write lock self-deadlocks — while startup-time callers with no
// surrounding transaction pass dbx.DB.
func pressureRecomputeTotals(db *gorm.DB) {
	type abilityRow struct {
		Model     string
		ChannelId int
	}
	var abilities []abilityRow
	if err := db.Model(&Ability{}).Select("model, channel_id").Where("enabled = ?", true).Find(&abilities).Error; err != nil {
		common.SysError("pressure recompute: query abilities failed: " + err.Error())
		return
	}

	var channels []Channel
	if err := db.Select("id, channel_info").Find(&channels).Error; err != nil {
		common.SysError("pressure recompute: query channels failed: " + err.Error())
		return
	}
	multiKeySize := make(map[int]int, len(channels))
	for i := range channels {
		size := channels[i].ChannelInfo.MultiKeySize
		if size <= 0 {
			size = 1
		}
		multiKeySize[channels[i].Id] = size
	}

	modelChannels := make(map[string]map[int]struct{})
	for i := range abilities {
		set, ok := modelChannels[abilities[i].Model]
		if !ok {
			set = make(map[int]struct{})
			modelChannels[abilities[i].Model] = set
		}
		set[abilities[i].ChannelId] = struct{}{}
	}

	totals := make(map[string]int, len(modelChannels))
	for model, chSet := range modelChannels {
		t := 0
		for chID := range chSet {
			t += multiKeySize[chID]
		}
		totals[model] = t
	}

	type unhealthyRow struct {
		Model string
	}
	var unhealthyRows []unhealthyRow
	if err := db.Model(&ChannelModelHealth{}).
		Select("model").
		Where("cooldown_until_ms > ? OR hard_disabled = ?", time.Now().UnixMilli(), true).
		Find(&unhealthyRows).Error; err != nil {
		common.SysError("pressure recompute: query health rows failed: " + err.Error())
		return
	}

	unhealthy := make(map[string]int)
	for i := range unhealthyRows {
		if _, tracked := totals[unhealthyRows[i].Model]; !tracked {
			continue
		}
		unhealthy[unhealthyRows[i].Model]++
	}

	newMap := make(map[string]*modelPressure, len(totals))
	for model, total := range totals {
		healthy := total - unhealthy[model]
		if healthy < 0 {
			healthy = 0
		}
		newMap[model] = &modelPressure{total: total, healthy: healthy}
	}

	pressureLock.Lock()
	pressureIDM = newMap
	pressureLock.Unlock()
	common.SysLog("channel model pressure recompute complete")
}

// maybeEmergencyRecover synchronously batch-recovers units when a model's
// availability drops below EmergencyThreshold. It revives health-owned
// cooldown state only: the earliest-expiring cooling windows are force-ended
// (deadline zeroed, RampExited cleared so slow start applies, ramp armed) so
// the units re-enter the pool immediately. A hard-disabled unit is never a
// candidate — that is explicit operator state, not health. A unit whose
// channel/key is not enabled is left cooling and logged: reporting it healthy
// would count an unroutable route as available.
func maybeEmergencyRecover(model string, now time.Time) {
	if !UnitHealthEnabled() {
		return
	}
	pressureLock.RLock()
	p := pressureIDM[model]
	pressureLock.RUnlock()
	if p == nil || p.total == 0 {
		return
	}

	cfg := GetUnitHealthSetting()
	ratio := float64(p.healthy) * 100 / float64(p.total)
	if ratio >= float64(cfg.EmergencyThreshold) {
		return
	}

	// Gap = units needed to reach WarningThreshold availability.
	want := int(math.Ceil(float64(p.total)*float64(cfg.WarningThreshold)/100)) - p.healthy
	if want <= 0 {
		return
	}

	nowMs := now.UnixMilli()
	type recoverRow struct {
		ChannelId int
		KeyIndex  int
		Model     string
	}
	var rows []recoverRow
	if err := dbx.DB.Model(&ChannelModelHealth{}).
		Select("channel_id, key_index, model").
		Where("model = ? AND cooldown_until_ms > ? AND hard_disabled = ?", model, nowMs, false).
		Order("cooldown_until_ms ASC, updated_at ASC").
		Limit(want).
		Find(&rows).Error; err != nil {
		common.SysError("emergency recover query failed: " + err.Error())
		return
	}

	for i := range rows {
		row := &rows[i]
		key := RouteKey{ChannelId: row.ChannelId, KeyIndex: row.KeyIndex, Model: row.Model}
		selectable, err := unitRouteEnabled(row.ChannelId, row.KeyIndex)
		if err != nil {
			common.SysError("emergency recover: channel read failed: channel=" + strconv.Itoa(row.ChannelId) + " err=" + err.Error())
			continue
		}
		if !selectable {
			logger.LogWarn(nil, "emergency recover skipped (route not enabled): channel="+strconv.Itoa(row.ChannelId)+" key="+strconv.Itoa(row.KeyIndex)+" model="+row.Model)
			continue
		}
		recovered := false
		err = casApplyUnit(key, now, func(r *ChannelModelHealth) (bool, error) {
			// Only units still cooling are eligible; a row recovered by a
			// concurrent writer (or hard-disabled meanwhile) passes through.
			if r.CooldownUntilMs == 0 || r.HardDisabled {
				return false, nil
			}
			st := stateFromRow(r)
			finishUnitCooldown(st, nowMs)
			applyStateToRow(r, st)
			recovered = true
			return true, nil
		})
		if err != nil {
			common.SysError("emergency recover failed: channel=" + strconv.Itoa(row.ChannelId) + " key=" + strconv.Itoa(row.KeyIndex) + " model=" + row.Model + " err=" + err.Error())
			continue
		}
		if recovered {
			logger.LogWarn(nil, "emergency recover route unit: channel="+strconv.Itoa(row.ChannelId)+" key="+strconv.Itoa(row.KeyIndex)+" model="+row.Model)
		}
	}
}

// unitRouteEnabled reports whether the channel (and, for a multi-key
// channel, the key index) is currently enabled, i.e. whether reviving this
// unit's cooldown can actually make the route selectable. A missing channel
// is treated as routable: the scheduler's own candidate pipeline will drop
// it if the channel really is gone, and the recovery must not be blocked by
// a transient read error.
func unitRouteEnabled(channelID, keyIndex int) (bool, error) {
	channel, err := GetChannelById(channelID, true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return true, nil
		}
		return false, err
	}
	if channel.Status != common.ChannelStatusEnabled {
		return false, nil
	}
	if !channel.ChannelInfo.IsMultiKey {
		return keyIndex == 0, nil
	}
	keys := channel.GetKeys()
	if keyIndex < 0 || keyIndex >= len(keys) {
		return false, nil
	}
	if status, tracked := channel.ChannelInfo.MultiKeyStatusList[keyIndex]; tracked {
		return status == common.ChannelStatusEnabled, nil
	}
	return true, nil
}
