package service

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

var (
	numericDurationPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(\d{1,4})\s*秒钟?`),
		regexp.MustCompile(`(?i)\b(\d{1,4})[\s-]*sec(?:ond)?s?\b`),
	}
	chineseDurationPatterns = []*regexp.Regexp{
		regexp.MustCompile(`([零〇一二两三四五六七八九十百]{1,6})\s*秒钟?`),
	}
	englishDurationPattern = regexp.MustCompile(`(?i)\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|sixty)[ -]+(?:second|sec)(?:s)?\b`)
)

var englishDurationValues = map[string]int{
	"one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
	"six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
	"eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
	"fifteen": 15, "twenty": 20, "thirty": 30, "sixty": 60,
}

func videoChannelSelectionOptions(param *RetryParam) model.ChannelSelectionOptions {
	options := model.ChannelSelectionOptions{}
	if param == nil {
		return options
	}
	if param.Ctx == nil || param.Ctx.Request == nil || param.Ctx.Request.Method != http.MethodPost {
		return options
	}
	path := strings.TrimSuffix(param.RequestPath, "/")
	if path != "/v1/videos" && path != "/v1/video/generations" {
		return options
	}

	durationSeconds, prompt := 0, ""
	contentType := param.Ctx.Request.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		request := relaycommon.TaskSubmitReq{}
		if err := common.UnmarshalBodyReusable(param.Ctx, &request); err != nil {
			return options
		}
		durationSeconds = request.Duration
		if durationSeconds == 0 && request.Seconds != "" {
			durationSeconds, _ = strconv.Atoi(request.Seconds)
		}
		prompt = request.Prompt
	} else {
		duration := param.Ctx.PostForm("duration")
		if duration == "" {
			duration = param.Ctx.PostForm("seconds")
		}
		durationSeconds, _ = strconv.Atoi(duration)
		prompt = param.Ctx.PostForm("prompt")
	}
	if durationSeconds == 0 {
		durationSeconds, _ = inferVideoDurationSeconds(prompt)
	}
	if durationSeconds <= 0 || durationSeconds > relaycommon.MaxTaskDurationSeconds {
		return options
	}

	options.VideoDurationSeconds = durationSeconds
	for _, channelID := range param.Ctx.GetStringSlice("use_channel") {
		id, err := strconv.Atoi(channelID)
		if err != nil || id <= 0 {
			continue
		}
		if options.ExcludedChannelIDs == nil {
			options.ExcludedChannelIDs = make(map[int]struct{})
		}
		options.ExcludedChannelIDs[id] = struct{}{}
	}
	return options
}

// inferVideoDurationSeconds recognizes only explicit duration expressions. If
// a prompt contains conflicting values, routing falls back to priority/weight.
func inferVideoDurationSeconds(prompt string) (int, bool) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return 0, false
	}
	candidates := make(map[int]struct{})
	for _, pattern := range numericDurationPatterns {
		for _, match := range pattern.FindAllStringSubmatch(prompt, -1) {
			seconds, err := strconv.Atoi(match[1])
			if err == nil && seconds > 0 && seconds <= relaycommon.MaxTaskDurationSeconds {
				candidates[seconds] = struct{}{}
			}
		}
	}
	for _, pattern := range chineseDurationPatterns {
		for _, match := range pattern.FindAllStringSubmatch(prompt, -1) {
			if seconds, ok := parseChineseDurationNumber(match[1]); ok && seconds <= relaycommon.MaxTaskDurationSeconds {
				candidates[seconds] = struct{}{}
			}
		}
	}
	for _, match := range englishDurationPattern.FindAllStringSubmatch(prompt, -1) {
		if seconds := englishDurationValues[strings.ToLower(match[1])]; seconds > 0 {
			candidates[seconds] = struct{}{}
		}
	}
	if len(candidates) != 1 {
		return 0, false
	}
	for seconds := range candidates {
		return seconds, true
	}
	return 0, false
}

func parseChineseDurationNumber(raw string) (int, bool) {
	raw = strings.NewReplacer("〇", "零", "两", "二").Replace(raw)
	total, current := 0, 0
	for _, value := range raw {
		if parsed, ok := chineseDurationDigit(value); ok {
			current = parsed
			continue
		}
		switch value {
		case '十':
			if current == 0 {
				current = 1
			}
			total += current * 10
			current = 0
		case '百':
			if current == 0 {
				current = 1
			}
			total += current * 100
			current = 0
		default:
			return 0, false
		}
	}
	total += current
	return total, total > 0
}

func chineseDurationDigit(value rune) (int, bool) {
	switch value {
	case '零':
		return 0, true
	case '一':
		return 1, true
	case '二':
		return 2, true
	case '三':
		return 3, true
	case '四':
		return 4, true
	case '五':
		return 5, true
	case '六':
		return 6, true
	case '七':
		return 7, true
	case '八':
		return 8, true
	case '九':
		return 9, true
	default:
		return 0, false
	}
}
