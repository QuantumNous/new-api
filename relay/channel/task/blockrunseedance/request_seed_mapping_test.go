package blockrunseedance

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func seedReq(items ...dto.SeedanceContentItem) *dto.SeedanceVideoRequest {
	return &dto.SeedanceVideoRequest{Model: "seedance-2.0", Content: items}
}

func img(url, role string) dto.SeedanceContentItem {
	return dto.SeedanceContentItem{Type: "image_url", ImageURL: &dto.SeedanceURLObject{URL: url}, Role: role}
}

func TestSeedMappingFirstLastFrame(t *testing.T) {
	r := seedReq(img("http://a/first.png", dto.SeedanceRoleFirstFrame), img("http://a/last.png", dto.SeedanceRoleLastFrame))
	if err := validateSeedanceValues(r, blockrunExtensions{}, "seedance-2.0"); err != nil {
		t.Fatalf("first+last must now be accepted: %v", err)
	}
	body := buildBlockrunSeedanceCreateRequest(r, blockrunExtensions{}, "bytedance/seedance-2.0")
	if body.ImageURL != "http://a/first.png" || body.LastFrameURL != "http://a/last.png" {
		t.Fatalf("first/last mapping wrong: %+v", body)
	}
}

func TestSeedMappingMultiReference(t *testing.T) {
	r := seedReq(img("http://a/1.png", ""), img("http://a/2.png", ""), img("http://a/3.png", dto.SeedanceRoleReferenceImage))
	if err := validateSeedanceValues(r, blockrunExtensions{}, "seedance-2.0"); err != nil {
		t.Fatalf("2-9 reference images must be accepted: %v", err)
	}
	body := buildBlockrunSeedanceCreateRequest(r, blockrunExtensions{}, "bytedance/seedance-2.0")
	if len(body.ReferenceImageURLs) != 3 || body.ImageURL != "" {
		t.Fatalf("reference mapping wrong: %+v", body)
	}
}

func TestSeedMappingSingleExplicitReferenceKeepsOmni(t *testing.T) {
	r := seedReq(img("http://a/ref.png", dto.SeedanceRoleReferenceImage))
	if err := validateSeedanceValues(r, blockrunExtensions{}, "seedance-2.0"); err != nil {
		t.Fatalf("single explicit reference must be accepted on 2.0: %v", err)
	}
	body := buildBlockrunSeedanceCreateRequest(r, blockrunExtensions{}, "bytedance/seedance-2.0")
	if len(body.ReferenceImageURLs) != 1 || body.ReferenceImageURLs[0] != "http://a/ref.png" || body.ImageURL != "" {
		t.Fatalf("explicit reference_image must map to reference_image_urls, not image_url: %+v", body)
	}
}

func TestSeedOmniReferenceModelGate(t *testing.T) {
	// reference_image_urls is Seedance 2.0 only — 1.5-pro must fail fast.
	multi := seedReq(img("http://a/1.png", ""), img("http://a/2.png", ""))
	multi.Model = "seedance-1.5-pro"
	if err := validateSeedanceValues(multi, blockrunExtensions{}, "seedance-1.5-pro"); err == nil || !strings.Contains(err.Error(), "only supported on seedance-2.0") {
		t.Fatalf("multi-reference on 1.5-pro must be gated, got: %v", err)
	}
	// first/last-frame interpolation IS supported on 1.5-pro — must pass.
	frames := seedReq(img("http://a/f.png", dto.SeedanceRoleFirstFrame), img("http://a/l.png", dto.SeedanceRoleLastFrame))
	frames.Model = "seedance-1.5-pro"
	if err := validateSeedanceValues(frames, blockrunExtensions{}, "seedance-1.5-pro"); err != nil {
		t.Fatalf("first/last interpolation on 1.5-pro must stay allowed: %v", err)
	}
	// A single plain image (image-to-video) also stays allowed on 1.5-pro.
	single := seedReq(img("http://a/s.png", ""))
	single.Model = "seedance-1.5-pro"
	if err := validateSeedanceValues(single, blockrunExtensions{}, "seedance-1.5-pro"); err != nil {
		t.Fatalf("single plain image on 1.5-pro must stay allowed: %v", err)
	}
}

func TestSeedMappingSingleImageUnchanged(t *testing.T) {
	r := seedReq(img("http://a/only.png", ""))
	body := buildBlockrunSeedanceCreateRequest(r, blockrunExtensions{}, "bytedance/seedance-2.0")
	if body.ImageURL != "http://a/only.png" || len(body.ReferenceImageURLs) != 0 {
		t.Fatalf("single image mapping regressed: %+v", body)
	}
}

func TestSeedValidationRejections(t *testing.T) {
	cases := []struct {
		name string
		req  *dto.SeedanceVideoRequest
		want string
	}{
		{"last without first", seedReq(img("u", dto.SeedanceRoleLastFrame)), "last_frame requires"},
		{"frames + reference mixed", seedReq(img("a", dto.SeedanceRoleFirstFrame), img("b", "")), "cannot be combined"},
		{"more than 9 references", seedReq(
			img("1", ""), img("2", ""), img("3", ""), img("4", ""), img("5", ""),
			img("6", ""), img("7", ""), img("8", ""), img("9", ""), img("10", "")), "at most 9"},
		{"duplicate first frames", seedReq(img("a", dto.SeedanceRoleFirstFrame), img("b", dto.SeedanceRoleFirstFrame)), "at most one"},
		{"duplicate last frames", seedReq(img("a", dto.SeedanceRoleLastFrame), img("b", dto.SeedanceRoleLastFrame)), "at most one"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSeedanceValues(tc.req, blockrunExtensions{}, "seedance-2.0")
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want error containing %q, got %v", tc.want, err)
			}
		})
	}
}

func TestSeedMappingFirstFrameOnly(t *testing.T) {
	r := seedReq(img("http://a/first.png", dto.SeedanceRoleFirstFrame))
	if err := validateSeedanceValues(r, blockrunExtensions{}, "seedance-2.0"); err != nil {
		t.Fatalf("first-only must be accepted: %v", err)
	}
	body := buildBlockrunSeedanceCreateRequest(r, blockrunExtensions{}, "bytedance/seedance-2.0")
	if body.ImageURL != "http://a/first.png" || body.LastFrameURL != "" || len(body.ReferenceImageURLs) != 0 {
		t.Fatalf("first-only mapping wrong: %+v", body)
	}
}

func TestSeedRealFaceStillExclusiveWithImages(t *testing.T) {
	r := seedReq(img("u", ""))
	err := validateSeedanceValues(r, blockrunExtensions{RealFaceAssetID: "ta_x"}, "seedance-2.0")
	if err == nil || !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("real_face + image must stay exclusive: %v", err)
	}
}
