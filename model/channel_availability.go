package model

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// MaxChannelAvailabilityWindows bounds the configured windows of one channel.
const MaxChannelAvailabilityWindows = 16

// channelAvailabilityWindow is a parsed availability window that costs only
// integer comparisons to evaluate on the channel selection path.
type channelAvailabilityWindow struct {
	location    *time.Location
	weekdays    [7]bool
	allWeekdays bool
	startMinute int
	endMinute   int
}

// ParseChannelAvailabilityWindows validates and parses the configured windows
// of one channel. An empty input means the channel is always available.
func ParseChannelAvailabilityWindows(windows []dto.ChannelAvailabilityWindow) ([]channelAvailabilityWindow, error) {
	if len(windows) > MaxChannelAvailabilityWindows {
		return nil, fmt.Errorf("availability_windows holds at most %d windows", MaxChannelAvailabilityWindows)
	}
	parsed := make([]channelAvailabilityWindow, 0, len(windows))
	for i, window := range windows {
		location := time.UTC
		if timezone := strings.TrimSpace(window.Timezone); timezone != "" {
			loaded, err := time.LoadLocation(timezone)
			if err != nil {
				return nil, fmt.Errorf("availability_windows[%d].timezone is not an IANA timezone: %s", i, timezone)
			}
			location = loaded
		}
		start, err := parseAvailabilityMinute(window.Start)
		if err != nil {
			return nil, fmt.Errorf("availability_windows[%d].start %s", i, err.Error())
		}
		end, err := parseAvailabilityMinute(window.End)
		if err != nil {
			return nil, fmt.Errorf("availability_windows[%d].end %s", i, err.Error())
		}
		if start == end {
			return nil, fmt.Errorf("availability_windows[%d] starts and ends at the same minute", i)
		}
		if len(window.Weekdays) > 7 {
			return nil, fmt.Errorf("availability_windows[%d].weekdays holds at most 7 days", i)
		}
		parsedWindow := channelAvailabilityWindow{
			location:    location,
			allWeekdays: len(window.Weekdays) == 0,
			startMinute: start,
			endMinute:   end,
		}
		for _, weekday := range window.Weekdays {
			if weekday < 0 || weekday > 6 {
				return nil, fmt.Errorf("availability_windows[%d].weekdays entry %d is outside 0-6", i, weekday)
			}
			parsedWindow.weekdays[weekday] = true
		}
		parsed = append(parsed, parsedWindow)
	}
	return parsed, nil
}

func parseAvailabilityMinute(value string) (int, error) {
	text := strings.TrimSpace(value)
	hourText, minuteText, found := strings.Cut(text, ":")
	if !found || len(hourText) != 2 || len(minuteText) != 2 {
		return 0, fmt.Errorf("%q is not HH:MM", text)
	}
	hour, err := strconv.Atoi(hourText)
	if err != nil || hour < 0 || hour > 23 {
		return 0, fmt.Errorf("%q is not HH:MM", text)
	}
	minute, err := strconv.Atoi(minuteText)
	if err != nil || minute < 0 || minute > 59 {
		return 0, fmt.Errorf("%q is not HH:MM", text)
	}
	return hour*60 + minute, nil
}

// matches reports whether now falls inside the window. An end earlier than the
// start crosses midnight, so the early hours belong to the same window.
func (window channelAvailabilityWindow) matches(now time.Time) bool {
	local := now.In(window.location)
	if !window.allWeekdays && !window.weekdays[int(local.Weekday())] {
		return false
	}
	minute := local.Hour()*60 + local.Minute()
	if window.startMinute < window.endMinute {
		return minute >= window.startMinute && minute < window.endMinute
	}
	return minute >= window.startMinute || minute < window.endMinute
}

// matchesAnyAvailabilityWindow reports whether no window is configured or one
// window matches now.
func matchesAnyAvailabilityWindow(windows []channelAvailabilityWindow, now time.Time) bool {
	if len(windows) == 0 {
		return true
	}
	for _, window := range windows {
		if window.matches(now) {
			return true
		}
	}
	return false
}

// GetAvailabilityWindows parses the channel's configured windows. A channel
// with an unparseable configuration stays available: the save path rejects such
// a configuration, so this only happens for rows written by hand.
func (channel *Channel) GetAvailabilityWindows() []channelAvailabilityWindow {
	if channel == nil || channel.Setting == nil || *channel.Setting == "" {
		return nil
	}
	setting := dto.ChannelSettings{}
	if err := common.UnmarshalJsonStr(*channel.Setting, &setting); err != nil {
		logger.LogWarn(nil, "channel availability setting is unreadable: channel_id=%d, error=%v", channel.Id, err)
		return nil
	}
	windows, err := ParseChannelAvailabilityWindows(setting.AvailabilityWindows)
	if err != nil {
		logger.LogWarn(nil, "channel availability setting is invalid: channel_id=%d, error=%v", channel.Id, err)
		return nil
	}
	return windows
}

// IsAvailableAt reports whether the channel may serve a request at now.
func (channel *Channel) IsAvailableAt(now time.Time) bool {
	if channel == nil {
		return false
	}
	return matchesAnyAvailabilityWindow(channel.GetAvailabilityWindows(), now)
}

// filterUnavailableChannelIDs drops candidate ids whose availability window
// excludes now. The caller holds channelSyncLock, and the input slice belongs to
// the cache, so the result is a new slice.
func filterUnavailableChannelIDs(ids []int, now time.Time) []int {
	if len(ids) == 0 || len(channel2availability) == 0 {
		return ids
	}
	kept := make([]int, 0, len(ids))
	for _, id := range ids {
		if matchesAnyAvailabilityWindow(channel2availability[id], now) {
			kept = append(kept, id)
		}
	}
	return kept
}

// filterAbilitiesByAvailability drops abilities whose channel is outside its
// availability window. It reads the channels of the candidate abilities in one
// query, for the path that selects without the memory cache.
func filterAbilitiesByAvailability(abilities []Ability, now time.Time) ([]Ability, error) {
	if len(abilities) == 0 {
		return abilities, nil
	}
	ids := make([]int, 0, len(abilities))
	for _, ability := range abilities {
		ids = append(ids, ability.ChannelId)
	}
	channels, err := GetChannelsByIds(ids)
	if err != nil {
		return nil, err
	}
	available := make(map[int]bool, len(channels))
	for _, channel := range channels {
		if channel.IsAvailableAt(now) {
			available[channel.Id] = true
		}
	}
	kept := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		if available[ability.ChannelId] {
			kept = append(kept, ability)
		}
	}
	return kept, nil
}

// ValidateAvailabilitySetting rejects a setting whose windows cannot be parsed.
func ValidateAvailabilitySetting(setting *string) error {
	if setting == nil || *setting == "" {
		return nil
	}
	parsed := dto.ChannelSettings{}
	if err := common.UnmarshalJsonStr(*setting, &parsed); err != nil {
		return nil // ValidateSettings reports the JSON error.
	}
	_, err := ParseChannelAvailabilityWindows(parsed.AvailabilityWindows)
	return err
}
