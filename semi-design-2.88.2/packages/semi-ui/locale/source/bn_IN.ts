import { bn } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'bn-IN',
    dateFnsLocale: bn,
    currency: 'INR',
    Pagination: {
        pageSize: 'প্রতি পৃষ্ঠায় আইটেম: ${pageSize}',
        total: 'মোট পৃষ্ঠা: ${total}',
        jumpTo: 'জাম্প করে যান',
        page: ' পৃষ্ঠা',
    },
    Modal: {
        confirm: 'নিশ্চিত করুন',
        cancel: 'বাতিল করুন',
    },
    Tabs: {
        more: "আরও"
    },
    TimePicker: {
        placeholder: {
            time: 'সময় নির্বাচন করুন',
            timeRange: 'সময়ের পরিসর নির্বাচন করুন',
        },
        begin: 'শুরু হওয়ার সময়',
        end: 'শেষ হওয়ার সময়',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'তারিখ নির্বাচন করুন',
            dateTime: 'তারিখ এবং সময় নির্বাচন করুন',
            dateRange: ['শুরু হওয়ার তারিখ', 'শেষ হওয়ার তারিখ'],
            dateTimeRange: ['শুরু হওয়ার তারিখ', 'শেষ হওয়ার তারিখ'],
            monthRange: ['শুরু হওয়ার মাস', 'শেষ হওয়ার মাস'],
        },
        presets: 'প্রিসেট',
        footer: {
            confirm: 'নিশ্চিত করুন',
            cancel: 'বাতিল করুন',
        },
        selectDate: 'তারিখ নির্বাচন করুন',
        selectTime: 'সময় নির্বাচন করুন',
        year: 'বছর',
        month: 'মাস',
        day: 'দিন',
        monthText: '${month} ${year}',
        months: {
            1: 'জানুয়ারি',
            2: 'ফেব্রুয়ারি',
            3: 'মার্চ',
            4: 'এপ্রিল',
            5: 'মে',
            6: 'জুন',
            7: 'জুলাই',
            8: 'আগস্ট',
            9: 'সেপ্টেম্বর',
            10: 'অক্টোবর',
            11: 'নভেম্বর',
            12: 'ডিসেম্বর',
        },
        fullMonths: {
            1: 'জানুয়ারি',
            2: 'ফেব্রুয়ারি',
            3: 'মার্চ',
            4: 'এপ্রিল',
            5: 'মে',
            6: 'জুন',
            7: 'জুলাই',
            8: 'আগস্ট',
            9: 'সেপ্টেম্বর',
            10: 'অক্টোবর',
            11: 'নভেম্বর',
            12: 'ডিসেম্বর',
        },
        weeks: {
            Mon: 'সোম',
            Tue: 'মঙ্গল',
            Wed: 'বুধ',
            Thu: 'বৃহস্পতি',
            Fri: 'শুক্র',
            Sat: 'শনি',
            Sun: 'রবি',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'DD/mm/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'নিশ্চিত করুন',
        cancel: 'বাতিল করুন',
    },
    Navigation: {
        collapseText: 'সাইডবার বন্ধ করুন',
        expandText: 'সাইডবার প্রসারিত করুন',
    },
    Table: {
        emptyText: 'কোনো ফলাফল নেই',
        pageText: '${total}-এর ${currentStart} থেকে ${currentEnd} দেখানো হচ্ছে',
        descend: 'অধঃক্রমে ক্লিক করুন',
        ascend: 'উর্ধ্বক্রমে ক্লিক করুন',
        cancelSort: 'বাছাই বাতিল করুন',
    },
    Select: {
        emptyText: 'কোনো ফলাফল নেই',
        createText: 'তৈরি করুন',
    },
    Cascader: {
        emptyText: 'কোনো ফলাফল নেই',
    },
    Tree: {
        emptyText: 'কোনো ফলাফল নেই',
        searchPlaceholder: 'অনুসন্ধান করুন',
    },
    List: {
        emptyText: 'কোনো ফলাফল নেই',
    },
    Calendar: {
        allDay: 'সারাদিন',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: 'আরও ${remained}',
    },
    Upload: {
        mainText: 'ফাইল আপলোড করতে ক্লিক করুন বা ফাইলটি এখানে টেনে আনুন',
        illegalTips: 'এই ধরনের ফাইল সমর্থিত নয়',
        legalTips: 'ছেড়ে দিয়ে আপলোড শুরু করুন',
        retry: 'পুনরায় চেষ্টা করুন',
        replace: 'ফাইল প্রতিস্থাপন করুন',
        clear: 'মুছে ফেলুন',
        selectedFiles: 'নির্বাচিত ফাইল',
        illegalSize: 'অবৈধ ফাইলের আকার',
        fail: 'আপলোড ব্যর্থ হয়েছে',
    },
    TreeSelect: {
        searchPlaceholder: 'অনুসন্ধান করুন',
    },
    Typography: {
        copy: 'কপি করুন',
        copied: 'কপি করা হয়েছে',
        expand: 'প্রসারিত করুন',
        collapse: 'বন্ধ করুন',
    },
    Transfer: {
        emptyLeft: 'কোনো ডেটা নেই',
        emptySearch: 'কোনো অনুসন্ধানের ফলাফল নেই',
        emptyRight: 'কোনো কন্টেন্ট নেই, বাম থেকে চেক করুন',
        placeholder: 'অনুসন্ধান করুন',
        clear: 'মুছে ফেলুন',
        selectAll: 'সব নির্বাচন করুন',
        clearSelectAll: 'সব নির্বাচন বাতিল করুন',
        total: 'মোট আইটেম: ${total}',
        selected: 'আইটেম নির্বাচন করা হয়েছে: ${total}',
    },
    Form: {
        optional: '(ঐচ্ছিক)',
    },
    Image: {
        preview: 'প্রিভিউ',
        loading: 'লোড হচ্ছে',
        loadError: 'লোড করতে ব্যর্থ হয়েছে',
        prevTip: 'পূর্ববর্তী',
        nextTip: 'পরবর্তী',
        zoomInTip: 'জুম ইন করুন',
        zoomOutTip: 'জুম আউট করুন',
        rotateTip: 'ঘোরান',
        downloadTip: 'ডাউনলোড করুন',
        adaptiveTip: 'পৃষ্ঠার সাথে খাপ খাইয়ে নিন',
        originTip: 'আসল আকার',
    },
    Chat: {
        deleteConfirm: 'আপনি কি এই সেশন মুছে ফেলার বিষয়ে নিশ্চিত?',
        clearContext: 'প্রসঙ্গ মুছে ফেলা হয়েছে',
        copySuccess: 'কপি করা সফল হয়েছে।',
        stop: 'বন্ধ করুন',
        copy: 'কপি করুন',
        copied: 'কপি করা হয়েছে',
        dropAreaText: 'ফাইলটি এখানে রাখুন',
    },
    UserGuide: {
        skip: 'এড়িয়ে যান',
        next: 'পরবর্তী',
        prev: 'পূর্ববর্তী',
        finish: 'শেষ করুন',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'অনুসন্ধান করুন',
        replace: 'প্রতিস্থাপন করুন',
        replaceAll: 'সব প্রতিস্থাপন করুন',
    },
    VideoPlayer: {
        rateChange: 'রেট ${rate}-এ পরিবর্তন করুন',
        qualityChange: 'গুণমান ${quality}-এ পরিবর্তন করুন',
        routeChange: 'রুট ${route}-এ পরিবর্তন করুন',
        mirror: 'মিরর',
        cancelMirror: 'মিরর বাতিল করুন',
        loading: 'লোড হচ্ছে...',
        stall: 'লোডিং ব্যর্থ হয়েছে',
        noResource: 'কোনো রিসোর্স নেই',
        videoError: 'ভিডিও লোড করার ক্ষেত্রে ত্রুটি',
    },
    AIChatDialogue: {
        delete: 'মুছে ফেলুন',
        deleteConfirm: 'আপনি কি এই বার্তা মুছে ফেলার বিষয়ে নিশ্চিত?',
        deleteContent: 'এই বার্তাটি স্থায়ীভাবে মুছে ফেলা হবে এবং পুনরুদ্ধার করা যাবে না।',
        copySuccess: 'কপি করা সফল হয়েছে',
        loading: 'লোড হচ্ছে...',
        reasoning: {
            completed: 'কারণ বিশ্লেষণ সম্পন্ন হয়েছে',
            thinking: 'চিন্তা করা হচ্ছে...'
        },
        annotationText: 'তথ্যের অংশবিশেষ'
    },
    Feedback: {
        submit: 'জমা দিন',
        cancel: 'বাতিল করুন'
    },
    AIChatInput: {
        template: 'টেমপ্লেট',
        configure: 'কনফিগার করুন',
        selected: '${count}টি আইটেম নির্বাচন করা হয়েছে',
    }
};

// [i18n-Bengali]
export default local;