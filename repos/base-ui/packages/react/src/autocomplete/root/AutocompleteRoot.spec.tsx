import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';

const objectItems = [
  { value: 'a', label: 'apple' },
  { value: 'b', label: 'banana' },
  { value: 'c', label: 'cherry' },
];

const objectItemsReadonly = [
  { value: 'a', label: 'apple' },
  { value: 'b', label: 'banana' },
  { value: 'c', label: 'cherry' },
] as const;

const groupItemsReadonly = [
  {
    value: 'fruits',
    items: [
      { value: 'a', label: 'apple' },
      { value: 'b', label: 'banana' },
      { value: 'c', label: 'cherry' },
    ],
  },
  {
    value: 'vegetables',
    items: [
      { value: 'd', label: 'daikon' },
      { value: 'e', label: 'endive' },
      { value: 'f', label: 'fennel' },
    ],
  },
] as const;

<Autocomplete.Root
  items={objectItems}
  itemToStringValue={(item) => {
    return item.value;
  }}
/>;

<Autocomplete.Root
  items={groupItemsReadonly}
  itemToStringValue={(item) => {
    return item.label;
  }}
/>;

<Autocomplete.Root
  items={groupItemsReadonly}
  itemToStringValue={(item) => {
    // @ts-expect-error - item is the nested item from groups, not the group itself
    return item.items;
  }}
/>;

<Autocomplete.Root
  items={objectItems}
  defaultValue="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

<Autocomplete.Root
  items={objectItemsReadonly}
  defaultValue="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

<Autocomplete.Root
  items={objectItems}
  value="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

// @ts-expect-error value refers to the input value, not the item object
<Autocomplete.Root items={objectItems} value={objectItems[0]} />;

<Autocomplete.Root
  items={objectItems}
  defaultValue="a"
  itemToStringValue={(item) => {
    return item.value;
  }}
/>;

<Autocomplete.Root
  defaultValue="javascript"
  onValueChange={(value) => {
    // @ts-expect-error
    value.pop();
  }}
/>;

<Autocomplete.Root
  defaultValue="test"
  onValueChange={(value) => {
    value.length;
  }}
/>;

function App2() {
  const [value, setValue] = React.useState('a');
  return (
    <Autocomplete.Root
      value={value}
      onValueChange={(newValue) => {
        newValue.length;
      }}
    />
  );
}
