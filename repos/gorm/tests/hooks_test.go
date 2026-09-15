package tests_test

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

type Product struct {
	gorm.Model
	Name                  string
	Code                  string
	Price                 float64
	AfterFindCallTimes    int64
	BeforeCreateCallTimes int64
	AfterCreateCallTimes  int64
	BeforeUpdateCallTimes int64
	AfterUpdateCallTimes  int64
	BeforeSaveCallTimes   int64
	AfterSaveCallTimes    int64
	BeforeDeleteCallTimes int64
	AfterDeleteCallTimes  int64
}

func (s *Product) BeforeCreate(tx *gorm.DB) (err error) {
	if s.Code == "Invalid" {
		err = errors.New("invalid product")
	}
	s.BeforeCreateCallTimes = s.BeforeCreateCallTimes + 1
	return
}

func (s *Product) BeforeUpdate(tx *gorm.DB) (err error) {
	if s.Code == "dont_update" {
		err = errors.New("can't update")
	}
	s.BeforeUpdateCallTimes = s.BeforeUpdateCallTimes + 1
	return
}

func (s *Product) BeforeSave(tx *gorm.DB) (err error) {
	if s.Code == "dont_save" {
		err = errors.New("can't save")
	}
	s.BeforeSaveCallTimes = s.BeforeSaveCallTimes + 1
	return
}

func (s *Product) AfterFind(tx *gorm.DB) (err error) {
	s.AfterFindCallTimes = s.AfterFindCallTimes + 1
	return
}

func (s *Product) AfterCreate(tx *gorm.DB) (err error) {
	return tx.Model(s).UpdateColumn("AfterCreateCallTimes", s.AfterCreateCallTimes+1).Error
}

func (s *Product) AfterUpdate(tx *gorm.DB) (err error) {
	s.AfterUpdateCallTimes = s.AfterUpdateCallTimes + 1
	return
}

func (s *Product) AfterSave(tx *gorm.DB) (err error) {
	if s.Code == "after_save_error" {
		err = errors.New("can't save")
	}
	s.AfterSaveCallTimes = s.AfterSaveCallTimes + 1
	return
}

func (s *Product) BeforeDelete(tx *gorm.DB) (err error) {
	if s.Code == "dont_delete" {
		err = errors.New("can't delete")
	}
	s.BeforeDeleteCallTimes = s.BeforeDeleteCallTimes + 1
	return
}

func (s *Product) AfterDelete(tx *gorm.DB) (err error) {
	if s.Code == "after_delete_error" {
		err = errors.New("can't delete")
	}
	s.AfterDeleteCallTimes = s.AfterDeleteCallTimes + 1
	return
}

func (s *Product) GetCallTimes() []int64 {
	return []int64{s.BeforeCreateCallTimes, s.BeforeSaveCallTimes, s.BeforeUpdateCallTimes, s.AfterCreateCallTimes, s.AfterSaveCallTimes, s.AfterUpdateCallTimes, s.BeforeDeleteCallTimes, s.AfterDeleteCallTimes, s.AfterFindCallTimes}
}

func TestRunCallbacks(t *testing.T) {
	DB.Migrator().DropTable(&Product{})
	DB.AutoMigrate(&Product{})

	p := Product{Code: "unique_code", Price: 100}
	DB.Save(&p)

	if !reflect.DeepEqual(p.GetCallTimes(), []int64{1, 1, 0, 1, 1, 0, 0, 0, 0}) {
		t.Fatalf("Callbacks should be invoked successfully, %v", p.GetCallTimes())
	}

	DB.Where("Code = ?", "unique_code").First(&p)
	if !reflect.DeepEqual(p.GetCallTimes(), []int64{1, 1, 0, 1, 0, 0, 0, 0, 1}) {
		t.Fatalf("After callbacks values are not saved, %v", p.GetCallTimes())
	}

	p.Price = 200
	DB.Save(&p)
	if !reflect.DeepEqual(p.GetCallTimes(), []int64{1, 2, 1, 1, 1, 1, 0, 0, 1}) {
		t.Fatalf("After update callbacks should be invoked successfully, %v", p.GetCallTimes())
	}

	var products []Product
	DB.Find(&products, "code = ?", "unique_code")
	if products[0].AfterFindCallTimes != 2 {
		t.Fatalf("AfterFind callbacks should work with slice, called %v", products[0].AfterFindCallTimes)
	}

	DB.Where("Code = ?", "unique_code").First(&p)
	if !reflect.DeepEqual(p.GetCallTimes(), []int64{1, 2, 1, 1, 0, 0, 0, 0, 2}) {
		t.Fatalf("After update callbacks values are not saved, %v", p.GetCallTimes())
	}

	DB.Delete(&p)
	if !reflect.DeepEqual(p.GetCallTimes(), []int64{1, 2, 1, 1, 0, 0, 1, 1, 2}) {
		t.Fatalf("After delete callbacks should be invoked successfully, %v", p.GetCallTimes())
	}

	if DB.Where("Code = ?", "unique_code").First(&p).Error == nil {
		t.Fatalf("Can't find a deleted record")
	}

	beforeCallTimes := p.AfterFindCallTimes
	if DB.Where("Code = ?", "unique_code").Find(&p).Error != nil {
		t.Fatalf("Find don't raise error when record not found")
	}

	if p.AfterFindCallTimes != beforeCallTimes {
		t.Fatalf("AfterFind should not be called")
	}
}

func TestCallbacksWithErrors(t *testing.T) {
	DB.Migrator().DropTable(&Product{})
	DB.AutoMigrate(&Product{})

	p := Product{Code: "Invalid", Price: 100}
	if DB.Save(&p).Error == nil {
		t.Fatalf("An error from before create callbacks happened when create with invalid value")
	}

	if DB.Where("code = ?", "Invalid").First(&Product{}).Error == nil {
		t.Fatalf("Should not save record that have errors")
	}

	if DB.Save(&Product{Code: "dont_save", Price: 100}).Error == nil {
		t.Fatalf("An error from after create callbacks happened when create with invalid value")
	}

	p2 := Product{Code: "update_callback", Price: 100}
	DB.Save(&p2)

	p2.Code = "dont_update"
	if DB.Save(&p2).Error == nil {
		t.Fatalf("An error from before update callbacks happened when update with invalid value")
	}

	if DB.Where("code = ?", "update_callback").First(&Product{}).Error != nil {
		t.Fatalf("Record Should not be updated due to errors happened in before update callback")
	}

	if DB.Where("code = ?", "dont_update").First(&Product{}).Error == nil {
		t.Fatalf("Record Should not be updated due to errors happened in before update callback")
	}

	p2.Code = "dont_save"
	if DB.Save(&p2).Error == nil {
		t.Fatalf("An error from before save callbacks happened when update with invalid value")
	}

	p3 := Product{Code: "dont_delete", Price: 100}
	DB.Save(&p3)
	if DB.Delete(&p3).Error == nil {
		t.Fatalf("An error from before delete callbacks happened when delete")
	}

	if DB.Where("Code = ?", "dont_delete").First(&p3).Error != nil {
		t.Fatalf("An error from before delete callbacks happened")
	}

	p4 := Product{Code: "after_save_error", Price: 100}
	DB.Save(&p4)
	if err := DB.First(&Product{}, "code = ?", "after_save_error").Error; err == nil {
		t.Fatalf("Record should be reverted if get an error in after save callback")
	}

	p5 := Product{Code: "after_delete_error", Price: 100}
	DB.Save(&p5)
	if err := DB.First(&Product{}, "code = ?", "after_delete_error").Error; err != nil {
		t.Fatalf("Record should be found")
	}

	DB.Delete(&p5)
	if err := DB.First(&Product{}, "code = ?", "after_delete_error").Error; err != nil {
		t.Fatalf("Record shouldn't be deleted because of an error happened in after delete callback")
	}
}

type Product2 struct {
	gorm.Model
	Name  string
	Code  string
	Price int64
	Owner string
}

func (s Product2) BeforeCreate(tx *gorm.DB) (err error) {
	if !strings.HasSuffix(s.Name, "_clone") {
		newProduft := s
		newProduft.Price *= 2
		newProduft.Name += "_clone"
		err = tx.Create(&newProduft).Error
	}

	if s.Name == "Invalid" {
		return errors.New("invalid")
	}

	return nil
}

func (s *Product2) BeforeUpdate(tx *gorm.DB) (err error) {
	tx.Statement.Where("owner != ?", "admin")
	return
}

func TestUseDBInHooks(t *testing.T) {
	DB.Migrator().DropTable(&Product2{})
	DB.AutoMigrate(&Product2{})

	product := Product2{Name: "Invalid", Price: 100}

	if err := DB.Create(&product).Error; err == nil {
		t.Fatalf("should returns error %v when creating product, but got nil", err)
	}

	product2 := Product2{Name: "Nice", Price: 100}

	if err := DB.Create(&product2).Error; err != nil {
		t.Fatalf("Failed to create product, got error: %v", err)
	}

	var result Product2
	if err := DB.First(&result, "name = ?", "Nice").Error; err != nil {
		t.Fatalf("Failed to query product, got error: %v", err)
	}

	var resultClone Product2
	if err := DB.First(&resultClone, "name = ?", "Nice_clone").Error; err != nil {
		t.Fatalf("Failed to find cloned product, got error: %v", err)
	}

	result.Price *= 2
	result.Name += "_clone"
	AssertObjEqual(t, result, resultClone, "Price", "Name")

	DB.Model(&result).Update("Price", 500)
	var result2 Product2
	DB.First(&result2, "name = ?", "Nice")

	if result2.Price != 500 {
		t.Errorf("Failed to update product's price, expects: %v, got %v", 500, result2.Price)
	}

	product3 := Product2{Name: "Nice2", Price: 600, Owner: "admin"}
	if err := DB.Create(&product3).Error; err != nil {
		t.Fatalf("Failed to create product, got error: %v", err)
	}

	var result3 Product2
	if err := DB.First(&result3, "name = ?", "Nice2").Error; err != nil {
		t.Fatalf("Failed to query product, got error: %v", err)
	}

	DB.Model(&result3).Update("Price", 800)
	var result4 Product2
	DB.First(&result4, "name = ?", "Nice2")

	if result4.Price != 600 {
		t.Errorf("Admin product's price should not be changed, expects: %v, got %v", 600, result4.Price)
	}
}

type Product3 struct {
	gorm.Model
	Name  string
	Code  string
	Price int64
	Owner string
}

func (s Product3) BeforeCreate(tx *gorm.DB) (err error) {
	tx.Statement.SetColumn("Price", s.Price+100)
	return nil
}

func (s Product3) BeforeUpdate(tx *gorm.DB) (err error) {
	if tx.Statement.Changed() {
		tx.Statement.SetColumn("Price", s.Price+10)
	}

	if tx.Statement.Changed("Code") {
		s.Price += 20
		tx.Statement.SetColumn("Price", s.Price+30)
	}
	return nil
}

func TestSetColumn(t *testing.T) {
	DB.Migrator().DropTable(&Product3{})
	DB.AutoMigrate(&Product3{})

	product := Product3{Name: "Product", Price: 0}
	DB.Create(&product)

	if product.Price != 100 {
		t.Errorf("invalid price after create, got %+v", product)
	}

	DB.Model(&product).Select("code", "price").Updates(map[string]interface{}{"code": "L1212"})

	if product.Price != 150 || product.Code != "L1212" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	// Code not changed, price should not change
	DB.Model(&product).Updates(map[string]interface{}{"Name": "Product New"})

	if product.Name != "Product New" || product.Price != 160 || product.Code != "L1212" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	// Code changed, but not selected, price should not change
	DB.Model(&product).Select("Name", "Price").Updates(map[string]interface{}{"Name": "Product New2", "code": "L1213"})

	if product.Name != "Product New2" || product.Price != 170 || product.Code != "L1212" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	// Code changed, price should changed
	DB.Model(&product).Select("Name", "Code", "Price").Updates(map[string]interface{}{"Name": "Product New3", "code": "L1213"})

	if product.Name != "Product New3" || product.Price != 220 || product.Code != "L1213" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	var result Product3
	DB.First(&result, product.ID)

	AssertEqual(t, result, product)

	// Select to change Code, but nothing updated, price should not change
	DB.Model(&product).Select("code").Updates(Product3{Name: "L1214", Code: "L1213"})

	if product.Price != 220 || product.Code != "L1213" || product.Name != "Product New3" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	DB.Model(&product).Updates(Product3{Code: "L1214"})
	if product.Price != 270 || product.Code != "L1214" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	// Code changed, price should changed
	DB.Model(&product).Select("Name", "Code", "Price").Updates(Product3{Name: "Product New4", Code: ""})
	if product.Name != "Product New4" || product.Price != 320 || product.Code != "" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	DB.Model(&product).UpdateColumns(Product3{Code: "L1215"})
	if product.Price != 320 || product.Code != "L1215" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	DB.Model(&product).Session(&gorm.Session{SkipHooks: true}).Updates(Product3{Code: "L1216"})
	if product.Price != 320 || product.Code != "L1216" {
		t.Errorf("invalid data after update, got %+v", product)
	}

	var result2 Product3
	DB.First(&result2, product.ID)

	AssertEqual(t, result2, product)

	product2 := Product3{Name: "Product", Price: 0}
	DB.Session(&gorm.Session{SkipHooks: true}).Create(&product2)

	if product2.Price != 0 {
		t.Errorf("invalid price after create without hooks, got %+v", product2)
	}
}

func TestHooksForSlice(t *testing.T) {
	DB.Migrator().DropTable(&Product3{})
	DB.AutoMigrate(&Product3{})

	products := []*Product3{
		{Name: "Product-1", Price: 100},
		{Name: "Product-2", Price: 200},
		{Name: "Product-3", Price: 300},
	}

	DB.Create(&products)

	for idx, value := range []int64{200, 300, 400} {
		if products[idx].Price != value {
			t.Errorf("invalid price for product #%v, expects: %v, got %v", idx, value, products[idx].Price)
		}
	}

	DB.Model(&products).Update("Name", "product-name")

	// will set all product's price to last product's price + 10
	for idx, value := range []int64{410, 410, 410} {
		if products[idx].Price != value {
			t.Errorf("invalid price for product #%v, expects: %v, got %v", idx, value, products[idx].Price)
		}
	}

	products2 := []Product3{
		{Name: "Product-1", Price: 100},
		{Name: "Product-2", Price: 200},
		{Name: "Product-3", Price: 300},
	}

	DB.Create(&products2)

	for idx, value := range []int64{200, 300, 400} {
		if products2[idx].Price != value {
			t.Errorf("invalid price for product #%v, expects: %v, got %v", idx, value, products2[idx].Price)
		}
	}

	DB.Model(&products2).Update("Name", "product-name")

	// will set all product's price to last product's price + 10
	for idx, value := range []int64{410, 410, 410} {
		if products2[idx].Price != value {
			t.Errorf("invalid price for product #%v, expects: %v, got %v", idx, value, products2[idx].Price)
		}
	}
}

type Product4 struct {
	gorm.Model
	Name  string
	Code  string
	Price int64
	Owner string
	Item  ProductItem
}

type ProductItem struct {
	gorm.Model
	Code               string
	Product4ID         uint
	AfterFindCallTimes int
}

func (pi ProductItem) BeforeCreate(*gorm.DB) error {
	if pi.Code == "invalid" {
		return errors.New("invalid item")
	}
	return nil
}

func (pi *ProductItem) AfterFind(*gorm.DB) error {
	pi.AfterFindCallTimes = pi.AfterFindCallTimes + 1
	return nil
}

func TestFailedToSaveAssociationShouldRollback(t *testing.T) {
	DB.Migrator().DropTable(&Product4{}, &ProductItem{})
	DB.AutoMigrate(&Product4{}, &ProductItem{})

	product := Product4{Name: "Product-1", Price: 100, Item: ProductItem{Code: "invalid"}}
	if err := DB.Create(&product).Error; err == nil {
		t.Errorf("should got failed to save, but error is nil")
	}

	if DB.First(&Product4{}, "name = ?", product.Name).Error == nil {
		t.Errorf("should got RecordNotFound, but got nil")
	}

	product = Product4{Name: "Product-2", Price: 100, Item: ProductItem{Code: "valid"}}
	if err := DB.Create(&product).Error; err != nil {
		t.Errorf("should create product, but got error %v", err)
	}

	if err := DB.First(&Product4{}, "name = ?", product.Name).Error; err != nil {
		t.Errorf("should find product, but got error %v", err)
	}

	var productWithItem Product4
	if err := DB.Session(&gorm.Session{SkipHooks: true}).Preload("Item").First(&productWithItem, "name = ?", product.Name).Error; err != nil {
		t.Errorf("should find product, but got error %v", err)
	}

	if productWithItem.Item.AfterFindCallTimes != 0 {
		t.Fatalf("AfterFind should not be called times:%d", productWithItem.Item.AfterFindCallTimes)
	}
}

type Product5 struct {
	gorm.Model
	Name string
}

var beforeUpdateCall int

func (p *Product5) BeforeUpdate(*gorm.DB) error {
	beforeUpdateCall = beforeUpdateCall + 1
	return nil
}

func TestUpdateCallbacks(t *testing.T) {
	DB.Migrator().DropTable(&Product5{})
	DB.AutoMigrate(&Product5{})

	p := Product5{Name: "unique_code"}
	DB.Model(&Product5{}).Create(&p)

	err := DB.Model(&Product5{}).Where("id", p.ID).Update("name", "update_name_1").Error
	if err != nil {
		t.Fatalf("should update success, but got err %v", err)
	}
	if beforeUpdateCall != 1 {
		t.Fatalf("before update should be called")
	}

	err = DB.Model(Product5{}).Where("id", p.ID).Update("name", "update_name_2").Error
	if !errors.Is(err, gorm.ErrInvalidValue) {
		t.Fatalf("should got RecordNotFound, but got %v", err)
	}
	if beforeUpdateCall != 1 {
		t.Fatalf("before update should not be called")
	}

	err = DB.Model([1]*Product5{&p}).Update("name", "update_name_3").Error
	if err != nil {
		t.Fatalf("should update success, but got err %v", err)
	}
	if beforeUpdateCall != 2 {
		t.Fatalf("before update should be called")
	}

	err = DB.Model([1]Product5{p}).Update("name", "update_name_4").Error
	if !errors.Is(err, gorm.ErrInvalidValue) {
		t.Fatalf("should got RecordNotFound, but got %v", err)
	}
	if beforeUpdateCall != 2 {
		t.Fatalf("before update should not be called")
	}
}
