import { Locale as dateFnsLocale } from 'date-fns';

export interface Locale {
    code: string;
    dateFnsLocale: dateFnsLocale;
    currency: string;
    Pagination: {
        pageSize: string;
        total: string;
        jumpTo: string;
        page: string
    };
    Modal: {
        confirm: string;
        cancel: string
    };
    Tabs: {
        more: string
    };
    TimePicker: {
        placeholder: {
            time: string;
            timeRange: string
        };
        begin: string;
        end: string;
        hour: string;
        minute: string;
        second: string;
        AM: string;
        PM: string
    };
    DatePicker: {
        placeholder: {
            date: string;
            dateTime: string;
            dateRange: [string, string];
            dateTimeRange: [string, string];
            monthRange: [string, string]
        };
        presets: string;
        footer: {
            confirm: string;
            cancel: string
        };
        selectDate: string;
        selectTime: string;
        year: string;
        month: string;
        day: string;
        monthText: string;
        months: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
            8: string;
            9: string;
            10: string;
            11: string;
            12: string
        };
        fullMonths: {
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            7: string;
            8: string;
            9: string;
            10: string;
            11: string;
            12: string
        };
        weeks: {
            Mon: string;
            Tue: string;
            Wed: string;
            Thu: string;
            Fri: string;
            Sat: string;
            Sun: string
        };
        localeFormatToken: {
            FORMAT_SWITCH_DATE: string
        }
    };
    Navigation: {
        collapseText: string;
        expandText: string
    };
    Popconfirm: {
        confirm: string;
        cancel: string
    };
    Table: {
        emptyText: string;
        pageText: string;
        descend: string;
        ascend: string;
        cancelSort: string
    };
    Select: {
        emptyText: string;
        createText: string
    };
    Cascader: {
        emptyText: string
    };
    Tree: {
        emptyText: string;
        searchPlaceholder: string
    };
    List: {
        emptyText: string
    };
    Calendar: {
        allDay: string;
        AM: string;
        PM: string;
        datestring: string;
        remaining: string
    };
    Upload: {
        mainText: string;
        illegalTips: string;
        legalTips: string;
        retry: string;
        clear: string;
        selectedFiles: string;
        replace: string;
        illegalSize: string;
        fail: string
    };
    TreeSelect: {
        searchPlaceholder: string
    };
    Typography: {
        copy: string;
        copied: string;
        expand: string;
        collapse: string
    };
    Transfer: {
        emptyLeft: string;
        emptySearch: string;
        emptyRight: string;
        placeholder: string;
        clear: string;
        selectAll: string;
        clearSelectAll: string;
        total: string;
        selected: string
    };
    Form: {
        optional: string
    };
    Image: {
        preview: string;
        loading: string;
        loadError: string;
        prevTip: string;
        nextTip: string;
        zoomInTip: string;
        zoomOutTip: string;
        rotateTip: string;
        downloadTip: string;
        adaptiveTip: string;
        originTip: string
    };
    Chat: {
        deleteConfirm: string;
        clearContext: string;
        copySuccess: string;
        stop: string;
        copy: string;
        copied: string;
        dropAreaText: string
    };
    UserGuide: {
        skip: string;
        next: string;
        prev: string;
        finish: string
    };
    InputNumber: {
    };
    JsonViewer: {
        search: string;
        replace: string;
        replaceAll: string
    };
    VideoPlayer: {
        rateChange: string;
        qualityChange: string;
        routeChange: string;
        mirror: string;
        cancelMirror: string;
        loading: string;
        stall: string;
        noResource: string;
        videoError: string
    };
    AIChatDialogue: {
        delete: string;
        deleteConfirm: string;
        deleteContent: string;
        copySuccess: string;
        loading: string;
        reasoning: {
            completed: string;
            thinking: string
        };
        annotationText: string
    };
    Feedback: {
        submit: string;
        cancel: string
    };
    AIChatInput: {
        template: string;
        configure: string;
        selected: string
    }
}