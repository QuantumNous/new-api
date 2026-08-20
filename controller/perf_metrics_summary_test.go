package controller

import (
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestResolvePerfSummaryGroupsRootGetsAllActive(t *testing.T) {
	active := []string{"default", "vip", "auto"}
	got := resolvePerfSummaryGroups(common.RoleRootUser, "default", active)
	sort.Strings(got)
	assert.Equal(t, []string{"auto", "default", "vip"}, got)
}

func TestResolvePerfSummaryGroupsRestrictedIsIntersection(t *testing.T) {
	active := []string{"default", "vip", "svip", "auto"}
	// 受限用户可见 {default, vip}，交集应剔除 svip 与 auto
	got := resolvePerfSummaryGroupsWithVisible(active, []string{"default", "vip"})
	sort.Strings(got)
	assert.Equal(t, []string{"default", "vip"}, got)
}

func TestResolvePerfSummaryGroupsEmptyIntersectionIsFailClosed(t *testing.T) {
	active := []string{"default", "vip", "auto"}
	got := resolvePerfSummaryGroupsWithVisible(active, []string{"isolated"})
	assert.Empty(t, got)
}
