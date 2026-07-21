package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateImageResolutionPriceNormalizesAndReplacesAtomically(t *testing.T) {
	saved := ImageResolutionPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateImageResolutionPriceByJSONString(saved))
	})

	require.NoError(t, UpdateImageResolutionPriceByJSONString(`{"gpt-image-2":{"1k":0.25,"4K":1.2}}`))
	price, ok := GetImageResolutionPrice("gpt-image-2", " 1K ")
	require.True(t, ok)
	assert.Equal(t, 0.25, price)

	err := UpdateImageResolutionPriceByJSONString(`{"gpt-image-2":{"1K":0.25,"4K":-1}}`)
	require.ErrorContains(t, err, "invalid price")
	price, ok = GetImageResolutionPrice("gpt-image-2", "4K")
	require.True(t, ok)
	assert.Equal(t, 1.2, price)
}

func TestGetImageResolutionPricesReturnsCopy(t *testing.T) {
	saved := ImageResolutionPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateImageResolutionPriceByJSONString(saved))
	})

	require.NoError(t, UpdateImageResolutionPriceByJSONString(`{"gpt-image-2":{"1K":0.25}}`))
	prices := GetImageResolutionPrices("gpt-image-2")
	prices["1K"] = 99

	price, ok := GetImageResolutionPrice("gpt-image-2", "1K")
	require.True(t, ok)
	assert.Equal(t, 0.25, price)
}

func TestNormalizeImageResolutionRejectsInvalidTier(t *testing.T) {
	_, err := NormalizeImageResolution("auto")
	require.ErrorContains(t, err, "invalid image resolution")
	_, err = NormalizeImageResolution("0K")
	require.ErrorContains(t, err, "invalid image resolution")
	_, err = NormalizeImageResolution("+2K")
	require.ErrorContains(t, err, "invalid image resolution")
	_, err = NormalizeImageResolution("0003")
	require.ErrorContains(t, err, "invalid image resolution")
}

func TestUpdateImageResolutionPriceRejectsTrimmedDuplicateModels(t *testing.T) {
	saved := ImageResolutionPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateImageResolutionPriceByJSONString(saved))
	})

	err := UpdateImageResolutionPriceByJSONString(`{"gpt-image-2":{"1K":0.25}," gpt-image-2 ":{"4K":1.2}}`)
	require.ErrorContains(t, err, "duplicate model")
}

func TestUpdateImageResolutionPriceClearsOnEmptyValue(t *testing.T) {
	saved := ImageResolutionPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateImageResolutionPriceByJSONString(saved))
	})

	require.NoError(t, UpdateImageResolutionPriceByJSONString(`{"image-model":{"1K":0.25}}`))
	_, ok := GetImageResolutionPrice("image-model", "1K")
	require.True(t, ok)

	require.NoError(t, UpdateImageResolutionPriceByJSONString(""))
	assert.Empty(t, GetImageResolutionPriceCopy())
}

func TestValidateImageResolutionPriceDoesNotMutateRuntimePrices(t *testing.T) {
	saved := ImageResolutionPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateImageResolutionPriceByJSONString(saved))
	})

	require.NoError(t, UpdateImageResolutionPriceByJSONString(`{"image-model":{"1K":0.25}}`))
	require.NoError(t, ValidateImageResolutionPriceJSONString(`{"image-model":{"4K":1.2}}`))

	price, ok := GetImageResolutionPrice("image-model", "1K")
	require.True(t, ok)
	assert.Equal(t, 0.25, price)
	_, ok = GetImageResolutionPrice("image-model", "4K")
	assert.False(t, ok)
}

func TestRemoveImageResolutionPriceModelsJSONString(t *testing.T) {
	next, changed, err := RemoveImageResolutionPriceModelsJSONString(
		`{"remove-me":{"1K":0.25},"keep-me":{"4K":1.2}}`,
		[]string{" remove-me "},
	)
	require.NoError(t, err)
	require.True(t, changed)
	assert.JSONEq(t, `{"keep-me":{"4K":1.2}}`, next)

	next, changed, err = RemoveImageResolutionPriceModelsJSONString(next, []string{"missing"})
	require.NoError(t, err)
	assert.False(t, changed)
	assert.JSONEq(t, `{"keep-me":{"4K":1.2}}`, next)
}
