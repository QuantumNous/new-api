package router

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func setTestBrand(t *testing.T, name, logo string) {
	t.Helper()

	common.OptionMapRWMutex.Lock()
	oldName, oldLogo := common.SystemName, common.Logo
	common.SystemName, common.Logo = name, logo
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.SystemName, common.Logo = oldName, oldLogo
		common.OptionMapRWMutex.Unlock()
	})
}

func TestMobileWebManifestUsesConfiguredBrand(t *testing.T) {
	setTestBrand(t, "示例系统", "https://cdn.example.com/custom-logo.webp")

	data, err := MobileWebManifest()
	require.NoError(t, err)

	var manifest mobileManifest
	require.NoError(t, common.Unmarshal(data, &manifest))
	require.Equal(t, "示例系统", manifest.Name)
	require.Equal(t, "示例系统", manifest.ShortName)
	require.Equal(t, "/m/", manifest.ID)
	require.Len(t, manifest.Icons, 2)
	require.Equal(t, "https://cdn.example.com/custom-logo.webp", manifest.Icons[0].Src)
	require.Equal(t, "192x192", manifest.Icons[0].Sizes)
	require.Empty(t, manifest.Icons[0].Type)
	require.Equal(t, "https://cdn.example.com/custom-logo.webp", manifest.Icons[1].Src)
	require.Equal(t, "512x512", manifest.Icons[1].Sizes)
}

func TestMobileWebManifestFallsBackToBundledIcons(t *testing.T) {
	setTestBrand(t, "", "")

	data, err := MobileWebManifest()
	require.NoError(t, err)

	var manifest mobileManifest
	require.NoError(t, common.Unmarshal(data, &manifest))
	require.Equal(t, "New API", manifest.Name)
	require.Equal(t, "/m/icon-192.png", manifest.Icons[0].Src)
	require.Equal(t, "image/png", manifest.Icons[0].Type)
	require.Equal(t, "/m/icon-512.png", manifest.Icons[1].Src)
}

func TestBrandIndexHTMLUsesConfiguredMobileBrand(t *testing.T) {
	setTestBrand(t, "示例&系统", "https://cdn.example.com/logo.png?a=1&b=2")

	page := []byte(`<meta name="apple-mobile-web-app-title" content="New API" />` +
		`<link rel="apple-touch-icon" href="/m/icon-192.png" />` +
		`<title>New API</title>`)
	branded := string(BrandIndexHTML(page))

	require.Contains(t, branded, `content="示例&amp;系统"`)
	require.Contains(t, branded, `href="https://cdn.example.com/logo.png?a=1&amp;b=2"`)
	require.Contains(t, branded, `<title>示例&amp;系统</title>`)
}
