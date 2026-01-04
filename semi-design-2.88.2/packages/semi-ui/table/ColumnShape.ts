import PropTypes from 'prop-types';
import { strings } from '@douyinfe/semi-foundation/table/constants';

export default {
    align: PropTypes.oneOf(strings.ALIGNS),
    className: PropTypes.string,
    colSpan: PropTypes.number,
    dataIndex: PropTypes.string,
    defaultSortOrder: PropTypes.oneOf(strings.SORT_DIRECTIONS),
    filterChildrenRecord: PropTypes.bool,
    filterDropdownProps: PropTypes.object,
    filterDropdown: PropTypes.node,
    filterDropdownVisible: PropTypes.bool,
    filterIcon: PropTypes.func,
    filterMultiple: PropTypes.bool,
    filteredValue: PropTypes.arrayOf(PropTypes.any),
    filters: PropTypes.array,
    fixed: PropTypes.oneOf(strings.FIXED_SET),
    onCell: PropTypes.func,
    onFilter: PropTypes.func,
    onFilterDropdownVisibleChange: PropTypes.func,
    onHeaderCell: PropTypes.func,
    onSorterChange: PropTypes.func, // TODO: future api
    render: PropTypes.func,
    renderFilterDropdownItem: PropTypes.func,
    sortChildrenRecord: PropTypes.bool,
    sortDirections: PropTypes.arrayOf(PropTypes.string), // TODO: future api
    sortOrder: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    sorter: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
    title: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    useFullRender: PropTypes.bool,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    showSortTip: PropTypes.bool,
};
