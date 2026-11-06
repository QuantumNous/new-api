package tests_test

import (
	"fmt"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func assertCallbacks(v interface{}, fnames []string) (result bool, msg string) {
	var (
		got   []string
		funcs = reflect.ValueOf(v).Elem().FieldByName("fns")
	)

	for i := 0; i < funcs.Len(); i++ {
		got = append(got, getFuncName(funcs.Index(i)))
	}

	return fmt.Sprint(got) == fmt.Sprint(fnames), fmt.Sprintf("expects %v, got %v", fnames, got)
}

func getFuncName(fc interface{}) string {
	reflectValue, ok := fc.(reflect.Value)
	if !ok {
		reflectValue = reflect.ValueOf(fc)
	}

	fnames := strings.Split(runtime.FuncForPC(reflectValue.Pointer()).Name(), ".")
	return fnames[len(fnames)-1]
}

func c1(*gorm.DB) {}
func c2(*gorm.DB) {}
func c3(*gorm.DB) {}
func c4(*gorm.DB) {}
func c5(*gorm.DB) {}
func c6(*gorm.DB) {}

func TestCallbacks(t *testing.T) {
	type callback struct {
		name    string
		before  string
		after   string
		remove  bool
		replace bool
		err     string
		match   func(*gorm.DB) bool
		h       func(*gorm.DB)
	}

	datas := []struct {
		callbacks []callback
		err       string
		results   []string
	}{
		{
			callbacks: []callback{{h: c1}, {h: c2}, {h: c3}, {h: c4}, {h: c5}},
			results:   []string{"c1", "c2", "c3", "c4", "c5"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2}, {h: c3}, {h: c4}, {h: c5, before: "c4"}},
			results:   []string{"c1", "c2", "c3", "c5", "c4"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2}, {h: c3}, {h: c4, after: "c5"}, {h: c5}},
			results:   []string{"c1", "c2", "c3", "c5", "c4"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2}, {h: c3}, {h: c4, after: "c5"}, {h: c5, before: "c4"}},
			results:   []string{"c1", "c2", "c3", "c5", "c4"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2, before: "c4", after: "c5"}, {h: c3}, {h: c4}, {h: c5}},
			results:   []string{"c1", "c5", "c2", "c3", "c4"},
		},
		{
			callbacks: []callback{{h: c1, after: "c3"}, {h: c2, before: "c4", after: "c5"}, {h: c3, before: "c5"}, {h: c4}, {h: c5}},
			results:   []string{"c3", "c1", "c5", "c2", "c4"},
		},
		{
			callbacks: []callback{{h: c1, before: "c4", after: "c3"}, {h: c2, before: "c4", after: "c5"}, {h: c3, before: "c5"}, {h: c4}, {h: c5}},
			results:   []string{"c3", "c1", "c5", "c2", "c4"},
		},
		{
			callbacks: []callback{{h: c1, before: "c3", after: "c4"}, {h: c2, before: "c4", after: "c5"}, {h: c3, before: "c5"}, {h: c4}, {h: c5}},
			err:       "conflicting",
		},
		{
			callbacks: []callback{{h: c1}, {h: c2, before: "c4", after: "c5"}, {h: c3}, {h: c4}, {h: c5}, {h: c2, remove: true}},
			results:   []string{"c1", "c5", "c3", "c4"},
		},
		{
			callbacks: []callback{{h: c1}, {name: "c", h: c2}, {h: c3}, {name: "c", h: c4, replace: true}},
			results:   []string{"c1", "c4", "c3"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2, before: "c4", after: "c5"}, {h: c3}, {h: c4}, {h: c5, before: "*"}},
			results:   []string{"c5", "c1", "c2", "c3", "c4"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2, before: "c4", after: "c5"}, {h: c3, before: "*"}, {h: c4}, {h: c5, before: "*"}},
			results:   []string{"c3", "c5", "c1", "c2", "c4"},
		},
		{
			callbacks: []callback{{h: c1}, {h: c2, before: "c4", after: "c5"}, {h: c3, before: "c4", after: "*"}, {h: c4, after: "*"}, {h: c5, before: "*"}},
			results:   []string{"c5", "c1", "c2", "c3", "c4"},
		},
	}

	for idx, data := range datas {
		db, err := gorm.Open(nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		callbacks := db.Callback()

		for _, c := range data.callbacks {
			var v interface{} = callbacks.Create()
			callMethod := func(s interface{}, name string, args ...interface{}) {
				var argValues []reflect.Value
				for _, arg := range args {
					argValues = append(argValues, reflect.ValueOf(arg))
				}

				results := reflect.ValueOf(s).MethodByName(name).Call(argValues)
				if len(results) > 0 {
					v = results[0].Interface()
				}
			}

			if c.name == "" {
				c.name = getFuncName(c.h)
			}

			if c.before != "" {
				callMethod(v, "Before", c.before)
			}

			if c.after != "" {
				callMethod(v, "After", c.after)
			}

			if c.match != nil {
				callMethod(v, "Match", c.match)
			}

			if c.remove {
				callMethod(v, "Remove", c.name)
			} else if c.replace {
				callMethod(v, "Replace", c.name, c.h)
			} else {
				callMethod(v, "Register", c.name, c.h)
			}

			if e, ok := v.(error); !ok || e != nil {
				err = e
			}
		}

		if len(data.err) > 0 && err == nil {
			t.Errorf("callbacks tests #%v should got error %v, but not", idx+1, data.err)
		} else if len(data.err) == 0 && err != nil {
			t.Errorf("callbacks tests #%v should not got error, but got %v", idx+1, err)
		}

		if ok, msg := assertCallbacks(callbacks.Create(), data.results); !ok {
			t.Errorf("callbacks tests #%v failed, got %v", idx+1, msg)
		}
	}
}

func TestPluginCallbacks(t *testing.T) {
	db, _ := gorm.Open(nil, nil)
	createCallback := db.Callback().Create()

	createCallback.Before("*").Register("plugin_1_fn1", c1)
	createCallback.After("*").Register("plugin_1_fn2", c2)

	if ok, msg := assertCallbacks(createCallback, []string{"c1", "c2"}); !ok {
		t.Errorf("callbacks tests failed, got %v", msg)
	}

	// plugin 2
	createCallback.Before("*").Register("plugin_2_fn1", c3)
	if ok, msg := assertCallbacks(createCallback, []string{"c3", "c1", "c2"}); !ok {
		t.Errorf("callbacks tests failed, got %v", msg)
	}

	createCallback.After("*").Register("plugin_2_fn2", c4)
	if ok, msg := assertCallbacks(createCallback, []string{"c3", "c1", "c2", "c4"}); !ok {
		t.Errorf("callbacks tests failed, got %v", msg)
	}

	// plugin 3
	createCallback.Before("*").Register("plugin_3_fn1", c5)
	if ok, msg := assertCallbacks(createCallback, []string{"c5", "c3", "c1", "c2", "c4"}); !ok {
		t.Errorf("callbacks tests failed, got %v", msg)
	}

	createCallback.After("*").Register("plugin_3_fn2", c6)
	if ok, msg := assertCallbacks(createCallback, []string{"c5", "c3", "c1", "c2", "c4", "c6"}); !ok {
		t.Errorf("callbacks tests failed, got %v", msg)
	}
}
