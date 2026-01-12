package operation_setting

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type StatusCodeRange struct {
	Start int
	End   int
}

var AutomaticDisableStatusCodeRanges = []StatusCodeRange{{Start: 401, End: 401}}

func AutomaticDisableStatusCodesToString() string {
	if len(AutomaticDisableStatusCodeRanges) == 0 {
		return ""
	}
	parts := make([]string, 0, len(AutomaticDisableStatusCodeRanges))
	for _, r := range AutomaticDisableStatusCodeRanges {
		if r.Start == r.End {
			parts = append(parts, strconv.Itoa(r.Start))
			continue
		}
		parts = append(parts, fmt.Sprintf("%d-%d", r.Start, r.End))
	}
	return strings.Join(parts, ",")
}

func AutomaticDisableStatusCodesFromString(s string) error {
	ranges, err := ParseHTTPStatusCodeRanges(s)
	if err != nil {
		return err
	}
	AutomaticDisableStatusCodeRanges = ranges
	return nil
}

func ShouldDisableByStatusCode(code int) bool {
	if code < 100 || code > 599 {
		return false
	}
	for _, r := range AutomaticDisableStatusCodeRanges {
		if code < r.Start {
			return false
		}
		if code <= r.End {
			return true
		}
	}
	return false
}

func ParseHTTPStatusCodeRanges(input string) ([]StatusCodeRange, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, nil
	}

	input = strings.NewReplacer("，", ",").Replace(input)
	segments := strings.Split(input, ",")

	var ranges []StatusCodeRange
	var invalid []string

	for _, seg := range segments {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}
		r, err := parseHTTPStatusCodeToken(seg)
		if err != nil {
			invalid = append(invalid, seg)
			continue
		}
		ranges = append(ranges, r)
	}

	if len(invalid) > 0 {
		return nil, fmt.Errorf("invalid http status code rules: %s", strings.Join(invalid, ", "))
	}
	if len(ranges) == 0 {
		return nil, nil
	}

	sort.Slice(ranges, func(i, j int) bool {
		if ranges[i].Start == ranges[j].Start {
			return ranges[i].End < ranges[j].End
		}
		return ranges[i].Start < ranges[j].Start
	})

	merged := []StatusCodeRange{ranges[0]}
	for _, r := range ranges[1:] {
		last := &merged[len(merged)-1]
		if r.Start <= last.End+1 {
			if r.End > last.End {
				last.End = r.End
			}
			continue
		}
		merged = append(merged, r)
	}

	return merged, nil
}

func parseHTTPStatusCodeToken(token string) (StatusCodeRange, error) {
	token = strings.TrimSpace(token)
	token = strings.ReplaceAll(token, " ", "")
	if token == "" {
		return StatusCodeRange{}, fmt.Errorf("empty token")
	}

	if strings.Contains(token, "-") {
		parts := strings.Split(token, "-")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return StatusCodeRange{}, fmt.Errorf("invalid range token: %s", token)
		}
		start, err := strconv.Atoi(parts[0])
		if err != nil {
			return StatusCodeRange{}, fmt.Errorf("invalid range start: %s", token)
		}
		end, err := strconv.Atoi(parts[1])
		if err != nil {
			return StatusCodeRange{}, fmt.Errorf("invalid range end: %s", token)
		}
		if start > end {
			return StatusCodeRange{}, fmt.Errorf("range start > end: %s", token)
		}
		if start < 100 || end > 599 {
			return StatusCodeRange{}, fmt.Errorf("range out of bounds: %s", token)
		}
		return StatusCodeRange{Start: start, End: end}, nil
	}

	code, err := strconv.Atoi(token)
	if err != nil {
		return StatusCodeRange{}, fmt.Errorf("invalid status code: %s", token)
	}
	if code < 100 || code > 599 {
		return StatusCodeRange{}, fmt.Errorf("status code out of bounds: %s", token)
	}
	return StatusCodeRange{Start: code, End: code}, nil
}
