import { he } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'he-IL',
    dateFnsLocale: he,
    currency: 'NIS',
    Pagination: {
        pageSize: 'פריטים לעמוד: ${pageSize}',
        total: 'סה"כ עמודים: ${total}',
        jumpTo: 'לעבור אל',
        page: ' עמוד',
    },
    Modal: {
        confirm: 'אישור',
        cancel: 'ביטול',
    },
    Tabs: {
        more: "עוד"
    },
    TimePicker: {
        placeholder: {
            time: 'בחירת שעה',
            timeRange: 'בחירת טווח שעות',
        },
        begin: 'שעת התחלה',
        end: 'שעת סיום',
        hour: '',
        minute: '',
        second: '',
        AM: 'לפנה"צ',
        PM: 'אחה"צ',
    },
    DatePicker: {
        placeholder: {
            date: 'בחירת תאריך',
            dateTime: 'בחירת תאריך ושעה',
            dateRange: ['תאריך התחלה', 'תאריך סיום'],
            dateTimeRange: ['תאריך התחלה', 'תאריך סיום'],
            monthRange: ['חודש התחלה', 'חודש סיום'],
        },
        presets: 'פריסטים',
        footer: {
            confirm: 'אישור',
            cancel: 'ביטול',
        },
        selectDate: 'בחירת תאריך',
        selectTime: 'בחירת שעה',
        year: 'שנה',
        month: 'חודש',
        day: 'יום',
        monthText: '${month} ${year}',
        months: {
            1: 'ינו\'',
            2: 'פבר\'',
            3: 'מרץ',
            4: 'אפר\'',
            5: 'מאי',
            6: 'יוני',
            7: 'יולי',
            8: 'אוג\'',
            9: 'ספט\'',
            10: 'אוק\'',
            11: 'נוב\'',
            12: 'דצמ\'',
        },
        fullMonths: {
            1: 'ינואר',
            2: 'פברואר',
            3: 'מרץ',
            4: 'אפריל',
            5: 'מאי',
            6: 'יוני',
            7: 'יולי',
            8: 'אוגוסט',
            9: 'ספטמבר',
            10: 'אוקטובר',
            11: 'נובמבר',
            12: 'דצמבר',
        },
        weeks: {
            Mon: 'יום ב\'',
            Tue: 'יום ג\'',
            Wed: 'יום ד\'',
            Thu: 'יום ה\'',
            Fri: 'יום ו\'',
            Sat: 'שבת',
            Sun: 'יום א\'',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'אישור',
        cancel: 'ביטול',
    },
    Navigation: {
        collapseText: 'מזעור סרגל הצד',
        expandText: 'הרחבת סרגל הצד',
    },
    Table: {
        emptyText: 'אין תוצאה',
        pageText: 'מציג ${currentStart} עד ${currentEnd} מתוך ${total}',
        descend: 'לחיצה למיון בסדר יורד',
        ascend: 'לחיצה למיון בסדר עולה',
        cancelSort: 'ביטול המיון',
    },
    Select: {
        emptyText: 'אין תוצאה',
        createText: 'יצירה',
    },
    Cascader: {
        emptyText: 'אין תוצאה',
    },
    Tree: {
        emptyText: 'אין תוצאה',
        searchPlaceholder: 'חיפוש',
    },
    List: {
        emptyText: 'אין תוצאה',
    },
    Calendar: {
        allDay: 'כל היום',
        AM: '${time} לפנה"צ',
        PM: '${time} אחה"צ',
        datestring: '',
        remaining: '${remained} נוספים',
    },
    Upload: {
        mainText: 'יש ללחוץ כדי להעלות את הקובץ או לגרור את הקובץ לכאן',
        illegalTips: 'סוג הקובץ הזה לא נתמך',
        legalTips: 'יש לשחרר ולהתחיל בהעלאה',
        retry: 'לנסות שנית',
        replace: 'להחליף קובץ',
        clear: 'ניקוי',
        selectedFiles: 'קבצים נבחרים',
        illegalSize: 'גודל הקובץ לא חוקי',
        fail: 'ההעלאה נכשלה',
    },
    TreeSelect: {
        searchPlaceholder: 'חיפוש',
    },
    Typography: {
        copy: 'להעתיק',
        copied: 'הועתק',
        expand: 'הרחב',
        collapse: 'כווץ',
    },
    Transfer: {
        emptyLeft: 'אין נתונים',
        emptySearch: 'אין תוצאות חיפוש',
        emptyRight: 'אין תוכן, לסמן מימין',
        placeholder: 'חיפוש',
        clear: 'ניקוי',
        selectAll: 'לבחור הכול',
        clearSelectAll: 'לבטל את בחירת הכול',
        total: 'סה"כ פריטים: ${total}',
        selected: 'פריטים נבחרים: ${total}',
    },
    Form: {
        optional: '‏(לא חובה)',
    },
    Image: {
        preview: 'תצוגה מקדימה',
        loading: 'בטעינה',
        loadError: 'הטעינה נכשלה',
        prevTip: 'הקודם',
        nextTip: 'הבא',
        zoomInTip: 'הגדלה',
        zoomOutTip: 'הקטנה',
        rotateTip: 'סיבוב',
        downloadTip: 'הורדה',
        adaptiveTip: 'התאמה לדף',
        originTip: 'גודל מקורי',
    },
    Chat: {
        deleteConfirm: 'בטוח שברצונך למחוק את ההפעלה הזו?',
        clearContext: 'ההקשר נמחק',
        copySuccess: 'ההעתקה בוצעה בהצלחה.',
        stop: 'עצירה',
        copy: 'להעתיק',
        copied: 'הועתק',
        dropAreaText: 'יש למקם את הקובץ כאן',
    },
    UserGuide: {
        skip: 'לדלג',
        next: 'הבא',
        prev: 'קודם',
        finish: 'סיום',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'חיפוש',
        replace: 'להחליף',
        replaceAll: 'להחליף הכול',
    },
    VideoPlayer: {
        rateChange: 'לשנות את הקצב ל-${rate}',
        qualityChange: 'לשנות את האיכות ל${quality}',
        routeChange: 'לשנות את המסלול ל-${route}',
        mirror: 'לשקף',
        cancelMirror: 'לבטל את השיקוף',
        loading: 'בטעינה...',
        stall: 'הטעינה נכשלה',
        noResource: 'אין משאב',
        videoError: 'שגיאה בטעינת הסרטון',
    },
    AIChatDialogue: {
        delete: 'למחוק',
        deleteConfirm: 'בטוח/ה שברצונך למחוק את ההודעה הזו?',
        deleteContent: 'ההודעה הזו תימחק לצמיתות ולא ניתן יהיה לשחזר אותה.',
        copySuccess: 'ההעתקה בוצעה בהצלחה',
        loading: 'בטעינה...',
        reasoning: {
            completed: 'ההנמקה הושלמה',
            thinking: 'במהלך חשיבה...'
        },
        annotationText: 'פיסות מידע'
    },
    Feedback: {
        submit: 'שליחה',
        cancel: 'ביטול'
    },
    AIChatInput: {
        template: 'תבנית',
        configure: 'הגדרת תצורה',
        selected: 'נבחרו ${count} פריטים',
    }
};

export default local;