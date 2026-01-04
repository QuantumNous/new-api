import { hi } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'hi-IN',
    dateFnsLocale: hi,
    currency: 'INR',
    Pagination: {
        pageSize: 'प्रति पेज आइटम्स: ${pageSize}',
        total: 'कुल पेज: ${total}',
        jumpTo: 'यहाँ जाएँ',
        page: ' पेज',
    },
    Modal: {
        confirm: 'पुष्टि करें',
        cancel: 'रद्द करें',
    },
    Tabs: {
        more: "ज़्यादा"
    },
    TimePicker: {
        placeholder: {
            time: 'समय चुनें',
            timeRange: 'समय की सीमा चुनें',
        },
        begin: 'शुरू होने का समय',
        end: 'समाप्त होने का समय',
        hour: '',
        minute: '',
        second: '',
        AM: 'सुबह',
        PM: 'शाम/रात',
    },
    DatePicker: {
        placeholder: {
            date: 'तारीख चुनें',
            dateTime: 'तारीख और समय चुनें',
            dateRange: ['शुरु होने की तारीख', 'समाप्त होने की तारीख'],
            dateTimeRange: ['शुरु होने की तारीख', 'समाप्त होने की तारीख'],
            monthRange: ['शुरु होने का महीना', 'समाप्त होने का महीना'],
        },
        presets: 'प्रीसेट्स',
        footer: {
            confirm: 'पुष्टि करें',
            cancel: 'रद्द करें',
        },
        selectDate: 'तारीख चुनें',
        selectTime: 'समय चुनें',
        year: 'वर्ष',
        month: 'महीना',
        day: 'दिन',
        monthText: '${month} ${year}',
        months: {
            1: 'जनवरी',
            2: 'फ़रवरी',
            3: 'मार्च',
            4: 'अप्रैल',
            5: 'मई',
            6: 'जून',
            7: 'जुलाई',
            8: 'अगस्त',
            9: 'सितंबर',
            10: 'अक्टूबर',
            11: 'नवंबर',
            12: 'दिसंबर',
        },
        fullMonths: {
            1: 'जनवरी',
            2: 'फरवरी',
            3: 'मार्च',
            4: 'अप्रैल',
            5: 'मई',
            6: 'जून',
            7: 'जुलाई',
            8: 'अगस्त',
            9: 'सितंबर',
            10: 'अक्टूबर',
            11: 'नवंबर',
            12: 'दिसंबर',
        },
        weeks: {
            Mon: 'सोम',
            Tue: 'मंगल',
            Wed: 'बुध',
            Thu: 'गुरु',
            Fri: 'शुक्र',
            Sat: 'शनि',
            Sun: 'रवि',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'माह/दिन/वर्ष',
        },
    },
    Popconfirm: {
        confirm: 'पुष्टि करें',
        cancel: 'रद्द करें',
    },
    Navigation: {
        collapseText: 'साइडबार को छोटा करें',
        expandText: 'साइडबार को बड़ा करें',
    },
    Table: {
        emptyText: 'कोई परिणाम नहीं',
        pageText: '${total} में से ${currentStart} से ${currentEnd} तक दिखाया जा रहा है',
        descend: 'नीचे जाने के लिए क्लिक करें',
        ascend: 'ऊपर जाने के लिए क्लिक करें',
        cancelSort: 'सॉर्टिंग रद्द करें',
    },
    Select: {
        emptyText: 'कोई परिणाम नहीं',
        createText: 'बनाएँ',
    },
    Cascader: {
        emptyText: 'कोई परिणाम नहीं',
    },
    Tree: {
        emptyText: 'कोई परिणाम नहीं',
        searchPlaceholder: 'खोजें',
    },
    List: {
        emptyText: 'कोई परिणाम नहीं',
    },
    Calendar: {
        allDay: 'पूरे दिन',
        AM: 'सुबह ${time} बजे',
        PM: 'दोपहर ${time} बजे',
        datestring: '',
        remaining: '${remained} अधिक',
    },
    Upload: {
        mainText: 'फ़ाइल अपलोड करने के लिए क्लिक करें या फ़ाइल को यहाँ खींचें',
        illegalTips: 'इस प्रकार की फ़ाइल समर्थित नहीं है',
        legalTips: 'रिलीज़ करें और अपलोड करना शुरू करें',
        retry: 'फिर से कोशिश करें',
        replace: 'फ़ाइल बदलें',
        clear: 'साफ करें',
        selectedFiles: 'चयनित फ़ाइलें',
        illegalSize: 'अवैध फ़ाइल साइज़',
        fail: 'अपलोड विफल',
    },
    TreeSelect: {
        searchPlaceholder: 'खोजें',
    },
    Typography: {
        copy: 'कॉपी करें',
        copied: 'कॉपी किया गया',
        expand: 'बड़ा करें',
        collapse: 'छोटा करें',
    },
    Transfer: {
        emptyLeft: 'कोई डेटा नहीं',
        emptySearch: 'कोई खोज परिणाम नहीं',
        emptyRight: 'कोई कॉन्टेंट नहीं, बाईं ओर से जाँचें',
        placeholder: 'खोजें',
        clear: 'साफ करें',
        selectAll: 'सभी को चुनें',
        clearSelectAll: 'सभी से चयन हटाएँ',
        total: 'कुल आइटम्स: ${total}',
        selected: 'चयनित आइटम्स: ${total}',
    },
    Form: {
        optional: '(वैकल्पिक)',
    },
    Image: {
        preview: 'पूर्वावलोकन',
        loading: 'लोड हो रहा है',
        loadError: 'लोड करने में विफल रहा',
        prevTip: 'पिछला',
        nextTip: 'अगला',
        zoomInTip: 'ज़ूम इन करें',
        zoomOutTip: 'ज़ूम आउट करें',
        rotateTip: 'घुमाएँ',
        downloadTip: 'डाउनलोड करें',
        adaptiveTip: 'पेज के अनुकूल बनाएँ',
        originTip: 'असली साइज़',
    },
    Chat: {
        deleteConfirm: 'क्या आप वाकई इस सेशन को डिलीट करना चाहते हैं?',
        clearContext: 'संदर्भ साफ़ किया गया',
        copySuccess: 'कॉपी सफल हुई।',
        stop: 'रोकें',
        copy: 'कॉपी करें',
        copied: 'कॉपी किया गया',
        dropAreaText: 'फ़ाइल यहाँ रखें',
    },
    UserGuide: {
        skip: 'छोड़ें',
        next: 'अगला',
        prev: 'पिछला',
        finish: 'पूरा करें',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'खोजें',
        replace: 'बदलें',
        replaceAll: 'सभी को बदलें',
    },
    VideoPlayer: {
        rateChange: 'दर को ${rate} पर स्विच करें',
        qualityChange: 'गुणवत्ता को ${quality} पर स्विच करें',
        routeChange: 'मार्ग को ${route} पर स्विच करें',
        mirror: 'मिरर',
        cancelMirror: 'मिरर रद्द करें',
        loading: 'लोड हो रहा है...',
        stall: 'लोड होना विफल हुआ',
        noResource: 'कोई संसाधन नहीं',
        videoError: 'वीडियो लोड एरर',
    },
    AIChatDialogue: {
        delete: 'डिलीट करें',
        deleteConfirm: 'क्या आप वाकई इस संदेश को डिलीट करना चाहते हैं?',
        deleteContent: 'यह संदेश स्थायी रूप से हटा दिया जाएगा और पुनर्प्राप्त नहीं किया जा सकता है।',
        copySuccess: 'कॉपी सफल हुई',
        loading: 'लोड हो रहा है...',
        reasoning: {
            completed: 'तर्क लगाना पूरा हुआ',
            thinking: 'सोच रहा है...'
        },
        annotationText: 'जानकारी के टुकड़े'
    },
    Feedback: {
        submit: 'सबमिट करें',
        cancel: 'रद्द करें'
    },
    AIChatInput: {
        template: 'टेंप्लेट',
        configure: 'कॉन्फ़िगर करें',
        selected: '${count} आइटम चुने गए',
    }
};

export default local;