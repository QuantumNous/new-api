package selfupdate

import (
	"strconv"
	"strings"
)

// NormalizeVersion trims whitespace and strips a leading 'v' prefix.
func NormalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	return v
}

// parseCore splits a semver core "1.2.3" into [1, 2, 3].
// Non-numeric segments are treated as 0.
func parseCore(core string) [3]int {
	parts := strings.SplitN(core, ".", 3)
	var nums [3]int
	for i, p := range parts {
		if i >= 3 {
			break
		}
		n, err := strconv.Atoi(p)
		if err != nil {
			// try numeric prefix only (e.g. "0-rc.21" → 0)
			for j, c := range p {
				if c < '0' || c > '9' {
					n, _ = strconv.Atoi(p[:j])
					break
				}
			}
		}
		nums[i] = n
	}
	return nums
}

// parsePreRelease extracts the trailing numeric value from a pre-release
// segment like "rc.21" → 21. Returns -1 when no pre-release is present
// (i.e. release > pre-release), and 0 when no numeric tail is found.
func parsePreRelease(pre string) int {
	if pre == "" {
		return -1 // no pre-release means it's a release (greater than any pre-release)
	}
	// find last dot or end
	idx := strings.LastIndex(pre, ".")
	tail := pre
	if idx >= 0 {
		tail = pre[idx+1:]
	}
	n, err := strconv.Atoi(tail)
	if err != nil {
		return 0
	}
	return n
}

// splitToyHunterBuild splits "1.0.0-rc.21-th.4" into ("1.0.0-rc.21", 4).
// When no "-th.N" suffix is present, th is -1.
func splitToyHunterBuild(v string) (rest string, th int) {
	const marker = "-th."
	idx := strings.LastIndex(v, marker)
	if idx < 0 {
		return v, -1
	}
	n, err := strconv.Atoi(v[idx+len(marker):])
	if err != nil {
		return v, -1
	}
	return v[:idx], n
}

// CompareVersions compares two version strings (with or without leading 'v').
// Returns -1 if current < latest, 0 if equal, 1 if current > latest.
//
// Order:
//  1. semver core (major.minor.patch)
//  2. pre-release (e.g. rc.N); a release (no pre) is greater than any pre-release
//  3. ToyHunter fork build suffix -th.N (e.g. v1.0.0-rc.21-th.3 < v1.0.0-rc.21-th.4);
//     a version without -th.N is treated as lower than the same base with -th.N
func CompareVersions(current, latest string) int {
	cur := NormalizeVersion(current)
	lat := NormalizeVersion(latest)

	curRest, curTh := splitToyHunterBuild(cur)
	latRest, latTh := splitToyHunterBuild(lat)

	// Split into core and optional pre-release on first '-'
	splitPre := func(v string) (string, string) {
		idx := strings.Index(v, "-")
		if idx < 0 {
			return v, ""
		}
		return v[:idx], v[idx+1:]
	}

	curCore, curPre := splitPre(curRest)
	latCore, latPre := splitPre(latRest)

	cNums := parseCore(curCore)
	lNums := parseCore(latCore)

	for i := 0; i < 3; i++ {
		if cNums[i] < lNums[i] {
			return -1
		}
		if cNums[i] > lNums[i] {
			return 1
		}
	}

	// Cores are equal; compare pre-release.
	cPreVal := parsePreRelease(curPre)
	lPreVal := parsePreRelease(latPre)

	if cPreVal == -1 && lPreVal == -1 {
		// both releases — fall through to th compare
	} else if cPreVal == -1 {
		return 1 // current is a release, latest is a pre-release
	} else if lPreVal == -1 {
		return -1 // current is a pre-release, latest is a release
	} else if cPreVal < lPreVal {
		return -1
	} else if cPreVal > lPreVal {
		return 1
	}

	// Same core + pre-release: compare -th.N
	if curTh == -1 && latTh == -1 {
		return 0
	}
	if curTh == -1 {
		return -1
	}
	if latTh == -1 {
		return 1
	}
	if curTh < latTh {
		return -1
	}
	if curTh > latTh {
		return 1
	}
	return 0
}
