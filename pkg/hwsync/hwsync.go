// Package hwsync knows which upstream tag our main branch contains and which of
// two upstream tags is newer.
//
// The merged tag travels with the merge itself: .hw/sync-upstream.sh writes the
// tag into merged-tag.txt on the sync branch before its merge commit, so a
// merged branch cannot disagree with the file and no runtime guess is needed.
//
// The ordering mirrors the frontend (web/src/features/system-update/releases.ts)
// so the dashboard and this endpoint never disagree about which release is the
// newest. It also mirrors the shell script's `sort -V` for the rc tags we track,
// which is what makes "the newest tag" mean the same thing in all three places.
package hwsync

import (
	_ "embed"
	"errors"
	"regexp"
	"strconv"
	"strings"
)

//go:embed merged-tag.txt
var mergedTag string

// MergedTag is the upstream tag that is in our main branch; empty when unknown.
func MergedTag() string {
	return strings.TrimSpace(mergedTag)
}

var tagPattern = regexp.MustCompile(`^v?(\d+(?:\.\d+){2,})(?:-(alpha|beta|rc|patch)(?:\.(\d+))?(?:-i18nfix\.(\d+))?)?(?:\+[\da-zA-Z.-]+)?$`)

// Release stages, in the order releases.ts ranks them: a release candidate is
// older than the stable release of the same number, a patch is newer.
var tagStages = map[string]int{"alpha": 0, "beta": 1, "rc": 2, "stable": 3, "patch": 4}

type tagVersion struct {
	core     []int
	stage    int
	sequence int
	revision int
	valid    bool
}

func parseTag(value string) tagVersion {
	match := tagPattern.FindStringSubmatch(strings.TrimSpace(value))
	if match == nil {
		return tagVersion{}
	}
	if match[4] != "" && match[2] != "rc" {
		return tagVersion{}
	}
	parts := strings.Split(match[1], ".")
	version := tagVersion{core: make([]int, len(parts)), stage: tagStages["stable"], valid: true}
	allZero := true
	for i, part := range parts {
		number, err := strconv.Atoi(part)
		if err != nil {
			return tagVersion{}
		}
		version.core[i] = number
		if number != 0 {
			allZero = false
		}
	}
	if allZero {
		return tagVersion{}
	}
	if match[2] != "" {
		version.stage = tagStages[match[2]]
	}
	if match[3] != "" {
		version.sequence, _ = strconv.Atoi(match[3])
	}
	if match[4] != "" {
		version.revision, _ = strconv.Atoi(match[4])
	}
	return version
}

// CompareTags orders two upstream tags: -1 when left is older, 1 when newer and
// 0 when equal. An error means one of them is not a tag this fork follows, and
// the caller must not treat that as "older": a misread tag would make the
// dashboard report the wrong release.
func CompareTags(left, right string) (int, error) {
	a, b := parseTag(left), parseTag(right)
	if !a.valid {
		return 0, errors.New("not an upstream tag: " + left)
	}
	if !b.valid {
		return 0, errors.New("not an upstream tag: " + right)
	}
	for i := range max(len(a.core), len(b.core)) {
		leftPart, rightPart := 0, 0
		if i < len(a.core) {
			leftPart = a.core[i]
		}
		if i < len(b.core) {
			rightPart = b.core[i]
		}
		if leftPart != rightPart {
			return sign(leftPart - rightPart), nil
		}
	}
	for _, pair := range [][2]int{{a.stage, b.stage}, {a.sequence, b.sequence}, {a.revision, b.revision}} {
		if pair[0] != pair[1] {
			return sign(pair[0] - pair[1]), nil
		}
	}
	return 0, nil
}

func sign(difference int) int {
	switch {
	case difference < 0:
		return -1
	case difference > 0:
		return 1
	default:
		return 0
	}
}
