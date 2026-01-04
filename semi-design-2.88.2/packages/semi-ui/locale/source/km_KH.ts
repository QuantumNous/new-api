import { km } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'km-KH',
    dateFnsLocale: km,
    currency: 'ដុល្លារអាម៉េរិក',
    Pagination: {
        pageSize: 'ធាតុក្នុងមួយទំព័រ៖ ${pageSize}',
        total: 'ទំព័រសរុប៖ ${total}',
        jumpTo: 'រំលងទៅ',
        page: ' ទំព័រ',
    },
    Modal: {
        confirm: 'បញ្ជាក់',
        cancel: 'បោះបង់',
    },
    Tabs: {
        more: "ច្រើន​ទៀត"
    },
    TimePicker: {
        placeholder: {
            time: 'ជ្រើសរើស​រយៈពេល',
            timeRange: 'ជ្រើសរើសចន្លោះពេលវេលា',
        },
        begin: 'ម៉ោងចាប់ផ្ដើម',
        end: 'ម៉ោង​បញ្ចប់',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'ជ្រើសរើស​កាលបរិច្ឆេទ',
            dateTime: 'ជ្រើសរើសកាលបរិច្ឆេទ និងពេលវេលា',
            dateRange: ['កាលបរិច្ឆេទចាប់ផ្ដើម', 'កាលបរិច្ឆេទបញ្ចប់'],
            dateTimeRange: ['កាលបរិច្ឆេទចាប់ផ្ដើម', 'កាលបរិច្ឆេទបញ្ចប់'],
            monthRange: ['ខែ​ចាប់ផ្ដើម', 'ខែ​បញ្ចប់'],
        },
        presets: 'ការកំណត់ជាមុន',
        footer: {
            confirm: 'បញ្ជាក់',
            cancel: 'បោះបង់',
        },
        selectDate: 'ជ្រើសរើស​កាលបរិច្ឆេទ',
        selectTime: 'ជ្រើស​រើសម៉ោង',
        year: 'ឆ្នាំ',
        month: 'ខែ',
        day: 'ថ្ងៃ',
        monthText: '${month} ${year}',
        months: {
            1: 'មករា',
            2: 'កុម្ភៈ',
            3: 'មីនា',
            4: 'មេសា',
            5: 'ឧសភា',
            6: 'មិថុនា',
            7: 'កក្កដា',
            8: 'សីហា',
            9: 'កញ្ញា',
            10: 'តុលា',
            11: 'វិច្ឆិកា',
            12: 'ធ្នូ',
        },
        fullMonths: {
            1: 'មករា',
            2: 'កុម្ភៈ',
            3: 'មីនា',
            4: 'មេសា',
            5: 'ឧសភា',
            6: 'មិថុនា',
            7: 'កក្កដា',
            8: 'សីហា',
            9: 'ខែកញ្ញា',
            10: 'តុលា',
            11: 'វិច្ឆិកា',
            12: 'ធ្នូ',
        },
        weeks: {
            Mon: 'ចន្ទ',
            Tue: 'អង្គារ',
            Wed: 'ពុធ',
            Thu: 'ព្រហស្បតិ៍',
            Fri: 'សុក្រ',
            Sat: 'សៅរ៍',
            Sun: 'អាទិត្យ',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'ថ្ងៃ/ខែ/ឆ្នាំ',
        },
    },
    Popconfirm: {
        confirm: 'បញ្ជាក់',
        cancel: 'បោះបង់',
    },
    Navigation: {
        collapseText: 'បង្រួមរបារចំហៀង',
        expandText: 'ពង្រីករបារចំហៀង',
    },
    Table: {
        emptyText: 'គ្មានលទ្ធផល',
        pageText: 'បង្ហាញ ${currentStart} ដល់ ${currentEnd} នៃ ${total}',
        descend: 'ចុចដើម្បីតម្រៀបចុះ',
        ascend: 'ចុចដើម្បីតម្រៀបឡើង',
        cancelSort: 'បោះបង់ការតម្រៀប',
    },
    Select: {
        emptyText: 'គ្មានលទ្ធផល',
        createText: 'បង្កើត',
    },
    Cascader: {
        emptyText: 'គ្មានលទ្ធផល',
    },
    Tree: {
        emptyText: 'គ្មានលទ្ធផល',
        searchPlaceholder: 'ស្វែងរក',
    },
    List: {
        emptyText: 'គ្មានលទ្ធផល',
    },
    Calendar: {
        allDay: 'ពេញមួយថ្ងៃ',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} ច្រើនទៀត',
    },
    Upload: {
        mainText: 'ចុច ដើម្បីបង្ហោះឯកសារ ឬចាប់អូសឯកសារមកទីនេះ',
        illegalTips: 'ប្រភេទឯកសារនេះមិនអាចប្រើបានទេ',
        legalTips: 'ចេញផ្សាយ និងចាប់ផ្ដើមបង្ហោះ',
        retry: 'ព្យាយាមម្ដងទៀត',
        replace: 'ជំនួសឯកសារ',
        clear: 'សម្អាត',
        selectedFiles: 'ឯកសារដែលបានជ្រើសរើស',
        illegalSize: 'ទំហំឯកសារខុសច្បាប់',
        fail: 'ការបង្ហោះមិនសម្រេច',
    },
    TreeSelect: {
        searchPlaceholder: 'ស្វែងរក',
    },
    Typography: {
        copy: 'ចម្លង',
        copied: 'បានចម្លង',
        expand: 'ពង្រីក',
        collapse: 'បង្រួម',
    },
    Transfer: {
        emptyLeft: 'គ្មានទិន្នន័យ',
        emptySearch: 'គ្មានលទ្ធផលស្វែងរកទេ',
        emptyRight: 'មិនមានខ្លឹមសារទេ សូមពិនិត្យមើលពីខាងឆ្វេង',
        placeholder: 'ស្វែងរក',
        clear: 'សម្អាត',
        selectAll: 'ជ្រើស​រើសទាំងអស់',
        clearSelectAll: 'ដក​ការ​ជ្រើសរើស​ទាំងអស់',
        total: 'ធាតុសរុប៖ ${total}',
        selected: 'ធាតុដែលបានជ្រើសរើស៖ ${total}',
    },
    Form: {
        optional: '(មិនតម្រូវ)',
    },
    Image: {
        preview: 'មើលជាមុន',
        loading: 'កំពុង​ផ្ទុក',
        loadError: 'មិនអាចផ្ទុកបានទេ',
        prevTip: 'ពីមុន',
        nextTip: 'បន្ទាប់',
        zoomInTip: 'ពង្រីក',
        zoomOutTip: 'បង្រួម',
        rotateTip: 'បង្វិល',
        downloadTip: 'ទាញយក',
        adaptiveTip: 'សម្របទៅនឹងទំព័រ',
        originTip: 'ទំហំដើម',
    },
    Chat: {
        deleteConfirm: 'តើអ្នកប្រាកដថា អ្នកចង់លុបវគ្គនេះឬ?',
        clearContext: 'បានសម្អាតបរិបទ',
        copySuccess: 'ចម្លងដោយជោគជ័យ។',
        stop: 'បញ្ឈប់',
        copy: 'ចម្លង',
        copied: 'បានចម្លង',
        dropAreaText: 'ដាក់ឯកសារនៅទីនេះ',
    },
    UserGuide: {
        skip: 'រំលង',
        next: 'បន្ទាប់',
        prev: 'ពីមុន',
        finish: 'បញ្ចប់',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'ស្វែងរក',
        replace: 'ជំនួស',
        replaceAll: 'ជំនួសទាំងអស់',
    },
    VideoPlayer: {
        rateChange: 'ប្ដូរអត្រាទៅ ${rate}',
        qualityChange: 'ប្ដូរគុណភាពទៅ ${quality}',
        routeChange: 'ប្ដូរផ្លូវទៅ ${route}',
        mirror: 'កញ្ចក់',
        cancelMirror: 'បោះបង់កញ្ចក់',
        loading: 'កំពុងផ្ទុក...',
        stall: 'ការផ្ទុកមិនបានសម្រេច',
        noResource: 'គ្មានធនធាន',
        videoError: 'មានបញ្ហាក្នុងការផ្ទុកវីដេអូ',
    },
    AIChatDialogue: {
        delete: 'លុប',
        deleteConfirm: 'តើអ្នកប្រាកដទេថាចង់លុបសារនេះ?',
        deleteContent: 'សារនេះនឹងត្រូវបានលុបជាអចិន្ត្រៃយ៍ និងមិនអាចស្ដារបានទេ។',
        copySuccess: 'ចម្លងដោយជោគជ័យ',
        loading: 'កំពុងផ្ទុក...',
        reasoning: {
            completed: 'បានបញ្ចប់ការរកហេតុផល',
            thinking: 'កំពុងគិត...'
        },
        annotationText: 'ព័ត៌មាន'
    },
    Feedback: {
        submit: 'ដាក់បញ្ជូន',
        cancel: 'បោះបង់'
    },
    AIChatInput: {
        template: 'ពុម្ពគំរូ',
        configure: 'កំណត់រចនាសម្ព័ន្ធ',
        selected: 'បានជ្រើសរើសធាតុ ${count}',
    }
};

export default local;