package service

import (
	"context"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type dualPricingClient struct {
	primary   []byte
	secondary []byte
}

func (c *dualPricingClient) FetchCatalog(context.Context, string, string) ([]byte, string, bool, error) {
	return c.primary, "primary-v1", false, nil
}
func (c *dualPricingClient) FetchChangeToken(context.Context, string) (string, error) { return "", nil }
func (c *dualPricingClient) FetchCatalogForSource(_ context.Context, source, _ string, _ string) ([]byte, string, bool, error) {
	if source == "models.dev" {
		return c.secondary, "secondary-v1", false, nil
	}
	return c.primary, "primary-v1", false, nil
}
func (c *dualPricingClient) FetchChangeTokenForSource(context.Context, string, string) (string, error) {
	return "", nil
}

func TestDualPricingSyncMergesPrimaryAndSecondarySources(t *testing.T) {
	client := &dualPricingClient{
		primary:   []byte(`{"shared":{"input_cost_per_token":0.000002,"output_cost_per_token":0.000008}}`),
		secondary: []byte(`{"openai":{"models":{"shared":{"cost":{"input":9,"output":36}},"secondary-only":{"cost":{"input":2,"output":8}}}}}`),
	}
	previousClient := autoPricingClient
	previousSetting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok)
	settingCopy := *previousSetting
	autoPricingClient = client
	previousSetting.RemoteURL = "https://primary.invalid/catalog.json"
	previousSetting.HashURL = ""
	previousSetting.ModelsDevURL = "https://secondary.invalid/api.json"
	workDir, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(t.TempDir()))
	t.Cleanup(func() {
		autoPricingClient = previousClient
		*previousSetting = settingCopy
		autopricing.SetCatalog(nil)
		autoPricingMu.Lock()
		autoPricingSnapshotLive = nil
		autoPricingLastError = ""
		autoPricingSource = ""
		autoPricingMu.Unlock()
		_ = os.Chdir(workDir)
	})

	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	primary, ok := autopricing.Resolve("shared", false)
	require.True(t, ok)
	require.Equal(t, 1.0, primary.ModelRatio)
	secondary, ok := autopricing.Resolve("secondary-only", false)
	require.True(t, ok)
	require.Equal(t, 1.0, secondary.ModelRatio)
	status := GetAutoPricingStatus()
	require.Equal(t, 1, status.SecondarySupplementCount)
	require.Equal(t, "merged", status.Source)
}

func TestDualPricingInitialFailurePublishesSourceErrors(t *testing.T) {
	client := &dualPricingClient{primary: []byte(`{}`), secondary: []byte(`{}`)}
	previousClient := autoPricingClient
	previousSetting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok)
	settingCopy := *previousSetting
	autoPricingClient = client
	previousSetting.RemoteURL = "https://primary.invalid/catalog.json"
	previousSetting.HashURL = ""
	previousSetting.ModelsDevURL = "https://secondary.invalid/api.json"
	workDir, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(t.TempDir()))
	t.Cleanup(func() {
		autoPricingClient = previousClient
		*previousSetting = settingCopy
		autopricing.SetCatalog(nil)
		autoPricingMu.Lock()
		autoPricingSnapshotLive = nil
		autoPricingLastError = ""
		autoPricingSource = ""
		autoPricingMu.Unlock()
		_ = os.Chdir(workDir)
	})

	err = SyncAutoPricingOnce(context.Background(), true)
	require.Error(t, err)
	status := GetAutoPricingStatus()
	assert.False(t, status.Loaded)
	assert.Equal(t, "unavailable", status.State)
	assert.Len(t, status.Sources, 2)
	for _, source := range status.Sources {
		assert.Equal(t, "unavailable", source.State)
		assert.NotEmpty(t, source.LastError)
	}
}

func TestDualPricingFailureKeepsPreviousCatalogAndReturnsError(t *testing.T) {
	client := &dualPricingClient{
		primary:   []byte(`{"shared":{"input_cost_per_token":0.000002,"output_cost_per_token":0.000008}}`),
		secondary: []byte(`{"openai":{"models":{"secondary-only":{"cost":{"input":2,"output":8}}}}}`),
	}
	previousClient := autoPricingClient
	previousSetting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok)
	settingCopy := *previousSetting
	autoPricingClient = client
	previousSetting.RemoteURL = "https://primary.invalid/catalog.json"
	previousSetting.HashURL = ""
	previousSetting.ModelsDevURL = "https://secondary.invalid/api.json"
	workDir, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(t.TempDir()))
	t.Cleanup(func() {
		autoPricingClient = previousClient
		*previousSetting = settingCopy
		autopricing.SetCatalog(nil)
		autoPricingMu.Lock()
		autoPricingSnapshotLive = nil
		autoPricingLastError = ""
		autoPricingSource = ""
		autoPricingMu.Unlock()
		_ = os.Chdir(workDir)
	})

	require.NoError(t, SyncAutoPricingOnce(context.Background(), true))
	client.primary, client.secondary = []byte(`{}`), []byte(`{}`)
	err = SyncAutoPricingOnce(context.Background(), true)
	require.Error(t, err)
	entry, ok := autopricing.Resolve("shared", false)
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)
	status := GetAutoPricingStatus()
	assert.Equal(t, "stale", status.State)
	assert.NotEmpty(t, status.LastError)
}
