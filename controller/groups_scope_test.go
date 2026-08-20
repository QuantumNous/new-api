package controller

import (
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestResolveVisibleGroupNamesRootGetsAll(t *testing.T) {
	all := []string{"default", "vip", "svip"}
	got := resolveVisibleGroupNames(common.RoleRootUser, "default", all)
	sort.Strings(got)
	assert.Equal(t, []string{"default", "svip", "vip"}, got)
}

func TestResolveVisibleGroupNamesRestrictedIntersects(t *testing.T) {
	all := []string{"default", "vip", "svip"}
	got := resolveVisibleGroupNamesWithVisible(all, []string{"default", "vip"})
	sort.Strings(got)
	assert.Equal(t, []string{"default", "vip"}, got)
}
