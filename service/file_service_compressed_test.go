package service

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
)

func mkCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/", nil)
	return c
}

func makeJPEGBytes(t *testing.T, w, h, q int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 128, 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, &jpeg.Options{Quality: q}))
	return buf.Bytes()
}

func makeBase64Src(t *testing.T, raw []byte, mime string) *types.Base64Source {
	t.Helper()
	return types.NewBase64FileSource(base64.StdEncoding.EncodeToString(raw), mime)
}

func TestGetBase64DataWithConstraint_Disabled_EquivalentToGetBase64Data(t *testing.T) {
	body := makeJPEGBytes(t, 100, 100, 85)
	src := makeBase64Src(t, body, "image/jpeg")
	ctx := mkCtx()

	b64, mime, err := GetBase64DataWithConstraint(ctx, src, setting.ImageConstraint{Enabled: false}, "test")
	require.NoError(t, err)
	require.Equal(t, "image/jpeg", mime)

	decoded, err := base64.StdEncoding.DecodeString(b64)
	require.NoError(t, err)
	require.Equal(t, body, decoded)
}

func TestGetBase64DataWithConstraint_LargeImage_IsCompressed(t *testing.T) {
	body := makeJPEGBytes(t, 3000, 3000, 92) // 通常 > 500 KB
	src := makeBase64Src(t, body, "image/jpeg")
	ctx := mkCtx()

	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     500_000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	b64, mime, err := GetBase64DataWithConstraint(ctx, src, constraint, "test")
	require.NoError(t, err)
	require.Equal(t, "image/jpeg", mime)

	decoded, err := base64.StdEncoding.DecodeString(b64)
	require.NoError(t, err)
	require.LessOrEqual(t, int64(len(decoded)), constraint.MaxBytes)
}

func TestGetBase64DataWithConstraint_DifferentConstraints_DoNotCollide(t *testing.T) {
	body := makeJPEGBytes(t, 3000, 3000, 92)

	ctx := mkCtx()

	// 使用两个独立的 src 实例以避免 source-level 缓存干扰
	srcTight := makeBase64Src(t, body, "image/jpeg")
	srcLoose := makeBase64Src(t, body, "image/jpeg")

	tight := setting.ImageConstraint{
		Enabled: true, MaxBytes: 200_000, MaxDim: 1568, QualitySteps: []int{85, 70, 55, 40},
	}
	loose := setting.ImageConstraint{
		Enabled: true, MaxBytes: 2_000_000, MaxDim: 1568, QualitySteps: []int{85, 70, 55, 40},
	}

	b64Tight, _, err := GetBase64DataWithConstraint(ctx, srcTight, tight, "tight")
	require.NoError(t, err)
	b64Loose, _, err := GetBase64DataWithConstraint(ctx, srcLoose, loose, "loose")
	require.NoError(t, err)

	// 两次结果应不同（tight 更小），且各自满足自己的 MaxBytes
	require.NotEqual(t, b64Tight, b64Loose)

	dTight, _ := base64.StdEncoding.DecodeString(b64Tight)
	dLoose, _ := base64.StdEncoding.DecodeString(b64Loose)
	require.LessOrEqual(t, int64(len(dTight)), tight.MaxBytes)
	require.LessOrEqual(t, int64(len(dLoose)), loose.MaxBytes)
}

func TestGetBase64DataWithConstraint_SameConstraint_CachedOnSecondCall(t *testing.T) {
	body := makeJPEGBytes(t, 3000, 3000, 92)
	src := makeBase64Src(t, body, "image/jpeg")
	ctx := mkCtx()

	constraint := setting.ImageConstraint{
		Enabled: true, MaxBytes: 500_000, MaxDim: 1568, QualitySteps: []int{85, 70, 55, 40},
	}

	b64a, _, err := GetBase64DataWithConstraint(ctx, src, constraint, "first")
	require.NoError(t, err)
	b64b, _, err := GetBase64DataWithConstraint(ctx, src, constraint, "second")
	require.NoError(t, err)
	require.Equal(t, b64a, b64b)
}

func TestGetBase64DataWithConstraint_Base64WithSamePrefix_DoNotCollide(t *testing.T) {
	bodyA := makeJPEGBytes(t, 100, 100, 85)
	bodyB := makeJPEGBytes(t, 120, 100, 85) // same leading JPEG magic, different content
	require.NotEqual(t, bodyA, bodyB, "test fixtures must actually differ")

	ctx := mkCtx()
	srcA := types.NewBase64FileSource(base64.StdEncoding.EncodeToString(bodyA), "image/jpeg")
	srcB := types.NewBase64FileSource(base64.StdEncoding.EncodeToString(bodyB), "image/jpeg")

	// 让两张图都进入压缩路径，同时 MaxBytes 足够大让压缩能成功
	constraint := setting.ImageConstraint{
		Enabled:      true,
		MaxBytes:     5_000,
		MaxDim:       1568,
		QualitySteps: []int{85, 70, 55, 40},
	}

	b64A, _, err := GetBase64DataWithConstraint(ctx, srcA, constraint, "A")
	require.NoError(t, err)
	b64B, _, err := GetBase64DataWithConstraint(ctx, srcB, constraint, "B")
	require.NoError(t, err)

	require.NotEqual(t, b64A, b64B, "different base64 sources must get independent cache entries")
}
