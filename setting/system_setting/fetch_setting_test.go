package system_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func applyFetchConfig(t *testing.T, values map[string]string) {
	t.Helper()
	require.NoError(t, config.UpdateConfigFromMap(&defaultFetchSetting, values))
}

func restoreFetchSetting(t *testing.T) {
	t.Helper()
	orig := defaultFetchSetting
	origSnapshot := fetchSnapshot.Load()
	t.Cleanup(func() {
		defaultFetchSetting = orig
		fetchSnapshot.Store(origSnapshot)
	})
}

// GetFetchSetting 返回的快照必须与注册给 ConfigManager 的写入目标解耦。
//
// 这是 SSRF 名单能被安全读取的根本原因：热更新用反射原地重填 DomainList/IpList/AllowedPorts
// 的底层数组，若调用方拿到的是同一份切片，就可能在遍历名单的过程中看到被改写一半的内容，
// 从而放行本应拒绝的目标。
func TestGetFetchSettingReturnsDecoupledSnapshot(t *testing.T) {
	restoreFetchSetting(t)

	applyFetchConfig(t, map[string]string{
		"domain_list":   `["a.com","b.com"]`,
		"ip_list":       `["10.0.0.0/8"]`,
		"allowed_ports": `["80","443"]`,
	})
	held := GetFetchSetting()
	require.Equal(t, []string{"a.com", "b.com"}, held.DomainList)

	applyFetchConfig(t, map[string]string{
		"domain_list":   `["evil.com"]`,
		"ip_list":       `["0.0.0.0/0"]`,
		"allowed_ports": `["1"]`,
	})

	assert.Equal(t, []string{"a.com", "b.com"}, held.DomainList, "已取得的快照不应被后续热更新改写")
	assert.Equal(t, []string{"10.0.0.0/8"}, held.IpList)
	assert.Equal(t, []string{"80", "443"}, held.AllowedPorts)

	assert.Equal(t, []string{"evil.com"}, GetFetchSetting().DomainList, "新快照应反映最新配置")
}

// 快照必须持有底层数组的独立副本，而不只是新的切片头。
func TestFetchSnapshotClonesBackingArrays(t *testing.T) {
	restoreFetchSetting(t)

	applyFetchConfig(t, map[string]string{"domain_list": `["a.com","b.com"]`})
	held := GetFetchSetting()

	defaultFetchSetting.DomainList[0] = "mutated.com"

	assert.Equal(t, "a.com", held.DomainList[0], "快照不应与写入目标共享底层数组")
}

// 默认值必须在任何配置写入之前就可用，否则启动早期的 SSRF 校验会拿到零值而失去防护。
func TestFetchSnapshotAvailableBeforeAnyUpdate(t *testing.T) {
	setting := GetFetchSetting()
	require.NotNil(t, setting)
	assert.True(t, setting.EnableSSRFProtection)
	assert.Equal(t, []string{"80", "443", "8080", "8443"}, setting.AllowedPorts)
}
