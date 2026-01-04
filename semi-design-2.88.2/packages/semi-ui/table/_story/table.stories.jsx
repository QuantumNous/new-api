import React from 'react';

import { Table } from '@douyinfe/semi-ui';

import JSXColumnsSimple from './JSXColumnsSmiple';
import JSXColumnsComplex from './JSXColumnsComplex';
import JSXColumnPropColumn from './JSXColumnPropColumn';

import ResizableColumns from './ResizableColumns';
import DragableTableDemo from './DragableTable';
import DynamicTableDemo from './DynamicTable';
import LinkedScroll from './LinkedScroll';
import ModalTable from './ModalTable';
import TabsTable from './TabsTable';
import EventTable from './EventTable';
import FnTable from './FnTable';
import DynamicFilters from './DynamicFilters';
import ResizableTable from './ResizableTable';
import ExpandDemo from './Expand';
import PaginationDemo from './PagintaionTable';
import SelectedRowsDemo from './SelectedRows';
import ChildrenData from './ChildrenData';
import ChildrenDataSelected from './ChildrenDataSelected';
import FixedExpandedRows from './FixedExpandedRows';
import FixedTable from './FixedTable';
import JSXFixedTable from './JSXFixedTable';
import JSXTitles from './JSXTitles';
import CustomFilterDropdownItem from './CustomFilterDropdownItem';
import VirtualizedDemo from './virtualized';
import VirtualizedNotFixed from './VirtualizedNotFixed';
import InfiniteScroll from './InfiniteScroll';
import VirtualTableOnCell from './VirtualTableOnCell';
import {
  ControlledSelection,
  PerfComplexRender,
  PerfContext,
  PerfOnRow,
  PerfRender,
  PerfResizableSelection,
  PerfVirtualized,
  DeepEqual
} from './Perf';
import RenderPagination from './RenderPagination';
import ControlledSortOrder from './ControlledSortOrder';
import FilterWithNewDataTable from './FilterWithNewDataTable';
import ExpandAllRows from './ExpandAllRows';
import ExpandAllGroupRows from './ExpandAllGroupRows';
import ExpandRowByClick from './ExpandRowByClick';
import FixAllColumnsWithoutWidth from './FixAllColumnsWithoutWidth';
import HugeData from "./HugeData"
import RowSelectionRenderCell from './RowSelectionRenderCell';
import RowBg from './RowBg';

export default {
  title: 'Table'
}

export { default as WithSideSheet } from './WithSideSheet';
export { default as InSideSheet } from './InSideSheet';
export { default as GroupedCols } from './GroupedCols';
export { default as GroupedColsFixed } from './GroupedColsFixed';
export { default as GroupedColsFixedJSX } from './GroupedColsFixedJSX';
export { default as GroupedColsFixedVirtualized } from './GroupedColsFixedVirtualized';
export { default as GroupedColsFixedVirtualizedGroups } from './GroupedColsFixedVirtualizedGroups';
export { default as GroupedRows } from './GroupedRows';
export { default as GroupedRowsFixed } from './GroupedRowsFixed';
export { default as FixedGroups } from './FixedGroups';
export { default as CustomComponents } from './CustomComponents';
export { default as CustomExpandIcons } from './CustomExpandIcons';
export { default as VirtualizedFixedDemo } from './virtualizedFixed';
export { default as VirtualizedGroupedRows } from './VirtualizedGroupedRows';
export { default as VirtualizedDataSelected } from './VritualizedDataSelected';
export { default as VirtualizedDynamicData } from './VirtualizedDynamicData';
export { default as MassiveColumns } from './MassiveColumns';
export { default as ControlledPagination } from './ControlledPagination';
export { default as FulldRenderDemo } from './FullRender';
export { RTLAlignScrollBar, ColumnAlign, Direction, ColumnAlignWithSorter  } from './RTL';
export { default as JSXAsyncData } from './JSXAsyncData';
export { default as ScrollBar } from './ScrollBar';
export { default as TableSpan } from './TableSpan';
export { default as FixRenderReturnProps } from './FixRenderReturnProps';
export { default as WarnColumnWithoutDataIndex } from './WarnColumnWithoutDataIndex';
export {
    DefaultFilteredValue,
    FixedColumnsChange,
    FixedZIndex,
    FixedHeaderMerge,
    FixedResizable,
    FixedExpandedRow,
    FixedMemoryLeak,
    FixedOnHeaderRow,
    RadioRowSelection,
    FixedVirtualizedEmpty,
    FixedFilter,
    FixedSorter,
    StickyHeaderTable,
    Fixed1188,
    EmptyFilters,
    FixedResizableWithForm,
    Zebra,
    WordBreakNormalTable, WordBreakFixedTable,
    EllipsisNormalTable, EllipsisFixedTable, ShowTitleTable,
    Fixed1556,
    FixedColumnAlign,
    FixOnChange,
    ColumnResize,
    FixedResizableRowSelection,
    SorterSortOrder,
    FixedPagination,
    ShowHeader,
    KeepDOM,
    SortIcon,
    FixedAllDisabledAndSelected,
    FeatRenderFilterDropdown,
    InputFilter,
    FixedRowSelectionHiddenResizable,
    FixedExpandGroupRow,
    FixedDefaultExpandedGroupedRows,
    FixedRowSelectionEmpty,
    DndKitDrag,
    FixedOnGroupedRowClassName,
    FixedVirtualizedRef,
    RowSelectionOnCell,
    FixedIndent
} from './v2';
export { default as FixSelectAll325 } from './Demos/rowSelection';

export { DeepEqual };

// empty table

const emptyColumn = [
  {
    title: 'Name',
    dataIndex: 'name',
    fixed: 'left',
    render: text => <a>{text}</a>,
  },
  {
    title: 'Age',
    dataIndex: 'age',
  },
  {
    title: 'Address',
    dataIndex: 'address',
  },
];
const emptyData = [];

export const EmptyTable = () => <Table autoWidth columns={emptyColumn} dataSource={emptyData} />;

EmptyTable.story = {
  name: 'empty table',
};

// basic table

const columns = [
  {
    title: 'Name',
    dataIndex: 'name',
    width: '30%',
    render: text => <a>{text}</a>,
  },
  {
    title: 'combine',
    width: '20%',
    dataIndex: 'test',
    children: [
      {
        title: 'Age',
        width: '20%',
        children: [
          {
            title: 'Age1',
            width: '20%',
            dataIndex: 'age1',
          },
          {
            title: 'Age2',
            width: '20%',
            dataIndex: 'age2',
          },
        ],
      },
      {
        title: 'Key',
        width: '20%',
        dataIndex: 'key',
      },
    ],
  },
  {
    title: 'Address',
    width: '50%',
    dataIndex: 'address',
  },
];
const data = [
  {
    key: '1',
    name: 'John Brown',
    age: 32,
    age1: 23,
    age2: 11,
    address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
  },
  {
    key: '2',
    name: 'Jim Green',
    age: 42,
    age1: 23,
    age2: 11,
    address: 'London No. 1 Lake Park',
  },
  {
    key: '3',
    name: 'Joe Black',
    age: 32,
    age1: 23,
    age2: 11,
    address: 'Sidney No. 1 Lake Park',
  },
  {
    key: '4',
    name: 'Disabled User',
    age: 99,
    age1: 23,
    age2: 11,
    address: 'Sidney No. 1 Lake Park',
  },
];

export const BasicTable = () => <Table columns={columns} dataSource={data} />;

BasicTable.story = {
  name: 'basic table',
};

export const SimpleJsx = () => <JSXColumnsSimple />;

SimpleJsx.story = {
  name: 'simple jsx',
};

export const ComplexJsx = () => <JSXColumnsComplex />;

ComplexJsx.story = {
  name: 'complex jsx',
};

ComplexJsx.parameters = {
  chromatic: { disableSnapshot: true },
}

// selection table

// rowSelection object indicates the need for row selection
const rowSelection = {
  onChange: (selectedRowKeys, selectedRows) => {
    // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
  },
  getCheckboxProps: record => ({
    disabled: record.name === 'Disabled User', // Column configuration not to be checked
    name: record.name,
  }),
};
export const FilterAndUpdateDataSource = () => <FilterWithNewDataTable />;

FilterAndUpdateDataSource.story = {
  name: 'filter and update dataSource',
};

export const SelectionTable = () => (
  <Table rowSelection={rowSelection} columns={columns} dataSource={data} />
);

SelectionTable.story = {
  name: 'selection table',
};

function ControlledSelectionTable() {
  const [selected, setSelected] = React.useState([]);
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: text => text,
    },
    {
      title: 'Age',
      dataIndex: 'age',
    },
    {
      title: 'Address',
      dataIndex: 'address',
    },
  ];
  const data = [
    {
      key: '1',
      name: 'John Brown',
      age: 32,
      address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
    },
    {
      key: '2',
      name: 'Jim Green',
      age: 42,
      address: 'London No. 1 Lake Park',
    },
    {
      key: '3',
      name: 'Joe Black',
      age: 32,
      address: 'Sidney No. 1 Lake Park',
    },
    {
      key: '4',
      name: 'Michael James',
      age: 99,
      address: 'Sidney No. 1 Lake Park',
    },
  ];
  const rowSelection = {
    onChange: (selectedRowKeys, selectedRows) => {
      setSelected(selectedRowKeys);
    },
    getCheckboxProps: record => ({
      disabled: selected.length === 2 && selected.findIndex(key => key === record.key) === -1, // Column configuration not to be checked
      name: record.name,
    }),
    selectedRowKeys: selected,
  };
  return (
    <Table columns={columns} dataSource={data} rowSelection={rowSelection} pagination={false} />
  );
}

export const _ControlledSelectionTable = () => <ControlledSelectionTable />;

_ControlledSelectionTable.story = {
  name: 'controlled selection table',
};
_ControlledSelectionTable.parameters = {
  chromatic: { disableSnapshot: true },
}

// sortable table

const sortColumns = [
  {
    title: 'Name',
    dataIndex: 'name',
    filters: [
      {
        text: 'XiaoMing',
        value: 'XiaoMing',
      },
      {
        text: 'ZhangSan',
        value: 'ZhangSan',
      },
      {
        text: 'SubMenu',
        value: 'SubMenu',
        children: [
          {
            text: 'Yellow',
            value: 'Yellow',
          },
          {
            text: 'Pink',
            value: 'Pink',
          },
        ],
      },
    ],
    onFilter: (value, record) => record.name.indexOf(value) === 0,
    sorter: (a, b) => a.name.length - b.name.length,
    sortDirections: ['descend'],
    sortOrder: 'descend',
  },
  {
    title: 'Age',
    dataIndex: 'age',
    defaultSortOrder: 'descend',
    sorter: (a, b) => a.age - b.age,
  },
  {
    title: 'Address',
    dataIndex: 'address',
    filters: [
      {
        text: 'BieJing',
        value: 'BeiJing',
      },
      {
        text: 'ShangHai',
        value: 'SHangHai',
      },
    ],
    filterMultiple: false,
    onFilter: (value, record) => record.address.indexOf(value) === 0,
    sorter: (a, b) => a.address.length - b.address.length,
    sortDirections: ['descend', 'ascend'],
  },
];

const sortData = [
  {
    key: '1',
    name: 'ZhangSan',
    age: 50,
    address: 'BeiJing No.1 High School',
  },
  {
    key: '2',
    name: 'LiSi',
    age: 60,
    address: 'BeiJing No.2 High School',
  },
  {
    key: '3',
    name: 'WangWu',
    age: 20,
    address: 'BeiJing No.3 High School',
  },
  {
    key: '4',
    name: 'XiaoMing',
    age: 30,
    address: 'BeiJing No.5 High School',
  },
];

export const SortTable = () => <Table columns={sortColumns} dataSource={sortData} />;

SortTable.story = {
  name: 'sort table',
};

export const ControlledSortOrderTable = () => <ControlledSortOrder />;

ControlledSortOrderTable.story = {
  name: 'controlled sortOrder table',
};

export const MiddleTable = () => <Table columns={columns} dataSource={data} size="middle" />;

MiddleTable.story = {
  name: 'middle table',
};

export const SmallTable = () => <Table columns={columns} dataSource={data} size="small" />;

SmallTable.story = {
  name: 'small table',
};

export const ExpandTable = () => <ExpandDemo />;

ExpandTable.story = {
  name: 'expand table',
};

export const _ResizableColumns = () => <ResizableColumns />;

_ResizableColumns.story = {
  name: 'resizable columns',
};

export const DragableTable = () => <DragableTableDemo />;

DragableTable.story = {
  name: 'dragable table',
};
DragableTable.parameters = {
  chromatic: { disableSnapshot: true },
}

export const _FixedTable = () => <FixedTable />;

_FixedTable.story = {
  name: 'fixed table',
};
_FixedTable.parameters = {
  chromatic: { disableSnapshot: true },
}

export const FixedJsxTable = () => <JSXFixedTable />;

FixedJsxTable.story = {
  name: 'fixed jsx table',
};

export const JSXTitlesDemo = () => <JSXTitles />;
JSXTitlesDemo.story = {
  name: 'jsx titles'
};

export const DynamicTable = () => (
  <div style={{ padding: 20 }}>
    <DynamicTableDemo />
  </div>
);

DynamicTable.story = {
  name: 'dynamic table',
};

export const _LinkedScroll = () => <LinkedScroll />;

_LinkedScroll.story = {
  name: 'linked scroll',
};

export const _ModalTable = () => <ModalTable />;

_ModalTable.story = {
  name: 'modal table',
};

export const _TabsTable = () => <TabsTable />;

_TabsTable.story = {
  name: 'tabs table',
};

export const _EventTable = () => <EventTable />;

_EventTable.story = {
  name: 'event table',
};

export const _FnTable = () => <FnTable />;

_FnTable.story = {
  name: 'fn table',
};

export const _DynamicFilters = () => <DynamicFilters />;

_DynamicFilters.story = {
  name: 'dynamic filters',
};

export const _ResizableTable = () => <ResizableTable />;

_ResizableTable.story = {
  name: 'resizable table',
};

export const WithPagination = () => <PaginationDemo />;

WithPagination.story = {
  name: 'with pagination',
};

export const SelectedRows = () => <SelectedRowsDemo />;

SelectedRows.story = {
  name: 'selected rows',
};

export const _ChildrenData = () => <ChildrenData />;

_ChildrenData.story = {
  name: 'children data',
};

export const ChildrenDataSelectedRows = () => <ChildrenDataSelected />;

ChildrenDataSelectedRows.story = {
  name: 'children data selected rows',
};

export const _ExpandAllRows = () => <ExpandAllRows />;

_ExpandAllRows.story = {
  name: 'expandAllRows',
};

export const _ExpandAllGroupRows = () => <ExpandAllGroupRows />;

_ExpandAllGroupRows.story = {
  name: 'expandAllGroupRows',
};

export const _ExpandRowByClick = () => <ExpandRowByClick />;

_ExpandRowByClick.story = {
  name: 'expandRowByClick',
};

export const RowSelectionBoolean = () => <Table columns={columns} dataSource={data} rowSelection />;

RowSelectionBoolean.story = {
  name: 'rowSelection boolean',
};

export const _FixAllColumnsWithoutWidth = () => <FixAllColumnsWithoutWidth />;

_FixAllColumnsWithoutWidth.story = {
  name: 'fix all columns without width',
};

export const JSXColumnPropColumnDemo = () => <JSXColumnPropColumn />;

export const FixedExpandedRowsDemo = () => <FixedExpandedRows />;
FixedExpandedRowsDemo.parameters = {
  chromatic: { disableSnapshot: true },
}

export const CustomFilterDropdownItemDemo = () => <CustomFilterDropdownItem />;

export const Virtualized = () => <VirtualizedDemo />;

export const VirtualizedNotFixedDemo = () => <VirtualizedNotFixed />;

export const InfiniteScrollDemo = () => <InfiniteScroll />;
export const VirtualTableOnCellDemo = () => <VirtualTableOnCell />;
export const ControlledSelectionDemo = () => <ControlledSelection />;
ControlledSelectionDemo.parameters = {
  chromatic: { disableSnapshot: true },
}
export const PerfComplexRenderDemo = () => <PerfComplexRender />;
PerfComplexRenderDemo.parameters = {
  chromatic: { disableSnapshot: true },
}
export const PerfContextDemo = () => <PerfContext />;
export const PerfOnRowDemo = () => <PerfOnRow />;
PerfOnRowDemo.parameters = {
  chromatic: { disableSnapshot: true },
}
export const PerfResizableSelectionDemo = () => <PerfResizableSelection />;
PerfResizableSelectionDemo.parameters = {
  chromatic: { disableSnapshot: true },
}
export const PerfVirtualizedDemo = () => <PerfVirtualized />;
export const PerfRenderDemo = () => <PerfRender />;
PerfRenderDemo.parameters = {
  chromatic: { disableSnapshot: true },
}
export const RenderPaginationDemo = () => <RenderPagination />;

export const HugeDataDemo = ()=><HugeData/>
HugeDataDemo.parameters = {
  chromatic: { disableSnapshot: true },
};

export const _RowSelectionRenderCell = () => <RowSelectionRenderCell />;

_RowSelectionRenderCell.story = {
  name: 'RowSelection RenderCell',
};

export const RowBgDemo = () => <RowBg />;
