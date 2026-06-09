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
	if !queryHas(gotQuery, "categoryIds=2%2C3%2C4%2C5%2C6%2C7%2C8%2C134") {
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
