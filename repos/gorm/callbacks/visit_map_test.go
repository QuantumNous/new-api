package callbacks

import (
	"reflect"
	"testing"
)

func TestLoadOrStoreVisitMap(t *testing.T) {
	var vm visitMap
	var loaded bool
	type testM struct {
		Name string
	}

	t1 := testM{Name: "t1"}
	t2 := testM{Name: "t2"}
	t3 := testM{Name: "t3"}

	vm = make(visitMap)
	if loaded = loadOrStoreVisitMap(&vm, reflect.ValueOf(&t1)); loaded {
		t.Fatalf("loaded should be false")
	}

	if loaded = loadOrStoreVisitMap(&vm, reflect.ValueOf(&t1)); !loaded {
		t.Fatalf("loaded should be true")
	}

	// t1 already exist but t2 not
	if loaded = loadOrStoreVisitMap(&vm, reflect.ValueOf([]*testM{&t1, &t2, &t3})); loaded {
		t.Fatalf("loaded should be false")
	}

	if loaded = loadOrStoreVisitMap(&vm, reflect.ValueOf([]*testM{&t2, &t3})); !loaded {
		t.Fatalf("loaded should be true")
	}
}
