package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/tidwall/gjson"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testCustomOutbound() system_setting.AssetOutbound {
	return system_setting.AssetOutbound{
		Id:          "ob1",
		Format:      "myfmt",
		BaseURL:     "https://up.example.com",
		AccessKey:   "ak",
		SecretKey:   "sk",
		AccessToken: "tok",
		Region:      "cn-beijing",
		ProjectName: "proj",
		GroupType:   "AIGC",
	}
}

func TestApplyAssetTemplate(t *testing.T) {
	ob := testCustomOutbound()
	tctx := assetTemplateContext(ob, "ListAssets")

	assert.Equal(t,
		"https://up.example.com/v1/ListAssets?p=proj",
		applyAssetTemplate("{base_url}/v1/{action}?p={field:ProjectName}", tctx, []byte(`{"ProjectName":"proj"}`)),
	)
	// 缺失的 field 路径替换为空串。
	assert.Equal(t,
		"https://up.example.com/x/",
		applyAssetTemplate("{base_url}/x/{field:Missing}", tctx, []byte(`{}`)),
	)
	// 凭证占位符。
	assert.Equal(t, "tok", applyAssetTemplate("{access_token}", tctx, nil))
}

func TestResolveAssetActionTemplate(t *testing.T) {
	cf := &system_setting.AssetCustomFormat{
		AssetActionTemplate: system_setting.AssetActionTemplate{
			Method:      "POST",
			URLTemplate: "{base_url}?Action={action}",
			ResultPath:  "Result",
		},
		Actions: map[string]system_setting.AssetActionTemplate{
			"GetAsset": {Method: "GET", URLTemplate: "{base_url}/assets/{field:Id}"},
		},
	}

	// 命中覆盖：Method/URL 被覆盖，未覆盖的 ResultPath 保留默认。
	got := resolveAssetActionTemplate(cf, "GetAsset")
	assert.Equal(t, "GET", got.Method)
	assert.Equal(t, "{base_url}/assets/{field:Id}", got.URLTemplate)
	assert.Equal(t, "Result", got.ResultPath)

	// 未命中覆盖：返回默认模板。
	def := resolveAssetActionTemplate(cf, "ListAssets")
	assert.Equal(t, "POST", def.Method)
	assert.Equal(t, "{base_url}?Action={action}", def.URLTemplate)
}

func TestBuildCustomAssetRequest_Mapping(t *testing.T) {
	ob := testCustomOutbound()
	cf := &system_setting.AssetCustomFormat{
		Auth: system_setting.AssetAuthSpec{Type: "header", Name: "X-Token", Value: "{access_token}"},
	}
	tmpl := system_setting.AssetActionTemplate{
		URLTemplate: "{base_url}/v1/{action}",
		RequestMapping: []system_setting.AssetFieldMap{
			{From: "PageSize", To: "page_size"},
			{From: "Filter.GroupIds", To: "group_ids"},
		},
		RequestStatic: map[string]string{"project": "{project_name}"},
	}
	canonical := []byte(`{"PageSize":10,"Filter":{"GroupIds":["g1","g2"]}}`)

	method, url, headers, body, err := buildCustomAssetRequest(ob, cf, tmpl, "ListAssets", canonical)
	require.NoError(t, err)
	assert.Equal(t, "POST", method)
	assert.Equal(t, "https://up.example.com/v1/ListAssets", url)
	assert.Equal(t, "tok", headers["X-Token"])
	assert.Equal(t, int64(10), gjson.GetBytes(body, "page_size").Int())
	assert.Equal(t, "g1", gjson.GetBytes(body, "group_ids.0").String())
	assert.Equal(t, "g2", gjson.GetBytes(body, "group_ids.1").String())
	assert.Equal(t, "proj", gjson.GetBytes(body, "project").String())
}

func TestBuildCustomAssetRequest_Passthrough(t *testing.T) {
	ob := testCustomOutbound()
	cf := &system_setting.AssetCustomFormat{}
	tmpl := system_setting.AssetActionTemplate{RequestPassthrough: true}
	canonical := []byte(`{"a":1,"b":"x"}`)

	_, _, _, body, err := buildCustomAssetRequest(ob, cf, tmpl, "ListAssets", canonical)
	require.NoError(t, err)
	assert.JSONEq(t, `{"a":1,"b":"x"}`, string(body))
}

func TestBuildCustomAssetRequest_Auth(t *testing.T) {
	ob := testCustomOutbound()
	tmpl := system_setting.AssetActionTemplate{URLTemplate: "{base_url}?Action={action}"}

	// query 鉴权追加到 URL。
	cfQuery := &system_setting.AssetCustomFormat{Auth: system_setting.AssetAuthSpec{Type: "query", Name: "token", Value: "{access_token}"}}
	_, url, _, _, err := buildCustomAssetRequest(ob, cfQuery, tmpl, "ListAssets", nil)
	require.NoError(t, err)
	assert.Contains(t, url, "&token=tok")

	// bearer 鉴权写入 Authorization 头。
	cfBearer := &system_setting.AssetCustomFormat{Auth: system_setting.AssetAuthSpec{Type: "bearer", Value: "{access_token}"}}
	_, _, headers, _, err := buildCustomAssetRequest(ob, cfBearer, tmpl, "ListAssets", nil)
	require.NoError(t, err)
	assert.Equal(t, "Bearer tok", headers["Authorization"])
}

func TestParseCustomAssetResponse_Error(t *testing.T) {
	tmpl := system_setting.AssetActionTemplate{
		ErrorCodePath:    "error.code",
		ErrorMessagePath: "error.message",
	}
	result, apiErr, _, err := parseCustomAssetResponse(tmpl, []byte(`{"error":{"code":"E1","message":"bad"}}`), 400)
	require.NoError(t, err)
	require.Nil(t, result)
	require.NotNil(t, apiErr)
	assert.Equal(t, "E1", apiErr.Code)
	assert.Equal(t, "bad", apiErr.Message)
}

func TestParseCustomAssetResponse_ResultPathNoMapping(t *testing.T) {
	tmpl := system_setting.AssetActionTemplate{ResultPath: "data"}
	result, apiErr, status, err := parseCustomAssetResponse(tmpl, []byte(`{"data":{"Id":"a1"}}`), 200)
	require.NoError(t, err)
	require.Nil(t, apiErr)
	assert.Equal(t, 200, status)
	assert.JSONEq(t, `{"Id":"a1"}`, string(result))
}

func TestParseCustomAssetResponse_ScalarMapping(t *testing.T) {
	tmpl := system_setting.AssetActionTemplate{
		ResultPath: "data",
		ResponseMapping: []system_setting.AssetFieldMap{
			{From: "id", To: "Id"},
			{From: "url", To: "URL"},
		},
	}
	result, _, _, err := parseCustomAssetResponse(tmpl, []byte(`{"data":{"id":"a1","url":"http://x"}}`), 200)
	require.NoError(t, err)
	assert.Equal(t, "a1", gjson.GetBytes(result, "Id").String())
	assert.Equal(t, "http://x", gjson.GetBytes(result, "URL").String())
}

func TestParseCustomAssetResponse_ListMapping(t *testing.T) {
	tmpl := system_setting.AssetActionTemplate{
		ResultPath:      "data",
		ItemsPath:       "list",
		ItemMapping:     []system_setting.AssetFieldMap{{From: "id", To: "Id"}, {From: "name", To: "Name"}},
		ResponseMapping: []system_setting.AssetFieldMap{{From: "total", To: "TotalCount"}},
	}
	resp := []byte(`{"data":{"total":2,"list":[{"id":"a1","name":"n1"},{"id":"a2","name":"n2"}]}}`)
	result, _, _, err := parseCustomAssetResponse(tmpl, resp, 200)
	require.NoError(t, err)
	assert.Equal(t, int64(2), gjson.GetBytes(result, "TotalCount").Int())
	assert.Equal(t, "a1", gjson.GetBytes(result, "Items.0.Id").String())
	assert.Equal(t, "n1", gjson.GetBytes(result, "Items.0.Name").String())
	assert.Equal(t, "a2", gjson.GetBytes(result, "Items.1.Id").String())
}
