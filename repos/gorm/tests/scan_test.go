package tests_test

import (
	"reflect"
	"sort"
	"strings"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

type PersonAddressInfo struct {
	Person  *Person  `gorm:"embedded"`
	Address *Address `gorm:"embedded"`
}

func TestScan(t *testing.T) {
	user1 := User{Name: "ScanUser1", Age: 1}
	user2 := User{Name: "ScanUser2", Age: 10}
	user3 := User{Name: "ScanUser3", Age: 20}
	DB.Save(&user1).Save(&user2).Save(&user3)

	type result struct {
		ID   uint
		Name string
		Age  int
	}

	var res result
	DB.Table("users").Select("id, name, age").Where("id = ?", user3.ID).Scan(&res)
	if res.ID != user3.ID || res.Name != user3.Name || res.Age != int(user3.Age) {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", res, user3)
	}

	var resPointer *result
	if err := DB.Table("users").Select("id, name, age").Where("id = ?", user3.ID).Scan(&resPointer).Error; err != nil {
		t.Fatalf("Failed to query with pointer of value, got error %v", err)
	} else if resPointer.ID != user3.ID || resPointer.Name != user3.Name || resPointer.Age != int(user3.Age) {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", res, user3)
	}

	DB.Table("users").Select("id, name, age").Where("id = ?", user2.ID).Scan(&res)
	if res.ID != user2.ID || res.Name != user2.Name || res.Age != int(user2.Age) {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", res, user2)
	}

	DB.Model(&User{Model: gorm.Model{ID: user3.ID}}).Select("id, name, age").Scan(&res)
	if res.ID != user3.ID || res.Name != user3.Name || res.Age != int(user3.Age) {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", res, user3)
	}

	doubleAgeRes := &result{}
	if err := DB.Table("users").Select("age + age as age").Where("id = ?", user3.ID).Scan(&doubleAgeRes).Error; err != nil {
		t.Errorf("Scan to pointer of pointer")
	}

	if doubleAgeRes.Age != int(res.Age)*2 {
		t.Errorf("Scan double age as age, expect: %v, got %v", res.Age*2, doubleAgeRes.Age)
	}

	var results []result
	DB.Table("users").Select("name, age").Where("id in ?", []uint{user2.ID, user3.ID}).Scan(&results)

	sort.Slice(results, func(i, j int) bool {
		return strings.Compare(results[i].Name, results[j].Name) <= -1
	})

	if len(results) != 2 || results[0].Name != user2.Name || results[1].Name != user3.Name {
		t.Errorf("Scan into struct map, got %#v", results)
	}

	type ID uint64
	var id ID
	DB.Raw("select id from users where id = ?", user2.ID).Scan(&id)
	if uint(id) != user2.ID {
		t.Errorf("Failed to scan to customized data type")
	}

	var resInt interface{}
	resInt = &User{}
	if err := DB.Table("users").Select("id, name, age").Where("id = ?", user3.ID).Find(&resInt).Error; err != nil {
		t.Fatalf("Failed to query with pointer of value, got error %v", err)
	} else if resInt.(*User).ID != user3.ID || resInt.(*User).Name != user3.Name || resInt.(*User).Age != user3.Age {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", resInt, user3)
	}

	var resInt2 interface{}
	resInt2 = &User{}
	if err := DB.Table("users").Select("id, name, age").Where("id = ?", user3.ID).Scan(&resInt2).Error; err != nil {
		t.Fatalf("Failed to query with pointer of value, got error %v", err)
	} else if resInt2.(*User).ID != user3.ID || resInt2.(*User).Name != user3.Name || resInt2.(*User).Age != user3.Age {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", resInt2, user3)
	}

	var resInt3 interface{}
	resInt3 = []User{}
	if err := DB.Table("users").Select("id, name, age").Where("id = ?", user3.ID).Find(&resInt3).Error; err != nil {
		t.Fatalf("Failed to query with pointer of value, got error %v", err)
	} else if rus := resInt3.([]User); len(rus) == 0 || rus[0].ID != user3.ID || rus[0].Name != user3.Name || rus[0].Age != user3.Age {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", resInt3, user3)
	}

	var resInt4 interface{}
	resInt4 = []User{}
	if err := DB.Table("users").Select("id, name, age").Where("id = ?", user3.ID).Scan(&resInt4).Error; err != nil {
		t.Fatalf("Failed to query with pointer of value, got error %v", err)
	} else if rus := resInt4.([]User); len(rus) == 0 || rus[0].ID != user3.ID || rus[0].Name != user3.Name || rus[0].Age != user3.Age {
		t.Fatalf("Scan into struct should work, got %#v, should %#v", resInt4, user3)
	}

	var resInt5 interface{}
	resInt5 = []User{}
	if err := DB.Table("users").Select("id, name, age").Where("id IN ?", []uint{user1.ID, user2.ID, user3.ID}).Find(&resInt5).Error; err != nil {
		t.Fatalf("Failed to query with pointer of value, got error %v", err)
	} else if rus := resInt5.([]User); len(rus) != 3 {
		t.Fatalf("Scan into struct should work, got %+v, len %v", resInt5, len(rus))
	}
}

func TestScanRows(t *testing.T) {
	user1 := User{Name: "ScanRowsUser1", Age: 1}
	user2 := User{Name: "ScanRowsUser2", Age: 10}
	user3 := User{Name: "ScanRowsUser3", Age: 20}
	DB.Save(&user1).Save(&user2).Save(&user3)

	rows, err := DB.Table("users").Where("name = ? or name = ?", user2.Name, user3.Name).Select("name, age").Rows()
	if err != nil {
		t.Errorf("Not error should happen, got %v", err)
	}

	type Result struct {
		Name string
		Age  int
	}

	var results []Result
	for rows.Next() {
		var result Result
		if err := DB.ScanRows(rows, &result); err != nil {
			t.Errorf("should get no error, but got %v", err)
		}
		results = append(results, result)
	}

	sort.Slice(results, func(i, j int) bool {
		return strings.Compare(results[i].Name, results[j].Name) <= -1
	})

	if !reflect.DeepEqual(results, []Result{{Name: "ScanRowsUser2", Age: 10}, {Name: "ScanRowsUser3", Age: 20}}) {
		t.Errorf("Should find expected results")
	}

	var ages int
	if err := DB.Table("users").Where("name = ? or name = ?", user2.Name, user3.Name).Select("SUM(age)").Scan(&ages).Error; err != nil || ages != 30 {
		t.Fatalf("failed to scan ages, got error %v, ages: %v", err, ages)
	}

	var name string
	if err := DB.Table("users").Where("name = ?", user2.Name).Select("name").Scan(&name).Error; err != nil || name != user2.Name {
		t.Fatalf("failed to scan ages, got error %v, ages: %v", err, name)
	}
}

func TestScanToEmbedded(t *testing.T) {
	person1 := Person{Name: "person 1"}
	person2 := Person{Name: "person 2"}
	DB.Save(&person1).Save(&person2)

	address1 := Address{Name: "address 1"}
	address2 := Address{Name: "address 2"}
	DB.Save(&address1).Save(&address2)

	DB.Create(&PersonAddress{PersonID: person1.ID, AddressID: int(address1.ID)})
	DB.Create(&PersonAddress{PersonID: person1.ID, AddressID: int(address2.ID)})
	DB.Create(&PersonAddress{PersonID: person2.ID, AddressID: int(address1.ID)})

	var personAddressInfoList []*PersonAddressInfo
	if err := DB.Select("people.*, addresses.*").
		Table("people").
		Joins("inner join person_addresses on people.id = person_addresses.person_id").
		Joins("inner join addresses on person_addresses.address_id = addresses.id").
		Find(&personAddressInfoList).Error; err != nil {
		t.Errorf("Failed to run join query, got error: %v", err)
	}

	personMatched := false
	addressMatched := false

	for _, info := range personAddressInfoList {
		if info.Person == nil {
			t.Fatalf("Failed, expected not nil, got person nil")
		}
		if info.Address == nil {
			t.Fatalf("Failed, expected not nil, got address nil")
		}
		if info.Person.ID == person1.ID {
			personMatched = true
			if info.Person.Name != person1.Name {
				t.Errorf("Failed, expected %v, got %v", person1.Name, info.Person.Name)
			}
		}
		if info.Address.ID == address1.ID {
			addressMatched = true
			if info.Address.Name != address1.Name {
				t.Errorf("Failed, expected %v, got %v", address1.Name, info.Address.Name)
			}
		}
	}

	if !personMatched {
		t.Errorf("Failed, no person matched")
	}
	if !addressMatched {
		t.Errorf("Failed, no address matched")
	}

	personDupField := Person{ID: person1.ID}
	if err := DB.Select("people.id, people.*").
		First(&personDupField).Error; err != nil {
		t.Errorf("Failed to run join query, got error: %v", err)
	}
	AssertEqual(t, person1, personDupField)

	user := User{
		Name: "TestScanToEmbedded_1",
		Manager: &User{
			Name:    "TestScanToEmbedded_1_m1",
			Manager: &User{Name: "TestScanToEmbedded_1_m1_m1"},
		},
	}
	DB.Create(&user)

	type UserScan struct {
		ID        uint
		Name      string
		ManagerID *uint
	}
	var user2 UserScan
	err := DB.Raw("SELECT * FROM users INNER JOIN users Manager ON users.manager_id = Manager.id WHERE users.id = ?", user.ID).Scan(&user2).Error
	AssertEqual(t, err, nil)
}
