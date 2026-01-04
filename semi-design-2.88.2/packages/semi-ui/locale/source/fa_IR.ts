import { faIR } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'fa-IR',
    dateFnsLocale: faIR,
    currency: 'دلار آمریکا',
    Pagination: {
        pageSize: 'تعداد موارد در هر صفحه: ${pageSize}',
        total: 'کل صفحات: ${total}',
        jumpTo: 'پرش به',
        page: ' صفحه',
    },
    Modal: {
        confirm: 'تأیید',
        cancel: 'لغو',
    },
    Tabs: {
        more: "بیشتر"
    },
    TimePicker: {
        placeholder: {
            time: 'انتخاب زمان',
            timeRange: 'انتخاب بازه زمانی',
        },
        begin: 'زمان شروع',
        end: 'زمان پایان',
        hour: '',
        minute: '',
        second: '',
        AM: 'صبح',
        PM: 'بعدازظهر',
    },
    DatePicker: {
        placeholder: {
            date: 'انتخاب تاریخ',
            dateTime: 'انتخاب تاریخ و زمان',
            dateRange: ['تاریخ شروع', 'تاریخ پایان'],
            dateTimeRange: ['تاریخ شروع', 'تاریخ پایان'],
            monthRange: ['ماه شروع', 'ماه پایان'],
        },
        presets: 'تنظیمات پیش‌فرض',
        footer: {
            confirm: 'تأیید',
            cancel: 'لغو',
        },
        selectDate: 'انتخاب تاریخ',
        selectTime: 'انتخاب زمان',
        year: 'سال',
        month: 'ماه',
        day: 'روز',
        monthText: '${month} ${year}',
        months: {
            1: 'ژانویه',
            2: 'فوریه',
            3: 'مارس',
            4: 'آوریل',
            5: 'مه',
            6: 'ژوئن',
            7: 'ژوئيه',
            8: 'اوت',
            9: 'سپتامبر',
            10: 'اکتبر',
            11: 'نوامبر',
            12: 'دسامبر',
        },
        fullMonths: {
            1: 'ژانویه',
            2: 'فوریه',
            3: 'مارس',
            4: 'آوریل',
            5: 'مه',
            6: 'ژوئن',
            7: 'ژوئيه',
            8: 'اوت',
            9: 'سپتامبر',
            10: 'اکتبر',
            11: 'نوامبر',
            12: 'دسامبر',
        },
        weeks: {
            Mon: 'دوشنبه',
            Tue: 'سه‌شنبه',
            Wed: 'چهارشنبه',
            Thu: 'پنجشنبه',
            Fri: 'جمعه',
            Sat: 'شنبه',
            Sun: 'یکشنبه',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'ماه/روز/سال',
        },
    },
    Popconfirm: {
        confirm: 'تأیید',
        cancel: 'لغو',
    },
    Navigation: {
        collapseText: 'جمع کردن نوار کناری',
        expandText: 'باز کردن نوار کناری',
    },
    Table: {
        emptyText: 'نتیجه‌ای وجود ندارد',
        pageText: 'نمایش ${currentStart} تا ${currentEnd} از ${total}',
        descend: 'کلیک برای مرتب‌سازی نزولی',
        ascend: 'کلیک برای مرتب‌سازی صعودی',
        cancelSort: 'لغو مرتب‌سازی',
    },
    Select: {
        emptyText: 'نتیجه‌ای وجود ندارد',
        createText: 'ایجاد',
    },
    Cascader: {
        emptyText: 'نتیجه‌ای وجود ندارد',
    },
    Tree: {
        emptyText: 'نتیجه‌ای وجود ندارد',
        searchPlaceholder: 'جست‌وجو',
    },
    List: {
        emptyText: 'نتیجه‌ای وجود ندارد',
    },
    Calendar: {
        allDay: 'کل روز',
        AM: '${time} صبح',
        PM: '${time} بعدازظهر',
        datestring: '',
        remaining: '${remained} رویداد دیگر',
    },
    Upload: {
        mainText: 'برای آپلود فایل کلیک کنید یا فایل را به اینجا بکشید',
        illegalTips: 'این نوع فایل پشتیبانی نمی‌شود',
        legalTips: 'انتشار و شروع آپلود',
        retry: 'امتحان دوباره',
        replace: 'جایگزین کردن فایل',
        clear: 'پاک کردن',
        selectedFiles: 'فایل‌های انتخاب‌شده',
        illegalSize: 'حجم فایل غیرمجاز',
        fail: 'آپلود نشد',
    },
    TreeSelect: {
        searchPlaceholder: 'جست‌وجو',
    },
    Typography: {
        copy: 'کپی',
        copied: 'کپی شد',
        expand: 'باز کردن',
        collapse: 'جمع کردن',
    },
    Transfer: {
        emptyLeft: 'داده‌ای موجود نیست',
        emptySearch: 'هیچ نتیجه‌ای برای جست و جو وجود ندارد',
        emptyRight: 'محتوایی وجود ندارد، از سمت چپ بررسی کنید',
        placeholder: 'جست‌وجو',
        clear: 'پاک کردن',
        selectAll: 'انتخاب همه',
        clearSelectAll: 'لغو انتخاب همه',
        total: 'تعداد کل موارد: ${total}',
        selected: 'موارد انتخاب‌شده: ${total}',
    },
    Form: {
        optional: '(اختیاری)',
    },
    Image: {
        preview: 'پیش‌نمایش',
        loading: 'در حال بارگذاری',
        loadError: 'بارگذاری انجام نشد',
        prevTip: 'قبلی',
        nextTip: 'بعدی',
        zoomInTip: 'بزرگ‌نمایی',
        zoomOutTip: 'کوچک‌نمایی',
        rotateTip: 'چرخش',
        downloadTip: 'دانلود',
        adaptiveTip: 'تطبیق با اندازه صفحه',
        originTip: 'اندازه اصلی',
    },
    Chat: {
        deleteConfirm: 'از حذف این جلسه مطمئنید؟',
        clearContext: 'متن پاک شد',
        copySuccess: 'کپی با موفقیت انجام شد.',
        stop: 'توقف',
        copy: 'کپی',
        copied: 'کپی شد',
        dropAreaText: 'فایل را اینجا قرار دهید',
    },
    UserGuide: {
        skip: 'رد کردن',
        next: 'بعدی',
        prev: 'قبلی',
        finish: 'پایان',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'جست‌وجو',
        replace: 'جایگزین کردن',
        replaceAll: 'جایگزین کردن همه',
    },
    VideoPlayer: {
        rateChange: 'تغییر سرعت پخش به ${rate}',
        qualityChange: 'تغییر کیفیت به ${quality}',
        routeChange: 'تغییر مسیر به ${route}',
        mirror: 'حالت آینه‌ای',
        cancelMirror: 'لغو حالت آینه‌ای',
        loading: 'در حال بارگذاری…',
        stall: 'بارگذاری انجام نشد',
        noResource: 'منبعی وجود ندارد',
        videoError: 'خطای بارگذاری ویدئو',
    },
    AIChatDialogue: {
        delete: 'حذف',
        deleteConfirm: 'از حذف این پیام مطمئنید؟',
        deleteContent: 'این پیام برای همیشه حذف می‌شود و قابل‌بازیابی نیست.',
        copySuccess: 'کپی با موفقیت انجام شد',
        loading: 'در حال بارگذاری...',
        reasoning: {
            completed: 'استدلال تکمیل شد',
            thinking: 'در حال فکر کردن...'
        },
        annotationText: 'تکه‌های اطلاعات'
    },
    Feedback: {
        submit: 'ارسال',
        cancel: 'لغو'
    },
    AIChatInput: {
        template: 'قالب',
        configure: 'پیکربندی',
        selected: 'مواردی {count} دلاری انتخاب‌شده',
    }
};

export default local;