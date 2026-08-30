package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueRejectsUnknownStrictIsolationGroups(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"team-a":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})

	require.NoError(t, validateOptionValue("StrictGroupIsolationGroups", `[" team-a ","team-a",""]`))

	err := validateOptionValue("StrictGroupIsolationGroups", `["unknown-b","team-a","unknown-a","unknown-b"]`)
	require.Error(t, err)
	assert.Equal(t, "strict isolation groups are not configured in GroupRatio: unknown-a, unknown-b", err.Error())
}

func TestValidateOptionValueRejectsGroupRatioThatOrphansStrictGroup(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"team-a":1}`))
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["team-a"]`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})

	err := validateOptionValue("GroupRatio", `{"default":1}`)
	require.Error(t, err)
	assert.Equal(t, "strict isolation groups are not configured in GroupRatio: team-a", err.Error())
}

func TestValidateOptionValuesAcceptsAtomicStrictGroupReplacement(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"team-a":1}`))
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["team-a"]`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})

	require.NoError(t, validateOptionValues(map[string]string{
		"GroupRatio":                 `{"default":1,"team-b":1}`,
		"StrictGroupIsolationGroups": `["team-b"]`,
	}))
}

func TestUpdateOptionMapsPublishesStrictGroupSettingsAtomically(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"team-a":1}`))
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["team-a"]`))
	t.Cleanup(func() {
		strictGroupSnapshotPublishHook = nil
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})

	publishPaused := make(chan struct{})
	continuePublish := make(chan struct{})
	strictGroupSnapshotPublishHook = func() {
		close(publishPaused)
		<-continuePublish
	}

	var writer sync.WaitGroup
	writer.Add(1)
	go func() {
		defer writer.Done()
		require.NoError(t, updateOptionMaps(map[string]string{
			"GroupRatio":                 `{"default":1,"team-b":1}`,
			"StrictGroupIsolationGroups": `["team-b"]`,
		}))
	}()
	<-publishPaused

	readerDone := make(chan struct{})
	go func() {
		defer close(readerDone)
		assert.True(t, ratio_setting.ContainsGroupRatio("team-b"))
		assert.True(t, setting.IsStrictGroupIsolationEnabled("team-b"))
	}()

	select {
	case <-readerDone:
		t.Fatal("reader observed the snapshot while it was only partially published")
	case <-time.After(20 * time.Millisecond):
	}
	close(continuePublish)
	writer.Wait()
	select {
	case <-readerDone:
	case <-time.After(time.Second):
		t.Fatal("reader remained blocked after the snapshot was published")
	}
}

func TestConcurrentStrictGroupOptionUpdatesValidateSerially(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"team-a":1,"team-b":1}`))
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["team-a"]`))
	t.Cleanup(func() {
		strictGroupOptionValidatedHook = nil
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})

	firstValidated := make(chan struct{})
	continueFirst := make(chan struct{})
	var hookCalls int
	strictGroupOptionValidatedHook = func() {
		hookCalls++
		if hookCalls == 1 {
			close(firstValidated)
			<-continueFirst
		}
	}

	firstDone := make(chan error, 1)
	go func() {
		firstDone <- UpdateOption("StrictGroupIsolationGroups", `["team-b"]`)
	}()
	<-firstValidated

	secondDone := make(chan error, 1)
	go func() {
		secondDone <- UpdateOption("GroupRatio", `{"default":1,"team-a":1}`)
	}()
	select {
	case <-secondDone:
		t.Fatal("concurrent update bypassed strict-group option serialization")
	case <-time.After(20 * time.Millisecond):
	}

	close(continueFirst)
	require.NoError(t, <-firstDone)
	err := <-secondDone
	require.Error(t, err)
	assert.Equal(t, "strict isolation groups are not configured in GroupRatio: team-b", err.Error())
	assert.True(t, ratio_setting.ContainsGroupRatio("team-b"))
	assert.True(t, setting.IsStrictGroupIsolationEnabled("team-b"))
}
