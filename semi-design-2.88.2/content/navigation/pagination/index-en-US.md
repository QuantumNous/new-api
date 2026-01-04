---
localeCode: en-US
order: 57
category: Navigation
title:  Pagination
subTitle: Pagination
icon: doc-pagination
width: 45%
brief: The Pager helps users navigate between multiple pages
---

## Demos

### How to import

```jsx
import { Pagination } from '@douyinfe/semi-ui';
```
### Basic Usage

Set the total number via `Total`, Set capacity per page via `pageSize`.

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={30} style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={80} style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={200} style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={80} pageSize={30} style={{ marginBottom: 12 }}></Pagination>
    </div>
);
```

### disabled

Disabled via the `disabled` setting

```jsx live=true width=60%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <Pagination total={30} disabled style={{ marginBottom: 12 }}></Pagination>
);
```

### Show total page number

Use the showTotal property to control whether the total number of pages is shown.

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showTotal style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={200} showTotal style={{ marginBottom: 12 }}></Pagination>
    </div>
);
```

### Specify current page number

You can specify the currently active page number via `defaultCurrentPage`.

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showTotal defaultCurrentPage={3}></Pagination>
    </div>
);
```

### Capacity switching per page

By setting `showSizeChanger` for `true`, allowing quick switching of capacity per page via the Select component

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showSizeChanger></Pagination>
        <br/>
        <br/>
        <Pagination total={300} showSizeChanger></Pagination>
    </div>
);
```

### Jump to a page quickly

By setting `showQuickJumper` to `true`, you can enter the page number through the Input control to quickly jump  
When Input loses focus, if there is a valid number in Input, it will jump directly. You can also enter the page number you want to jump to when the Input is focused, and then hit enter to jump directly  
If you enter a page number greater than the total page number of the pager, we will automatically jump to the last page for you   
showQuickJumper is available after v1.31  

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination total={80} showQuickJumper style={{ marginBottom: 12 }}></Pagination>
        <Pagination total={300} showQuickJumper></Pagination>
    </div>
);
```


### Page number controlled

After the currentPage is passed in, the pager is a controlled component and is generally used in conjunction with `onPageChange`. The current active page number depends entirely on the value of the `currentPage` passed in.

```jsx live=true width=55%
import React, { useState } from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => {
    const [page, setPage] = useState(3);
    function onPageChange(currentPage) {
        setPage(currentPage);
    }
    return (
        <Pagination
            total={200}
            currentPage={page}
            onPageChange={onPageChange}>
        </Pagination>
    );
};
```

### Preset capacity per page

Specify an optional value for switching the capacity per page by using the `pageSizeOpts` array

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <div>
        <Pagination
            total={300}
            showSizeChanger
            pageSizeOpts={[50, 80, 90, 200]}>
        </Pagination>
        <br/>
        <br/>
        <Pagination
            total={300}
            showSizeChanger
            pageSizeOpts={[10, 20, 50, 200]}>
        </Pagination>
    </div>
);
```

### Mini version

Show mini pagination via size properties.

```jsx live=true width=55%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <Pagination total={90} size="small"></Pagination>
);
```

Turn on hoverShowPageSelect to quickly switch hover page numbers (provided after v1.27.0)

```jsx live=true width=50%
import React from 'react';
import { Pagination } from '@douyinfe/semi-ui';

() => (
    <Pagination total={90} size="small" hoverShowPageSelect></Pagination>
);
```

## API reference

| Properties         | Instructions                                                                                                | type                                            | Default             |   Version    |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- |------------- |
| className          | The CSS class name of the wrapper element                                                                   | string                                          |                     |              |
| currentPage        | Current page number                                                                                         | number                                          |                     |              |
| defaultCurrentPage | Default current page number                                                                                 | number                                          |                     |              |
| hideOnSinglePage   | Whether to hide the page divider automatically when the total number of pages is less than 2. When showSizeChanger is true, this switch no longer takes effect                | boolean                                         | false               |              |
| disabled           | disabled                                                                             | boolean                                         |false                  | 2.37.0
| hoverShowPageSelect  | Whether to show the page select when hover page (only work when size='small')                             | boolean                                         | false               |   1.27.0     |
| nextText           | Text displayed by the next Page button                                                                      | string\| React Node                             |                     |              |
| pageSize           | Number of entries per page                                                                                  | number                                          | 10                  |              |
| pageSizeOpts       | Specify how many items are displayed per page                                                               | array                                           | \[10, 20, 40, 100\] |              |
| popoverPosition    | Floating layer direction, visible [Popover·API reference·position](/en-US/show/popover#Use%20with%20Tooltip%20or%20Popconfirm) | string                                          | "bottomLeft"        |              |
| popoverZIndex      | Floating layer z-index value                                                                                | number                                          |  1030               |              |
| prevText           | Text displayed by the previous Page button                                                                  | string\| React Node                             |                     |              |
| size               | Size, optional `small`, `default`                                                                           | string                                          | 'default'           |              |
| style              | Inline style                                                                                                | object                                          |                     |              |
| showSizeChanger    | Whether to show a selector to switch the capacity of each page                                              | boolean                                         | false               |              |
| showQuickJumper    | Whether to show a input to type the page number, supported after v1.31                                      | boolean                                         | false               |   1.31.0     |
| showTotal          | Whether to show total page number                                                                           | boolean                                         | 3                   |              |
| total              | Total number                                                                                     | number                                          | 1                   |              |
| onChange           | The callback function when page number or capacity per page changes                                         | function(currentPage: number, pageSize: number) |                     |              |
| onPageChange       | A callback function for page number changes                                                                 | function(currentPage: number)                   |                     |              |
| onPageSize Change  | Callback function when capacity changes per page                                                            | function(pageSize: number)                      |                     |              |

## Accessibility

### ARIA

- `aria-label`: Labels the element such as previous, next, pages in the pagination.
- `aria-current`: Indicates the current page.

## Design Tokens
<DesignToken/>

## FAQ

-   **Why is the page drop-down selector only `1,000,000` at most？**  
    Because when creating lists, the browser has [restrictions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Invalid_array_length) on the size of Array.from () to create arrays; At the same time, in order to take into account the overhead of Array.from(), we set the threshold of `1,000,000`.