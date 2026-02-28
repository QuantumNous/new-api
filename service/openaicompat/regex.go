package openaicompat

import (
	"regexp"
	"sync"
)

var compiledRegexCache sync.Map // map[string]*regexp.Regexp

// matchAnyRegex returns true when s matches at least one of the given
// regex patterns.  Compiled regexes are cached in a sync.Map for
// performance.  Invalid patterns are silently skipped to avoid breaking
// runtime traffic.
func matchAnyRegex(patterns []string, s string) bool {
	if len(patterns) == 0 || s == "" {
		return false
	}
	for _, pattern := range patterns {
		if pattern == "" {
			continue
		}
		re, ok := compiledRegexCache.Load(pattern)
		if !ok {
			compiled, err := regexp.Compile(pattern)
			if err != nil {
				// Treat invalid patterns as non-matching to avoid breaking runtime traffic.
				continue
			}
			re = compiled
			compiledRegexCache.Store(pattern, re)
		}
		if re.(*regexp.Regexp).MatchString(s) {
			return true
		}
	}
	return false
}
