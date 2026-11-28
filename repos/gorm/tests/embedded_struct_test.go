package tests_test

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestEmbeddedStruct(t *testing.T) {
	type ReadOnly struct {
		ReadOnly *bool
	}

	type BasePost struct {
		Id    int64
		Title string
		URL   string
		ReadOnly
	}

	type Author struct {
		ID    string
		Name  string
		Email string
	}

	type HNPost struct {
		BasePost
		Author  `gorm:"EmbeddedPrefix:user_"` // Embedded struct
		Upvotes int32
	}

	type EngadgetPost struct {
		BasePost BasePost `gorm:"Embedded"`
		Author   *Author  `gorm:"Embedded;EmbeddedPrefix:author_"` // Embedded struct
		ImageUrl string
	}

	DB.Migrator().DropTable(&HNPost{}, &EngadgetPost{})
	if err := DB.Migrator().AutoMigrate(&HNPost{}, &EngadgetPost{}); err != nil {
		t.Fatalf("failed to auto migrate, got error: %v", err)
	}

	for _, name := range []string{"author_id", "author_name", "author_email"} {
		if !DB.Migrator().HasColumn(&EngadgetPost{}, name) {
			t.Errorf("should has prefixed column %v", name)
		}
	}

	stmt := gorm.Statement{DB: DB}
	if err := stmt.Parse(&EngadgetPost{}); err != nil {
		t.Fatalf("failed to parse embedded struct")
	} else if len(stmt.Schema.PrimaryFields) != 1 {
		t.Errorf("should have only one primary field with embedded struct, but got %v", len(stmt.Schema.PrimaryFields))
	}

	for _, name := range []string{"user_id", "user_name", "user_email"} {
		if !DB.Migrator().HasColumn(&HNPost{}, name) {
			t.Errorf("should has prefixed column %v", name)
		}
	}

	// save embedded struct
	DB.Save(&HNPost{BasePost: BasePost{Title: "news"}})
	DB.Save(&HNPost{BasePost: BasePost{Title: "hn_news"}})
	var news HNPost
	if err := DB.First(&news, "title = ?", "hn_news").Error; err != nil {
		t.Errorf("no error should happen when query with embedded struct, but got %v", err)
	} else if news.Title != "hn_news" {
		t.Errorf("embedded struct's value should be scanned correctly")
	}

	DB.Save(&EngadgetPost{BasePost: BasePost{Title: "engadget_news"}, Author: &Author{Name: "Edward"}})
	DB.Save(&EngadgetPost{BasePost: BasePost{Title: "engadget_article"}, Author: &Author{Name: "George"}})
	var egNews EngadgetPost
	if err := DB.First(&egNews, "title = ?", "engadget_news").Error; err != nil {
		t.Errorf("no error should happen when query with embedded struct, but got %v", err)
	} else if egNews.BasePost.Title != "engadget_news" {
		t.Errorf("embedded struct's value should be scanned correctly")
	}

	var egPosts []EngadgetPost
	if err := DB.Order("author_name asc").Find(&egPosts).Error; err != nil {
		t.Fatalf("no error should happen when query with embedded struct, but got %v", err)
	}
	expectAuthors := []string{"Edward", "George"}
	for i, post := range egPosts {
		t.Log(i, post.Author)
		if want := expectAuthors[i]; post.Author.Name != want {
			t.Errorf("expected author %s got %s", want, post.Author.Name)
		}
	}
}

func TestEmbeddedPointerTypeStruct(t *testing.T) {
	type BasePost struct {
		Id    int64
		Title string
		URL   string
	}

	type Author struct {
		ID          string
		Name        string
		Email       string
		Age         int
		Content     Content
		ContentPtr  *Content
		Birthday    time.Time
		BirthdayPtr *time.Time
	}

	type HNPost struct {
		*BasePost
		Upvotes int32
		*Author `gorm:"EmbeddedPrefix:user_"` // Embedded struct
	}

	DB.Migrator().DropTable(&HNPost{})
	if err := DB.Migrator().AutoMigrate(&HNPost{}); err != nil {
		t.Fatalf("failed to auto migrate, got error: %v", err)
	}

	DB.Create(&HNPost{BasePost: &BasePost{Title: "embedded_pointer_type"}})

	var hnPost HNPost
	if err := DB.First(&hnPost, "title = ?", "embedded_pointer_type").Error; err != nil {
		t.Errorf("No error should happen when find embedded pointer type, but got %v", err)
	}

	if hnPost.Title != "embedded_pointer_type" {
		t.Errorf("Should find correct value for embedded pointer type")
	}

	if hnPost.Author != nil {
		t.Errorf("Expected to get back a nil Author but got: %v", hnPost.Author)
	}

	now := time.Now().Round(time.Second)
	NewPost := HNPost{
		BasePost: &BasePost{Title: "embedded_pointer_type2"},
		Author: &Author{
			Name:        "test",
			Content:     Content{"test"},
			ContentPtr:  nil,
			Birthday:    now,
			BirthdayPtr: nil,
		},
	}
	DB.Create(&NewPost)

	hnPost = HNPost{}
	if err := DB.First(&hnPost, "title = ?", NewPost.Title).Error; err != nil {
		t.Errorf("No error should happen when find embedded pointer type, but got %v", err)
	}

	if hnPost.Title != NewPost.Title {
		t.Errorf("Should find correct value for embedded pointer type")
	}

	if hnPost.Author.Name != NewPost.Author.Name {
		t.Errorf("Expected to get Author name %v but got: %v", NewPost.Author.Name, hnPost.Author.Name)
	}

	if !reflect.DeepEqual(NewPost.Author.Content, hnPost.Author.Content) {
		t.Errorf("Expected to get Author content %v but got: %v", NewPost.Author.Content, hnPost.Author.Content)
	}

	if hnPost.Author.ContentPtr != nil {
		t.Errorf("Expected to get nil Author contentPtr but got: %v", hnPost.Author.ContentPtr)
	}

	if NewPost.Author.Birthday.UnixMilli() != hnPost.Author.Birthday.UnixMilli() {
		t.Errorf("Expected to get Author birthday with %+v but got: %+v", NewPost.Author.Birthday, hnPost.Author.Birthday)
	}

	if hnPost.Author.BirthdayPtr != nil {
		t.Errorf("Expected to get nil Author birthdayPtr but got: %+v", hnPost.Author.BirthdayPtr)
	}
}

type Content struct {
	Content interface{} `gorm:"type:String"`
}

func (c Content) Value() (driver.Value, error) {
	// mssql driver with issue on handling null bytes https://github.com/denisenkom/go-mssqldb/issues/530,
	b, err := json.Marshal(c)
	return string(b[:]), err
}

func (c *Content) Scan(src interface{}) error {
	var value Content
	str, ok := src.(string)
	if !ok {
		byt, ok := src.([]byte)
		if !ok {
			return errors.New("Embedded.Scan byte assertion failed")
		}
		if err := json.Unmarshal(byt, &value); err != nil {
			return err
		}
	} else {
		if err := json.Unmarshal([]byte(str), &value); err != nil {
			return err
		}
	}

	*c = value

	return nil
}

func TestEmbeddedScanValuer(t *testing.T) {
	type HNPost struct {
		gorm.Model
		Content
	}

	DB.Migrator().DropTable(&HNPost{})
	if err := DB.Migrator().AutoMigrate(&HNPost{}); err != nil {
		t.Fatalf("failed to auto migrate, got error: %v", err)
	}

	hnPost := HNPost{Content: Content{Content: "hello world"}}

	if err := DB.Create(&hnPost).Error; err != nil {
		t.Errorf("Failed to create got error %v", err)
	}
}

func TestEmbeddedRelations(t *testing.T) {
	type AdvancedUser struct {
		User     `gorm:"embedded"`
		Advanced bool
	}

	DB.Migrator().DropTable(&AdvancedUser{})

	if err := DB.AutoMigrate(&AdvancedUser{}); err != nil {
		if DB.Dialector.Name() != "sqlite" {
			t.Errorf("Failed to auto migrate advanced user, got error %v", err)
		}
	}
}

func TestEmbeddedTagSetting(t *testing.T) {
	type Tag1 struct {
		Id int64 `gorm:"autoIncrement"`
	}
	type Tag2 struct {
		Id int64
	}

	type EmbeddedTag struct {
		Tag1 Tag1 `gorm:"Embedded;"`
		Tag2 Tag2 `gorm:"Embedded;EmbeddedPrefix:t2_"`
		Name string
	}

	DB.Migrator().DropTable(&EmbeddedTag{})
	err := DB.Migrator().AutoMigrate(&EmbeddedTag{})
	AssertEqual(t, err, nil)

	t1 := EmbeddedTag{Name: "embedded_tag"}
	err = DB.Save(&t1).Error
	AssertEqual(t, err, nil)
	if t1.Tag1.Id == 0 {
		t.Errorf("embedded struct's primary field should be rewrited")
	}
}
