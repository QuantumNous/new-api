package controller

import (
	"sort"
	"strconv"
	"strings"
)

func parseHourListParam(raw string) ([]int64, bool, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, false, nil
	}
	parts := strings.Split(raw, ",")
	hours := make([]int64, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		ts, err := strconv.ParseInt(p, 10, 64)
		if err != nil {
			return nil, true, err
		}
		hours = append(hours, ts)
	}
	if len(hours) == 0 {
		return nil, false, nil
	}
	sort.Slice(hours, func(i, j int) bool { return hours[i] < hours[j] })
	return hours, true, nil
}

func isAlignedHour(ts int64) bool {
	return ts > 0 && ts%3600 == 0
}