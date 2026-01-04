import { enGB } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'en-GB',
    dateFnsLocale: enGB,
    currency: 'GBP',
    Pagination: {
        pageSize: 'Items per page: ${pageSize}',
        total: 'Total pages: ${total}',
        jumpTo: 'Jump to',
        page: ' page',
    },
    Modal: {
        confirm: 'Confirm',
        cancel: 'Cancel',
    },
    Tabs: {
        more: "More"
    },
    TimePicker: {
        placeholder: {
            time: 'Select time',
            timeRange: 'Select a time range',
        },
        begin: 'Start Time',
        end: 'End Time',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Select date',
            dateTime: 'Select date and time',
            dateRange: ['Start date', 'End date'],
            dateTimeRange: ['Start date', 'End date'],
            monthRange: ['Start month', 'End month'],
        },
        presets: 'Presets',
        footer: {
            confirm: 'Confirm',
            cancel: 'Cancel',
        },
        selectDate: 'Select Date',
        selectTime: 'Select Time',
        year: 'year',
        month: 'month',
        day: 'day',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'May',
            6: 'Jun',
            7: 'Jul',
            8: 'Aug',
            9: 'Sep',
            10: 'Oct',
            11: 'Nov',
            12: 'Dec',
        },
        fullMonths: {
            1: 'January',
            2: 'February',
            3: 'March',
            4: 'April',
            5: 'May',
            6: 'June',
            7: 'July',
            8: 'August',
            9: 'September',
            10: 'October',
            11: 'November',
            12: 'December',
        },
        weeks: {
            Mon: 'Mon',
            Tue: 'Tue',
            Wed: 'Wed',
            Thu: 'Thu',
            Fri: 'Fri',
            Sat: 'Sat',
            Sun: 'Sun',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Confirm',
        cancel: 'Cancel',
    },
    Navigation: {
        collapseText: 'Collapse Sidebar',
        expandText: 'Expand Sidebar',
    },
    Table: {
        emptyText: 'No Result',
        pageText: 'Showing ${currentStart} to ${currentEnd} of ${total}',
        descend: 'Click to descend',
        ascend: 'Click to ascend',
        cancelSort: 'Cancel sorting',
    },
    Select: {
        emptyText: 'No Result',
        createText: 'Create',
    },
    Tree: {
        emptyText: 'No Result',
        searchPlaceholder: 'Search',
    },
    Cascader: {
        emptyText: 'No Result',
    },
    List: {
        emptyText: 'No Result',
    },
    Calendar: {
        allDay: 'All Day',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} more',
    },
    Upload: {
        mainText: 'Click to Upload File or Drag File to here',
        illegalTips: 'This type of file is not supported',
        legalTips: 'Release and start uploading',
        retry: 'Retry',
        replace: 'Replace File',
        clear: 'Clear',
        selectedFiles: 'Selected Files',
        illegalSize: 'Illegal file size',
        fail: 'Upload fail',
    },
    TreeSelect: {
        searchPlaceholder: 'Search',
    },
    Typography: {
        copy: 'Copy',
        copied: 'Copied',
        expand: 'Expand',
        collapse: 'Collapse',
    },
    Transfer: {
        emptyLeft: 'No Data',
        emptySearch: 'No search results',
        emptyRight: 'No content, check from the left',
        placeholder: 'Search',
        clear: 'Clear',
        selectAll: 'Select all',
        clearSelectAll: 'Unselect all',
        total: 'Total items: ${total}',
        selected: 'Items selected: ${total}',
    },
    Form: {
        optional: '(optional)',
    },
    Image: {
        preview: 'Preview',
        loading: 'Loading',
        loadError: 'Failed to load',
        prevTip: 'Previous',
        nextTip: 'Next',
        zoomInTip: 'Zoom in',
        zoomOutTip: 'Zoom out',
        rotateTip: 'Rotate',
        downloadTip: 'Download',
        adaptiveTip: 'Adapt to the page',
        originTip: 'Original size',
    },
    Chat: {
        deleteConfirm: 'Are you sure you want to delete this session?',
        clearContext: 'Context cleared',
        copySuccess: 'Copy successful.',
        stop: 'Stop',
        copy: 'Copy',
        copied: 'Copied',
        dropAreaText: 'Put the file here',
    },
    UserGuide: {
        skip: 'Skip',
        next: 'Next',
        prev: 'Prev',
        finish: 'Finish',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Search',
        replace: 'Replace',
        replaceAll: 'Replace All',
    },
    VideoPlayer: {
        rateChange: 'Switch rate to ${rate}',
        qualityChange: 'Switch quality to ${quality}',
        routeChange: 'Switch route to ${route}',
        mirror: 'Mirror',
        cancelMirror: 'Cancel mirror',
        loading: 'Loading...',
        stall: 'Loading failed',
        noResource: 'No resource',
        videoError: 'Video load error'
    },
    AIChatDialogue: {
        delete: 'Delete',
        deleteConfirm: 'Are you sure you want to delete this message?',
        deleteContent: 'This message will be permanently deleted and cannot be recovered.',
        copySuccess: 'Copy successful.',
        loading: 'Loading...',
        reasoning: {
            completed: 'Reasoning completed',
            thinking: 'Thinking...'
        },
        annotationText: 'pieces of information'
    },
    Feedback: {
        submit: 'Submit',
        cancel: 'Cancel'
    },
    AIChatInput: {
        template: 'Template',
        configure: 'Configure',
        selected: 'Selected ${count} items',
    }
};

// [i18n-English(GB)]
export default local;
