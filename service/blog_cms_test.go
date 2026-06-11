package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchBlogListUsesDefaultsAndMapsCMSFields(t *testing.T) {
	var gotQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		if r.URL.Path != "/n/blog/listDataV2" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": {
				"total": 1,
				"pageNo": 1,
				"pageSize": 18,
				"list": [{
					"ID": 34183,
					"post_title": "Social Listening vs Review Monitoring",
					"slug": "social-listening-vs-review-monitoring",
					"twitter_image": "https://cdn.example.com/cover.jpg",
					"post_excerpt": "A practical comparison.",
					"post_date": "2026-05-29T01:36:46.000Z",
					"author_name": "Big Y",
					"category_id": 6,
					"category_name": "Voice of Customer",
					"category_slug": "voice-of-customer"
				}]
			}
		}`))
	}))
	defer server.Close()

	client := server.Client()
	result, err := FetchBlogList(BlogListParams{
		CMSHost: server.URL,
		Client:  client,
	})
	if err != nil {
		t.Fatalf("FetchBlogList returned error: %v", err)
	}
	if gotQuery == "" {
		t.Fatal("expected query to be recorded")
	}
	if result.Total != 1 || len(result.List) != 1 {
		t.Fatalf("unexpected result shape: total=%d len=%d", result.Total, len(result.List))
	}
	post := result.List[0]
	if post.ID != 34183 || post.Title != "Social Listening vs Review Monitoring" {
		t.Fatalf("unexpected mapped post: %+v", post)
	}
	if post.Cover != "https://cdn.example.com/cover.jpg" || post.CategorySlug != "voice-of-customer" {
		t.Fatalf("unexpected mapped media/category fields: %+v", post)
	}
	if !queryHas(gotQuery, "site=flatkey.ai") {
		t.Fatalf("expected default site flatkey.ai in query, got %s", gotQuery)
	}
	if !queryHas(gotQuery, "pageNo=1") || !queryHas(gotQuery, "pageSize=18") {
		t.Fatalf("expected default pagination in query, got %s", gotQuery)
	}
	if !queryHas(gotQuery, "categoryIds=364%2C365%2C366%2C367%2C368%2C369%2C370%2C371") {
		t.Fatalf("expected default category ids in query, got %s", gotQuery)
	}
}

func TestFetchBlogPostMapsContent(t *testing.T) {
	var gotQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		if r.URL.Path != "/n/blog/detailData" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": [{
				"ID": 34183,
				"post_title": "Social Listening vs Review Monitoring",
				"slug": "social-listening-vs-review-monitoring",
				"post_excerpt": "A practical comparison.",
				"post_content": "<h2>TL;DR</h2><p>Use both workflows.</p>",
				"post_date": "2026-05-29T01:36:46.000Z",
				"author_name": "Big Y",
				"category_id": 6,
				"category_name": "Voice of Customer",
				"category_slug": "voice-of-customer"
			}]
		}`))
	}))
	defer server.Close()

	post, err := FetchBlogPost(BlogPostParams{
		CMSHost: server.URL,
		Client:  server.Client(),
		Slug:    "social-listening-vs-review-monitoring",
	})
	if err != nil {
		t.Fatalf("FetchBlogPost returned error: %v", err)
	}
	if post.Content != "<h2>TL;DR</h2><p>Use both workflows.</p>" {
		t.Fatalf("unexpected content: %q", post.Content)
	}
	if !queryHas(gotQuery, "slug=social-listening-vs-review-monitoring") {
		t.Fatalf("expected slug in query, got %s", gotQuery)
	}
	if !queryHas(gotQuery, "site=flatkey.ai") {
		t.Fatalf("expected default site flatkey.ai in query, got %s", gotQuery)
	}
}

func TestFetchBlogPostPrefersMetaDescriptionForSummary(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/n/blog/detailData" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": [{
				"ID": 34204,
				"post_title": "OpenAI-Compatible API Migration",
				"slug": "openai-compatible-api-migration",
				"post_excerpt": "If your app already uses an OpenAI compatible API, moving to Flatkey should not start with a rewrite.",
				"post_content": "<h2>Quick Answer</h2><p>Change the base URL.</p>",
				"meta": {
					"desc": "Move an OpenAI-compatible app to Flatkey: change the base URL, map model IDs, run smoke tests, verify logs, quotas, billing, and rollback."
				}
			}]
		}`))
	}))
	defer server.Close()

	post, err := FetchBlogPost(BlogPostParams{
		CMSHost: server.URL,
		Client:  server.Client(),
		Slug:    "openai-compatible-api-migration",
	})
	if err != nil {
		t.Fatalf("FetchBlogPost returned error: %v", err)
	}

	want := "Move an OpenAI-compatible app to Flatkey: change the base URL, map model IDs, run smoke tests, verify logs, quotas, billing, and rollback."
	if post.Summary != want {
		t.Fatalf("expected meta description summary %q, got %q", want, post.Summary)
	}
}

func TestFetchBlogPostKeepsRequestedSlugWhenCMSDetailSlugIsEmpty(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/n/blog/detailData" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": [{
				"ID": 34198,
				"post_title": "Seedance 2.0 API Access",
				"slug": "",
				"post_excerpt": "Seedance access guide.",
				"post_content": "<p>Use one API key.</p>",
				"post_date": "2026-06-10T16:02:49.000Z",
				"author_name": "Big Y"
			}]
		}`))
	}))
	defer server.Close()

	post, err := FetchBlogPost(BlogPostParams{
		CMSHost: server.URL,
		Client:  server.Client(),
		Slug:    "seedance-api-access",
	})
	if err != nil {
		t.Fatalf("FetchBlogPost returned error: %v", err)
	}
	if post.Slug != "seedance-api-access" {
		t.Fatalf("expected requested slug to be preserved, got %q", post.Slug)
	}
}

func TestFetchBlogListFallsBackToWordPressPosts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/n/blog/listDataV2" {
			_, _ = w.Write([]byte(`{"code":200,"data":{"total":0,"pageNo":1,"pageSize":18,"list":[]}}`))
			return
		}
		if r.URL.Path != "/wp-json/wp/v2/posts" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("categories"); got != "364" {
			t.Fatalf("expected categories=364, got %q", got)
		}
		w.Header().Set("X-WP-Total", "1")
		_, _ = w.Write([]byte(`[{
			"id": 4001,
			"slug": "gateway-guide",
			"date": "2026-06-09T10:00:00",
			"link": "https://blog.voc.ai/gateway-guide/",
			"title": {"rendered": "Gateway Guide"},
			"excerpt": {"rendered": "<p>Pick the right gateway.</p>"},
			"categories": [364]
		}]`))
	}))
	defer server.Close()

	result, err := FetchBlogList(BlogListParams{
		CMSHost:     server.URL,
		WPHost:      server.URL,
		CategoryIDs: []int{364},
		Client:      server.Client(),
	})
	if err != nil {
		t.Fatalf("FetchBlogList returned error: %v", err)
	}
	if result.Total != 1 || len(result.List) != 1 {
		t.Fatalf("unexpected result shape: total=%d len=%d", result.Total, len(result.List))
	}
	post := result.List[0]
	if post.ID != 4001 || post.Title != "Gateway Guide" || post.Summary != "Pick the right gateway." {
		t.Fatalf("unexpected WP post mapping: %+v", post)
	}
	if post.CategoryID != 364 || post.DetailURL != "https://blog.voc.ai/gateway-guide/" {
		t.Fatalf("unexpected WP category/detail mapping: %+v", post)
	}
}

func TestFetchBlogPostFallsBackToWordPressPost(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/n/blog/detailData" {
			_, _ = w.Write([]byte(`{"code":200,"data":[]}`))
			return
		}
		if r.URL.Path != "/wp-json/wp/v2/posts" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("slug"); got != "gateway-guide" {
			t.Fatalf("expected slug=gateway-guide, got %q", got)
		}
		_, _ = w.Write([]byte(`[{
			"id": 4001,
			"slug": "gateway-guide",
			"date": "2026-06-09T10:00:00",
			"title": {"rendered": "Gateway Guide"},
			"excerpt": {"rendered": "<p>Pick the right gateway.</p>"},
			"content": {"rendered": "<h2>Guide</h2><p>Use routing.</p>"},
			"categories": [364]
		}]`))
	}))
	defer server.Close()

	post, err := FetchBlogPost(BlogPostParams{
		CMSHost: server.URL,
		WPHost:  server.URL,
		Slug:    "gateway-guide",
		Client:  server.Client(),
	})
	if err != nil {
		t.Fatalf("FetchBlogPost returned error: %v", err)
	}
	if post.Title != "Gateway Guide" || post.Content != "<h2>Guide</h2><p>Use routing.</p>" {
		t.Fatalf("unexpected WP post: %+v", post)
	}
}

func TestFetchBlogCategoriesMapsCMSFields(t *testing.T) {
	var gotQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		if r.URL.Path != "/n/internal/blog/getCategories" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 200,
			"data": [{
				"site": "flatkey.ai",
				"term_id": 364,
				"name": "Gateway Comparisons",
				"slug": "gateway-comparisons",
				"children": []
			}]
		}`))
	}))
	defer server.Close()

	categories, err := FetchBlogCategories(BlogCategoryParams{
		CMSHost: server.URL,
		Client:  server.Client(),
	})
	if err != nil {
		t.Fatalf("FetchBlogCategories returned error: %v", err)
	}
	if len(categories) != 1 {
		t.Fatalf("unexpected category count: %d", len(categories))
	}
	category := categories[0]
	if category.ID != 364 || category.Name != "Gateway Comparisons" || category.Slug != "gateway-comparisons" {
		t.Fatalf("unexpected mapped category: %+v", category)
	}
	if !queryHas(gotQuery, "site=flatkey.ai") {
		t.Fatalf("expected default site flatkey.ai in query, got %s", gotQuery)
	}
}

func queryHas(rawQuery string, expected string) bool {
	for _, part := range splitQuery(rawQuery) {
		if part == expected {
			return true
		}
	}
	return false
}

func splitQuery(rawQuery string) []string {
	if rawQuery == "" {
		return nil
	}
	var parts []string
	start := 0
	for i := 0; i < len(rawQuery); i++ {
		if rawQuery[i] == '&' {
			parts = append(parts, rawQuery[start:i])
			start = i + 1
		}
	}
	return append(parts, rawQuery[start:])
}
