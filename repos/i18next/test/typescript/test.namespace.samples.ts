export type TestNamespaceCustom = {
  foo: 'foo';
  bar: 'bar';
  baz: {
    bing: 'boop';
  };
  qux: 'some {{val, number}}';
  inter: 'some {{val}}';
  interUnescaped: 'some unescaped {{- val}}';
  interUnescapedNoSpace: 'some unescaped {{-val}}';
  interUnescapedFormatted: 'some unescaped {- val, number}}';
  nullKey: null;
  'empty string with {{val}}': '';
};

export type TestNamespaceCustomAlternate = {
  baz: 'baz';
  foobar: {
    barfoo: 'barfoo';
    deep: {
      deeper: {
        deeeeeper: 'foobar';
      };
    };
  };
};

export type TestNamespaceFallback = {
  fallbackKey: 'fallback';
};

export type TestNamespaceOrdinal = {
  place_ordinal_one: '1st place';
  place_ordinal_two: '2nd place';
  place_ordinal_few: '3rd place';
  place_ordinal_other: '{{count}}th place';
};

export type TestNamespaceContext = {
  dessert_cake: 'a nice cake';
  dessert_muffin_one: 'a nice muffin';
  dessert_muffin_other: '{{count}} nice muffins';

  beverage: 'a classic beverage';
  beverage_beer: 'fresh beer';
  beverage_water: 'cold water';
};

export type TestNamespaceContextAlternate = {
  game: 'A fun game';
  game_chess: 'Chess';
  game_monopoly: 'Monopoly';
};

export type TestNamespacePlurals = {
  foo_zero: 'foo';
  foo_one: 'foo';
  foo_two: 'foo';
  foo_many: 'foo';
  foo_other: 'foo';
};

export type TestNamespaceNonPlurals = {
  test: 'Test';
  test_2: 'Test 2';
  // 'test_form.title': 'title';
  test_form: {
    title: 'title';
  };
};

export type TestNamespaceInterpolators = {
  just_a_string: string;

  simple: 'This is {{olim}}';
  simple_with_format: 'This is {{olim, format}}';
  simple_multiple_keys: 'This has {{more}} than {{one}}';

  keypath: 'Give me one day {{out.there}}';
  keypath_with_format: 'Give me one day {{out.there, format}}';
  keypath_multiple: '{{some.thing}} asd {{some.else}}';

  keypath_deep: '{{living.in.the}} in the sun';
};
