package tests_test

import (
	"reflect"
	"sort"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

type Blog struct {
	ID         uint   `gorm:"primary_key"`
	Locale     string `gorm:"primary_key"`
	Subject    string
	Body       string
	Tags       []Tag `gorm:"many2many:blog_tags;"`
	SharedTags []Tag `gorm:"many2many:shared_blog_tags;ForeignKey:id;References:id"`
	LocaleTags []Tag `gorm:"many2many:locale_blog_tags;ForeignKey:id,locale;References:id"`
}

type Tag struct {
	ID     uint   `gorm:"primary_key"`
	Locale string `gorm:"primary_key"`
	Value  string
	Blogs  []*Blog `gorm:"many2many:blog_tags"`
}

func compareTags(tags []Tag, contents []string) bool {
	var tagContents []string
	for _, tag := range tags {
		tagContents = append(tagContents, tag.Value)
	}
	sort.Strings(tagContents)
	sort.Strings(contents)
	return reflect.DeepEqual(tagContents, contents)
}

func TestManyToManyWithMultiPrimaryKeys(t *testing.T) {
	if name := DB.Dialector.Name(); name == "sqlite" || name == "sqlserver" {
		t.Skip("skip sqlite, sqlserver due to it doesn't support multiple primary keys with auto increment")
	}

	if name := DB.Dialector.Name(); name == "postgres" {
		stmt := gorm.Statement{DB: DB}
		stmt.Parse(&Blog{})
		stmt.Schema.LookUpField("ID").Unique = true
		stmt.Parse(&Tag{})
		stmt.Schema.LookUpField("ID").Unique = true
		// postgers only allow unique constraint matching given keys
	}

	DB.Migrator().DropTable(&Blog{}, &Tag{}, "blog_tags", "locale_blog_tags", "shared_blog_tags")
	if err := DB.AutoMigrate(&Blog{}, &Tag{}); err != nil {
		t.Fatalf("Failed to auto migrate, got error: %v", err)
	}

	blog := Blog{
		Locale:  "ZH",
		Subject: "subject",
		Body:    "body",
		Tags: []Tag{
			{Locale: "ZH", Value: "tag1"},
			{Locale: "ZH", Value: "tag2"},
		},
	}

	DB.Save(&blog)
	if !compareTags(blog.Tags, []string{"tag1", "tag2"}) {
		t.Fatalf("Blog should has two tags")
	}

	// Append
	tag3 := &Tag{Locale: "ZH", Value: "tag3"}
	DB.Model(&blog).Association("Tags").Append([]*Tag{tag3})

	if !compareTags(blog.Tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Blog should has three tags after Append")
	}

	if count := DB.Model(&blog).Association("Tags").Count(); count != 3 {
		t.Fatalf("Blog should has 3 tags after Append, got %v", count)
	}

	var tags []Tag
	DB.Model(&blog).Association("Tags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Should find 3 tags")
	}

	var blog1 Blog
	DB.Preload("Tags").Find(&blog1)
	if !compareTags(blog1.Tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Preload many2many relations")
	}

	// Replace
	tag5 := &Tag{Locale: "ZH", Value: "tag5"}
	tag6 := &Tag{Locale: "ZH", Value: "tag6"}
	DB.Model(&blog).Association("Tags").Replace(tag5, tag6)
	var tags2 []Tag
	DB.Model(&blog).Association("Tags").Find(&tags2)
	if !compareTags(tags2, []string{"tag5", "tag6"}) {
		t.Fatalf("Should find 2 tags after Replace")
	}

	if DB.Model(&blog).Association("Tags").Count() != 2 {
		t.Fatalf("Blog should has three tags after Replace")
	}

	// Delete
	DB.Model(&blog).Association("Tags").Delete(tag5)
	var tags3 []Tag
	DB.Model(&blog).Association("Tags").Find(&tags3)
	if !compareTags(tags3, []string{"tag6"}) {
		t.Fatalf("Should find 1 tags after Delete")
	}

	if DB.Model(&blog).Association("Tags").Count() != 1 {
		t.Fatalf("Blog should has three tags after Delete")
	}

	DB.Model(&blog).Association("Tags").Delete(tag3)
	var tags4 []Tag
	DB.Model(&blog).Association("Tags").Find(&tags4)
	if !compareTags(tags4, []string{"tag6"}) {
		t.Fatalf("Tag should not be deleted when Delete with a unrelated tag")
	}

	// Clear
	DB.Model(&blog).Association("Tags").Clear()
	if DB.Model(&blog).Association("Tags").Count() != 0 {
		t.Fatalf("All tags should be cleared")
	}
}

func TestManyToManyWithCustomizedForeignKeys(t *testing.T) {
	if name := DB.Dialector.Name(); name == "sqlite" || name == "sqlserver" {
		t.Skip("skip sqlite, sqlserver due to it doesn't support multiple primary keys with auto increment")
	}

	if name := DB.Dialector.Name(); name == "postgres" {
		t.Skip("skip postgres due to it only allow unique constraint matching given keys")
	}

	DB.Migrator().DropTable(&Blog{}, &Tag{}, "blog_tags", "locale_blog_tags", "shared_blog_tags")
	if err := DB.AutoMigrate(&Blog{}, &Tag{}); err != nil {
		t.Fatalf("Failed to auto migrate, got error: %v", err)
	}

	blog := Blog{
		Locale:  "ZH",
		Subject: "subject",
		Body:    "body",
		SharedTags: []Tag{
			{Locale: "ZH", Value: "tag1"},
			{Locale: "ZH", Value: "tag2"},
		},
	}
	DB.Save(&blog)

	blog2 := Blog{
		ID:     blog.ID,
		Locale: "EN",
	}
	DB.Create(&blog2)

	if !compareTags(blog.SharedTags, []string{"tag1", "tag2"}) {
		t.Fatalf("Blog should has two tags")
	}

	// Append
	tag3 := &Tag{Locale: "ZH", Value: "tag3"}
	DB.Model(&blog).Association("SharedTags").Append([]*Tag{tag3})
	if !compareTags(blog.SharedTags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Blog should has three tags after Append")
	}

	if DB.Model(&blog).Association("SharedTags").Count() != 3 {
		t.Fatalf("Blog should has three tags after Append")
	}

	if DB.Model(&blog2).Association("SharedTags").Count() != 3 {
		t.Fatalf("Blog should has three tags after Append")
	}

	var tags []Tag
	DB.Model(&blog).Association("SharedTags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Should find 3 tags")
	}

	DB.Model(&blog2).Association("SharedTags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Should find 3 tags")
	}

	var blog1 Blog
	DB.Preload("SharedTags").Find(&blog1)
	if !compareTags(blog1.SharedTags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Preload many2many relations")
	}

	tag4 := &Tag{Locale: "ZH", Value: "tag4"}
	DB.Model(&blog2).Association("SharedTags").Append(tag4)

	DB.Model(&blog).Association("SharedTags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3", "tag4"}) {
		t.Fatalf("Should find 3 tags")
	}

	DB.Model(&blog2).Association("SharedTags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3", "tag4"}) {
		t.Fatalf("Should find 3 tags")
	}

	// Replace
	tag5 := &Tag{Locale: "ZH", Value: "tag5"}
	tag6 := &Tag{Locale: "ZH", Value: "tag6"}
	DB.Model(&blog2).Association("SharedTags").Replace(tag5, tag6)
	var tags2 []Tag
	DB.Model(&blog).Association("SharedTags").Find(&tags2)
	if !compareTags(tags2, []string{"tag5", "tag6"}) {
		t.Fatalf("Should find 2 tags after Replace")
	}

	DB.Model(&blog2).Association("SharedTags").Find(&tags2)
	if !compareTags(tags2, []string{"tag5", "tag6"}) {
		t.Fatalf("Should find 2 tags after Replace")
	}

	if DB.Model(&blog).Association("SharedTags").Count() != 2 {
		t.Fatalf("Blog should has three tags after Replace")
	}

	// Delete
	DB.Model(&blog).Association("SharedTags").Delete(tag5)
	var tags3 []Tag
	DB.Model(&blog).Association("SharedTags").Find(&tags3)
	if !compareTags(tags3, []string{"tag6"}) {
		t.Fatalf("Should find 1 tags after Delete")
	}

	if DB.Model(&blog).Association("SharedTags").Count() != 1 {
		t.Fatalf("Blog should has three tags after Delete")
	}

	DB.Model(&blog2).Association("SharedTags").Delete(tag3)
	var tags4 []Tag
	DB.Model(&blog).Association("SharedTags").Find(&tags4)
	if !compareTags(tags4, []string{"tag6"}) {
		t.Fatalf("Tag should not be deleted when Delete with a unrelated tag")
	}

	// Clear
	DB.Model(&blog2).Association("SharedTags").Clear()
	if DB.Model(&blog).Association("SharedTags").Count() != 0 {
		t.Fatalf("All tags should be cleared")
	}
}

func TestManyToManyWithCustomizedForeignKeys2(t *testing.T) {
	if name := DB.Dialector.Name(); name == "sqlite" || name == "sqlserver" {
		t.Skip("skip sqlite, sqlserver due to it doesn't support multiple primary keys with auto increment")
	}

	if name := DB.Dialector.Name(); name == "postgres" {
		t.Skip("skip postgres due to it only allow unique constraint matching given keys")
	}

	DB.Migrator().DropTable(&Blog{}, &Tag{}, "blog_tags", "locale_blog_tags", "shared_blog_tags")
	if err := DB.AutoMigrate(&Blog{}, &Tag{}); err != nil {
		t.Fatalf("Failed to auto migrate, got error: %v", err)
	}

	blog := Blog{
		Locale:  "ZH",
		Subject: "subject",
		Body:    "body",
		LocaleTags: []Tag{
			{Locale: "ZH", Value: "tag1"},
			{Locale: "ZH", Value: "tag2"},
		},
	}
	DB.Save(&blog)

	blog2 := Blog{
		ID:     blog.ID,
		Locale: "EN",
	}
	DB.Create(&blog2)

	// Append
	tag3 := &Tag{Locale: "ZH", Value: "tag3"}
	DB.Model(&blog).Association("LocaleTags").Append([]*Tag{tag3})
	if !compareTags(blog.LocaleTags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Blog should has three tags after Append")
	}

	if DB.Model(&blog).Association("LocaleTags").Count() != 3 {
		t.Fatalf("Blog should has three tags after Append")
	}

	if DB.Model(&blog2).Association("LocaleTags").Count() != 0 {
		t.Fatalf("EN Blog should has 0 tags after ZH Blog Append")
	}

	var tags []Tag
	DB.Model(&blog).Association("LocaleTags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Should find 3 tags")
	}

	DB.Model(&blog2).Association("LocaleTags").Find(&tags)
	if len(tags) != 0 {
		t.Fatalf("Should find 0 tags for EN Blog")
	}

	var blog1 Blog
	DB.Preload("LocaleTags").Find(&blog1, "locale = ? AND id = ?", "ZH", blog.ID)
	if !compareTags(blog1.LocaleTags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Preload many2many relations")
	}

	tag4 := &Tag{Locale: "ZH", Value: "tag4"}
	DB.Model(&blog2).Association("LocaleTags").Append(tag4)

	DB.Model(&blog).Association("LocaleTags").Find(&tags)
	if !compareTags(tags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("Should find 3 tags for EN Blog")
	}

	DB.Model(&blog2).Association("LocaleTags").Find(&tags)
	if !compareTags(tags, []string{"tag4"}) {
		t.Fatalf("Should find 1 tags  for EN Blog")
	}

	// Replace
	tag5 := &Tag{Locale: "ZH", Value: "tag5"}
	tag6 := &Tag{Locale: "ZH", Value: "tag6"}
	DB.Model(&blog2).Association("LocaleTags").Replace(tag5, tag6)

	var tags2 []Tag
	DB.Model(&blog).Association("LocaleTags").Find(&tags2)
	if !compareTags(tags2, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("CN Blog's tags should not be changed after EN Blog Replace")
	}

	var blog11 Blog
	DB.Preload("LocaleTags").First(&blog11, "id = ? AND locale = ?", blog.ID, blog.Locale)
	if !compareTags(blog11.LocaleTags, []string{"tag1", "tag2", "tag3"}) {
		t.Fatalf("CN Blog's tags should not be changed after EN Blog Replace")
	}

	DB.Model(&blog2).Association("LocaleTags").Find(&tags2)
	if !compareTags(tags2, []string{"tag5", "tag6"}) {
		t.Fatalf("Should find 2 tags after Replace")
	}

	var blog21 Blog
	DB.Preload("LocaleTags").First(&blog21, "id = ? AND locale = ?", blog2.ID, blog2.Locale)
	if !compareTags(blog21.LocaleTags, []string{"tag5", "tag6"}) {
		t.Fatalf("EN Blog's tags should be changed after Replace")
	}

	if DB.Model(&blog).Association("LocaleTags").Count() != 3 {
		t.Fatalf("ZH Blog should has three tags after Replace")
	}

	if DB.Model(&blog2).Association("LocaleTags").Count() != 2 {
		t.Fatalf("EN Blog should has two tags after Replace")
	}

	// Delete
	DB.Model(&blog).Association("LocaleTags").Delete(tag5)

	if DB.Model(&blog).Association("LocaleTags").Count() != 3 {
		t.Fatalf("ZH Blog should has three tags after Delete with EN's tag")
	}

	if DB.Model(&blog2).Association("LocaleTags").Count() != 2 {
		t.Fatalf("EN Blog should has two tags after ZH Blog Delete with EN's tag")
	}

	DB.Model(&blog2).Association("LocaleTags").Delete(tag5)

	if DB.Model(&blog).Association("LocaleTags").Count() != 3 {
		t.Fatalf("ZH Blog should has three tags after EN Blog Delete with EN's tag")
	}

	if DB.Model(&blog2).Association("LocaleTags").Count() != 1 {
		t.Fatalf("EN Blog should has 1 tags after EN Blog Delete with EN's tag")
	}

	// Clear
	DB.Model(&blog2).Association("LocaleTags").Clear()
	if DB.Model(&blog).Association("LocaleTags").Count() != 3 {
		t.Fatalf("ZH Blog's tags should not be cleared when clear EN Blog's tags")
	}

	if DB.Model(&blog2).Association("LocaleTags").Count() != 0 {
		t.Fatalf("EN Blog's tags should be cleared when clear EN Blog's tags")
	}

	DB.Model(&blog).Association("LocaleTags").Clear()
	if DB.Model(&blog).Association("LocaleTags").Count() != 0 {
		t.Fatalf("ZH Blog's tags should be cleared when clear ZH Blog's tags")
	}

	if DB.Model(&blog2).Association("LocaleTags").Count() != 0 {
		t.Fatalf("EN Blog's tags should be cleared")
	}
}

func TestCompositePrimaryKeysAssociations(t *testing.T) {
	type Label struct {
		BookID *uint  `gorm:"primarykey"`
		Name   string `gorm:"primarykey"`
		Value  string
	}

	type Book struct {
		ID     int
		Name   string
		Labels []Label
	}

	DB.Migrator().DropTable(&Label{}, &Book{})
	if err := DB.AutoMigrate(&Label{}, &Book{}); err != nil {
		t.Fatalf("failed to migrate, got %v", err)
	}

	book := Book{
		Name: "my book",
		Labels: []Label{
			{Name: "region", Value: "emea"},
		},
	}

	DB.Create(&book)

	var result Book
	if err := DB.Preload("Labels").First(&result, book.ID).Error; err != nil {
		t.Fatalf("failed to preload, got error %v", err)
	}

	AssertEqual(t, book, result)
}
