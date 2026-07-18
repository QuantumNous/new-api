package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseRunMode(t *testing.T) {
	for input, expected := range map[string]runMode{
		"":          runModeAll,
		"all":       runModeAll,
		"SERVE":     runModeServe,
		"worker":    runModeWorker,
		"scheduler": runModeScheduler,
		"migrate":   runModeMigrate,
	} {
		actual, err := parseRunMode(input)
		require.NoError(t, err)
		require.Equal(t, expected, actual)
	}
	_, err := parseRunMode("cron")
	require.Error(t, err)
}

func TestRunModeCapabilities(t *testing.T) {
	require.True(t, runModeAll.servesHTTP())
	require.True(t, runModeAll.runsWorker())
	require.True(t, runModeAll.runsScheduler())
	require.True(t, runModeServe.servesHTTP())
	require.False(t, runModeServe.runsWorker())
	require.False(t, runModeWorker.servesHTTP())
	require.True(t, runModeWorker.runsWorker())
	require.True(t, runModeScheduler.runsScheduler())
}

func TestParseRuntimeConfigRejectsInvalidCombinations(t *testing.T) {
	_, _, err := parseRuntimeConfig("all", "public", "")
	require.Error(t, err)

	_, _, err = parseRuntimeConfig("migrate", "all", "slave")
	require.Error(t, err)
	_, _, err = parseRuntimeConfig("worker", "all", "slave")
	require.Error(t, err)
	_, _, err = parseRuntimeConfig("scheduler", "all", "slave")
	require.Error(t, err)

	mode, plane, err := parseRuntimeConfig("serve", "relay", "slave")
	require.NoError(t, err)
	require.Equal(t, runModeServe, mode)
	require.Equal(t, "relay", string(plane))
}
