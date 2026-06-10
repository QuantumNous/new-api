package service

import (
	"errors"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	defaultBlogCMSHost         = "https://apps.voc.ai"
	defaultBlogCategoryCMSHost = "https://blog.voc.ai/wp-admin"
	defaultBlogWordPressHost   = "https://blog.voc.ai"
	defaultBlogCMSSite         = "flatkey.ai"
	defaultBlogPageSize        = 18
	maxBlogPageSize            = 50
	blogCMSRequestTimeout      = 15 * time.Second
)

var defaultBlogCategoryIDs = []int{364, 365, 366, 367, 368, 369, 370, 371}

var htmlTagPattern = regexp.MustCompile(`<[^>]*>`)

type BlogCategory struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
}

type BlogPost struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	Cover        string `json:"cover"`
	Summary      string `json:"summary"`
	Date         string `json:"date"`
	Author       string `json:"author,omitempty"`
	CategoryID   int    `json:"categoryId,omitempty"`
	CategoryName string `json:"categoryName,omitempty"`
	CategorySlug string `json:"categorySlug,omitempty"`
	Content      string `json:"content,omitempty"`
	DetailURL    string `json:"detailUrl,omitempty"`
}

type BlogListResult struct {
	List     []BlogPost `json:"list"`
	Total    int        `json:"total"`
	PageNo   int        `json:"pageNo"`
	PageSize int        `json:"pageSize"`
}

type BlogListParams struct {
	CMSHost     string
	WPHost      string
	Site        string
	CategoryIDs []int
	PageNo      int
	PageSize    int
	Search      string
	Client      *http.Client
}

type BlogPostParams struct {
	CMSHost     string
	WPHost      string
	Site        string
	CategoryIDs []int
	Slug        string
	Client      *http.Client
}

type BlogCategoryParams struct {
	CMSHost string
	Site    string
	Client  *http.Client
}

type blogCMSListResponse struct {
	Code int `json:"code"`
	Data struct {
		Total    int              `json:"total"`
		List     []blogCMSRawPost `json:"list"`
		PageNo   int              `json:"pageNo"`
		PageSize int              `json:"pageSize"`
	} `json:"data"`
}

type blogCMSDetailResponse struct {
	Code int              `json:"code"`
	Data []blogCMSRawPost `json:"data"`
}

type blogCMSCategoryResponse struct {
	Code int                  `json:"code"`
	Data []blogCMSRawCategory `json:"data"`
}

type blogCMSRawPost struct {
	ID           int    `json:"ID"`
	PostTitle    string `json:"post_title"`
	Slug         string `json:"slug"`
	TwitterImage string `json:"twitter_image"`
	PostExcerpt  string `json:"post_excerpt"`
	PostContent  string `json:"post_content"`
	PostDate     string `json:"post_date"`
	AuthorName   string `json:"author_name"`
	CategoryID   int    `json:"category_id"`
	CategoryName string `json:"category_name"`
	CategorySlug string `json:"category_slug"`
	DetailURL    string `json:"detailUrl"`
}

type blogCMSRawCategory struct {
	TermID int    `json:"term_id"`
	Name   string `json:"name"`
	Slug   string `json:"slug"`
}

type blogWPRendered struct {
	Rendered string `json:"rendered"`
}

type blogWPRawPost struct {
	ID         int            `json:"id"`
	Slug       string         `json:"slug"`
	Link       string         `json:"link"`
	Date       string         `json:"date"`
	Title      blogWPRendered `json:"title"`
	Excerpt    blogWPRendered `json:"excerpt"`
	Content    blogWPRendered `json:"content"`
	Categories []int          `json:"categories"`
}

func FetchBlogList(params BlogListParams) (BlogListResult, error) {
	params = normalizeBlogListParams(params)
	endpoint, err := buildBlogCMSURL(params.CMSHost, "/n/blog/listDataV2", blogListQuery(params))
	if err != nil {
		return fetchWordPressBlogList(params)
	}

	var payload blogCMSListResponse
	if err := fetchBlogCMS(params.Client, endpoint, &payload); err != nil {
		return fetchWordPressBlogList(params)
	}
	if payload.Code != 0 && payload.Code != http.StatusOK {
		if result, err := fetchWordPressBlogList(params); err == nil {
			return result, nil
		}
		return BlogListResult{}, fmt.Errorf("blog CMS list returned code %d", payload.Code)
	}

	posts := make([]BlogPost, 0, len(payload.Data.List))
	for _, raw := range payload.Data.List {
		posts = append(posts, mapBlogCMSPost(raw))
	}
	result := BlogListResult{
		List:     posts,
		Total:    payload.Data.Total,
		PageNo:   firstPositive(payload.Data.PageNo, params.PageNo),
		PageSize: firstPositive(payload.Data.PageSize, params.PageSize),
	}
	if result.Total == 0 && len(result.List) == 0 {
		if wpResult, err := fetchWordPressBlogList(params); err == nil {
			return wpResult, nil
		}
	}
	return result, nil
}

func FetchBlogPost(params BlogPostParams) (BlogPost, error) {
	params = normalizeBlogPostParams(params)
	if params.Slug == "" {
		return BlogPost{}, errors.New("slug is required")
	}

	query := blogBaseQuery(params.Site, params.CategoryIDs)
	query.Set("slug", params.Slug)
	endpoint, err := buildBlogCMSURL(params.CMSHost, "/n/blog/detailData", query)
	if err != nil {
		return fetchWordPressBlogPost(params)
	}

	var payload blogCMSDetailResponse
	if err := fetchBlogCMS(params.Client, endpoint, &payload); err != nil {
		return fetchWordPressBlogPost(params)
	}
	if payload.Code != 0 && payload.Code != http.StatusOK {
		if post, err := fetchWordPressBlogPost(params); err == nil {
			return post, nil
		}
		return BlogPost{}, fmt.Errorf("blog CMS detail returned code %d", payload.Code)
	}
	if len(payload.Data) == 0 {
		if post, err := fetchWordPressBlogPost(params); err == nil {
			return post, nil
		}
		return BlogPost{}, errors.New("blog post not found")
	}
	post := mapBlogCMSPost(payload.Data[0])
	post.Content = payload.Data[0].PostContent
	return post, nil
}

func FetchBlogCategories(params BlogCategoryParams) ([]BlogCategory, error) {
	params = normalizeBlogCategoryParams(params)
	endpoint, err := buildBlogCMSURL(params.CMSHost, "/n/internal/blog/getCategories", blogCategoryQuery(params.Site))
	if err != nil {
		return nil, err
	}

	var payload blogCMSCategoryResponse
	if err := fetchBlogCMS(params.Client, endpoint, &payload); err != nil {
		return nil, err
	}
	if payload.Code != 0 && payload.Code != http.StatusOK {
		return nil, fmt.Errorf("blog CMS categories returned code %d", payload.Code)
	}

	categories := make([]BlogCategory, 0, len(payload.Data))
	for _, raw := range payload.Data {
		category := mapBlogCMSCategory(raw)
		if category.ID > 0 && category.Slug != "" {
			categories = append(categories, category)
		}
	}
	return categories, nil
}

func NewBlogListParams(pageNo int, pageSize int, search string, categoryIDs []int) BlogListParams {
	return normalizeBlogListParams(BlogListParams{
		PageNo:      pageNo,
		PageSize:    pageSize,
		Search:      strings.TrimSpace(search),
		CategoryIDs: categoryIDs,
	})
}

func NewBlogPostParams(slug string, categoryIDs []int) BlogPostParams {
	return normalizeBlogPostParams(BlogPostParams{
		Slug:        strings.TrimSpace(slug),
		CategoryIDs: categoryIDs,
	})
}

func NewBlogCategoryParams() BlogCategoryParams {
	return normalizeBlogCategoryParams(BlogCategoryParams{})
}

func ParseBlogCategoryIDs(value string) []int {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	ids := make([]int, 0, len(parts))
	for _, part := range parts {
		id, err := strconv.Atoi(strings.TrimSpace(part))
		if err == nil && id > 0 {
			ids = append(ids, id)
		}
	}
	return ids
}

func normalizeBlogListParams(params BlogListParams) BlogListParams {
	if params.PageNo <= 0 {
		params.PageNo = 1
	}
	if params.PageSize <= 0 {
		params.PageSize = defaultBlogPageSize
	}
	if params.PageSize > maxBlogPageSize {
		params.PageSize = maxBlogPageSize
	}
	params.CMSHost = blogCMSHost(params.CMSHost)
	params.WPHost = blogWordPressHost(params.WPHost)
	params.Site = blogCMSSite(params.Site)
	params.CategoryIDs = blogCategoryIDs(params.CategoryIDs)
	params.Search = strings.TrimSpace(params.Search)
	params.Client = blogHTTPClient(params.Client)
	return params
}

func normalizeBlogPostParams(params BlogPostParams) BlogPostParams {
	params.CMSHost = blogCMSHost(params.CMSHost)
	params.WPHost = blogWordPressHost(params.WPHost)
	params.Site = blogCMSSite(params.Site)
	params.CategoryIDs = blogCategoryIDs(params.CategoryIDs)
	params.Slug = strings.TrimSpace(params.Slug)
	params.Client = blogHTTPClient(params.Client)
	return params
}

func normalizeBlogCategoryParams(params BlogCategoryParams) BlogCategoryParams {
	params.CMSHost = blogCategoryCMSHost(params.CMSHost)
	params.Site = blogCMSSite(params.Site)
	params.Client = blogHTTPClient(params.Client)
	return params
}

func blogCMSHost(host string) string {
	if host = strings.TrimSpace(host); host != "" {
		return strings.TrimRight(host, "/")
	}
	if envHost := strings.TrimSpace(os.Getenv("BLOG_CMS_HOST")); envHost != "" {
		return strings.TrimRight(envHost, "/")
	}
	return defaultBlogCMSHost
}

func blogCategoryCMSHost(host string) string {
	if host = strings.TrimSpace(host); host != "" {
		return strings.TrimRight(host, "/")
	}
	if envHost := strings.TrimSpace(os.Getenv("BLOG_CMS_CATEGORY_HOST")); envHost != "" {
		return strings.TrimRight(envHost, "/")
	}
	return defaultBlogCategoryCMSHost
}

func blogWordPressHost(host string) string {
	if host = strings.TrimSpace(host); host != "" {
		return strings.TrimRight(host, "/")
	}
	if envHost := strings.TrimSpace(os.Getenv("BLOG_WORDPRESS_HOST")); envHost != "" {
		return strings.TrimRight(envHost, "/")
	}
	return defaultBlogWordPressHost
}

func blogCMSSite(site string) string {
	if site = strings.TrimSpace(site); site != "" {
		return site
	}
	if envSite := strings.TrimSpace(os.Getenv("BLOG_CMS_SITE")); envSite != "" {
		return envSite
	}
	return defaultBlogCMSSite
}

func blogCategoryIDs(ids []int) []int {
	if len(ids) > 0 {
		return ids
	}
	if envIDs := ParseBlogCategoryIDs(os.Getenv("BLOG_CMS_CATEGORY_IDS")); len(envIDs) > 0 {
		return envIDs
	}
	return defaultBlogCategoryIDs
}

func blogHTTPClient(client *http.Client) *http.Client {
	if client != nil {
		return client
	}
	if client = GetHttpClient(); client != nil {
		return client
	}
	return &http.Client{Timeout: blogCMSRequestTimeout}
}

func blogListQuery(params BlogListParams) url.Values {
	query := blogBaseQuery(params.Site, params.CategoryIDs)
	query.Set("pageNo", strconv.Itoa(params.PageNo))
	query.Set("pageSize", strconv.Itoa(params.PageSize))
	if params.Search != "" {
		query.Set("search", params.Search)
	}
	return query
}

func blogCategoryQuery(site string) url.Values {
	query := url.Values{}
	query.Set("site", site)
	return query
}

func blogWordPressListQuery(params BlogListParams) url.Values {
	query := url.Values{}
	query.Set("page", strconv.Itoa(params.PageNo))
	query.Set("per_page", strconv.Itoa(params.PageSize))
	query.Set("_fields", "id,slug,link,date,title,excerpt,categories")
	if len(params.CategoryIDs) > 0 {
		parts := make([]string, 0, len(params.CategoryIDs))
		for _, id := range params.CategoryIDs {
			if id > 0 {
				parts = append(parts, strconv.Itoa(id))
			}
		}
		if len(parts) > 0 {
			query.Set("categories", strings.Join(parts, ","))
		}
	}
	if params.Search != "" {
		query.Set("search", params.Search)
	}
	return query
}

func blogWordPressPostQuery(params BlogPostParams) url.Values {
	query := url.Values{}
	query.Set("slug", params.Slug)
	query.Set("per_page", "1")
	query.Set("_fields", "id,slug,link,date,title,excerpt,content,categories")
	return query
}

func blogBaseQuery(site string, categoryIDs []int) url.Values {
	query := url.Values{}
	query.Set("site", site)
	if len(categoryIDs) > 0 {
		parts := make([]string, 0, len(categoryIDs))
		for _, id := range categoryIDs {
			if id > 0 {
				parts = append(parts, strconv.Itoa(id))
			}
		}
		if len(parts) > 0 {
			query.Set("categoryIds", strings.Join(parts, ","))
		}
	}
	return query
}

func buildBlogCMSURL(host string, path string, query url.Values) (string, error) {
	parsed, err := url.Parse(host)
	if err != nil {
		return "", err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("invalid blog CMS host: %s", host)
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + path
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func fetchWordPressBlogList(params BlogListParams) (BlogListResult, error) {
	endpoint, err := buildBlogCMSURL(params.WPHost, "/wp-json/wp/v2/posts", blogWordPressListQuery(params))
	if err != nil {
		return BlogListResult{}, err
	}

	var payload []blogWPRawPost
	resp, err := fetchBlogCMSResponse(params.Client, endpoint, &payload)
	if err != nil {
		return BlogListResult{}, err
	}

	posts := make([]BlogPost, 0, len(payload))
	for _, raw := range payload {
		posts = append(posts, mapBlogWPPost(raw))
	}
	return BlogListResult{
		List:     posts,
		Total:    firstPositive(parsePositiveInt(resp.Header.Get("X-WP-Total")), len(posts)),
		PageNo:   params.PageNo,
		PageSize: params.PageSize,
	}, nil
}

func fetchWordPressBlogPost(params BlogPostParams) (BlogPost, error) {
	endpoint, err := buildBlogCMSURL(params.WPHost, "/wp-json/wp/v2/posts", blogWordPressPostQuery(params))
	if err != nil {
		return BlogPost{}, err
	}

	var payload []blogWPRawPost
	if err := fetchBlogCMS(params.Client, endpoint, &payload); err != nil {
		return BlogPost{}, err
	}
	if len(payload) == 0 {
		return BlogPost{}, errors.New("blog post not found")
	}
	return mapBlogWPPost(payload[0]), nil
}

func fetchBlogCMS(client *http.Client, endpoint string, v any) error {
	_, err := fetchBlogCMSResponse(client, endpoint, v)
	return err
}

func fetchBlogCMSResponse(client *http.Client, endpoint string, v any) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("blog CMS returned HTTP %d", resp.StatusCode)
	}
	if err := common.DecodeJson(resp.Body, v); err != nil {
		return nil, err
	}
	return resp, nil
}

func mapBlogCMSCategory(raw blogCMSRawCategory) BlogCategory {
	return BlogCategory{
		ID:   raw.TermID,
		Name: raw.Name,
		Slug: raw.Slug,
	}
}

func mapBlogWPPost(raw blogWPRawPost) BlogPost {
	categoryID := 0
	if len(raw.Categories) > 0 {
		categoryID = raw.Categories[0]
	}
	return BlogPost{
		ID:         raw.ID,
		Title:      cleanBlogHTML(raw.Title.Rendered),
		Slug:       raw.Slug,
		Summary:    cleanBlogHTML(raw.Excerpt.Rendered),
		Date:       raw.Date,
		CategoryID: categoryID,
		Content:    strings.TrimSpace(raw.Content.Rendered),
		DetailURL:  raw.Link,
	}
}

func mapBlogCMSPost(raw blogCMSRawPost) BlogPost {
	return BlogPost{
		ID:           raw.ID,
		Title:        raw.PostTitle,
		Slug:         raw.Slug,
		Cover:        raw.TwitterImage,
		Summary:      raw.PostExcerpt,
		Date:         raw.PostDate,
		Author:       raw.AuthorName,
		CategoryID:   raw.CategoryID,
		CategoryName: raw.CategoryName,
		CategorySlug: raw.CategorySlug,
		DetailURL:    raw.DetailURL,
	}
}

func cleanBlogHTML(value string) string {
	value = html.UnescapeString(value)
	value = htmlTagPattern.ReplaceAllString(value, "")
	return strings.TrimSpace(value)
}

func parsePositiveInt(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return 0
	}
	return parsed
}

func firstPositive(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}
