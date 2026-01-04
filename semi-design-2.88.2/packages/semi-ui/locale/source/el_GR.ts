import { el } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'el-GR',
    dateFnsLocale: el,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Στοιχεία ανά σελίδα: ${pageSize}',
        total: 'Σύνολο σελίδων: ${total}',
        jumpTo: 'Μετάβαση σε',
        page: ' σελίδα',
    },
    Modal: {
        confirm: 'Επιβεβαίωση',
        cancel: 'Ακύρωση',
    },
    Tabs: {
        more: "Περισσότερα"
    },
    TimePicker: {
        placeholder: {
            time: 'Επιλογή ώρας',
            timeRange: 'Επιλογή εύρους ώρας',
        },
        begin: 'Ώρα έναρξης',
        end: 'Ώρα λήξης',
        hour: '',
        minute: '',
        second: '',
        AM: 'ΠΜ',
        PM: 'ΜΜ',
    },
    DatePicker: {
        placeholder: {
            date: 'Επιλογή ημερομηνίας',
            dateTime: 'Επιλογή ημερομηνίας και ώρας',
            dateRange: ['Ημερομηνία έναρξης', 'Ημερομηνία λήξης'],
            dateTimeRange: ['Ημερομηνία έναρξης', 'Ημερομηνία λήξης'],
            monthRange: ['Μήνας έναρξης', 'Μήνας λήξης'],
        },
        presets: 'Προεπιλογές',
        footer: {
            confirm: 'Επιβεβαίωση',
            cancel: 'Ακύρωση',
        },
        selectDate: 'Επιλογή ημερομηνίας',
        selectTime: 'Επιλογή ώρας',
        year: 'έτος',
        month: 'μήνας',
        day: 'ημέρα',
        monthText: '${month} ${year}',
        months: {
            1: 'Ιαν.',
            2: 'Φεβ.',
            3: 'Μάρ.',
            4: 'Απρ.',
            5: 'Μάιος',
            6: 'Ιούν.',
            7: 'Ιούλ.',
            8: 'Αύγ.',
            9: 'Σεπ.',
            10: 'Οκτ.',
            11: 'Νοέμ.',
            12: 'Δεκ.',
        },
        fullMonths: {
            1: 'Ιανουάριος',
            2: 'Φεβρουάριος',
            3: 'Μάρτιος',
            4: 'Απρίλιος',
            5: 'Μάιος',
            6: 'Ιούνιος',
            7: 'Ιούλιος',
            8: 'Αύγουστος',
            9: 'Σεπτέμβριος',
            10: 'Οκτώβριος',
            11: 'Νοέμβριος',
            12: 'Δεκέμβριος',
        },
        weeks: {
            Mon: 'Δευτ.',
            Tue: 'Τρ.',
            Wed: 'Τετ.',
            Thu: 'Πέμ.',
            Fri: 'Παρ.',
            Sat: 'Σάβ.',
            Sun: 'Κυρ.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'ηη/ΜΜ/εεεε',
        },
    },
    Popconfirm: {
        confirm: 'Επιβεβαίωση',
        cancel: 'Ακύρωση',
    },
    Navigation: {
        collapseText: 'Σύμπτυξη πλαϊνής γραμμής',
        expandText: 'Ανάπτυξη πλαϊνής γραμμής',
    },
    Table: {
        emptyText: 'Δεν υπάρχουν αποτελέσματα',
        pageText: 'Εμφάνιση ${currentStart} έως ${currentEnd} από ${total}',
        descend: 'Κάντε κλικ για φθίνουσα σειρά',
        ascend: 'Κάντε κλικ για αύξουσα σειρά',
        cancelSort: 'Ακύρωση ταξινόμησης',
    },
    Select: {
        emptyText: 'Δεν υπάρχουν αποτελέσματα',
        createText: 'Δημιουργία',
    },
    Cascader: {
        emptyText: 'Δεν υπάρχουν αποτελέσματα',
    },
    Tree: {
        emptyText: 'Δεν υπάρχουν αποτελέσματα',
        searchPlaceholder: 'Αναζήτηση',
    },
    List: {
        emptyText: 'Δεν υπάρχουν αποτελέσματα',
    },
    Calendar: {
        allDay: 'Όλη την ημέρα',
        AM: '${time} ΠΜ',
        PM: '${time} ΜΜ',
        datestring: '',
        remaining: '${remained} ακόμα',
    },
    Upload: {
        mainText: 'Κάντε κλικ για μεταφόρτωση του αρχείου ή σύρετε το αρχείο εδώ',
        illegalTips: 'Αυτός ο τύπος αρχείου δεν υποστηρίζεται',
        legalTips: 'Αποδέσμευση και έναρξη μεταφόρτωσης',
        retry: 'Επανάληψη',
        replace: 'Αντικατάσταση αρχείου',
        clear: 'Διαγραφή',
        selectedFiles: 'Επιλεγμένα αρχεία',
        illegalSize: 'Παράτυπο μέγεθος αρχείου',
        fail: 'Αποτυχία μεταφόρτωσης',
    },
    TreeSelect: {
        searchPlaceholder: 'Αναζήτηση',
    },
    Typography: {
        copy: 'Αντιγραφή',
        copied: 'Αντιγράφηκε',
        expand: 'Ανάπτυξη',
        collapse: 'Σύμπτυξη',
    },
    Transfer: {
        emptyLeft: 'Δεν υπάρχουν δεδομένα',
        emptySearch: 'Δεν υπάρχουν αποτελέσματα αναζήτησης',
        emptyRight: 'Δεν υπάρχει περιεχόμενο, επιλέξτε από τα αριστερά',
        placeholder: 'Αναζήτηση',
        clear: 'Διαγραφή',
        selectAll: 'Επιλογή όλων',
        clearSelectAll: 'Αποεπιλογή όλων',
        total: 'Σύνολο στοιχείων: ${total}',
        selected: 'Επιλεγμένα στοιχεία: ${total}',
    },
    Form: {
        optional: '(προαιρετικό)',
    },
    Image: {
        preview: 'Προεπισκόπηση',
        loading: 'Γίνεται φόρτωση',
        loadError: 'Η φόρτωση απέτυχε',
        prevTip: 'Προηγούμενο',
        nextTip: 'Επόμενο',
        zoomInTip: 'Μεγέθυνση',
        zoomOutTip: 'Σμίκρυνση',
        rotateTip: 'Περιστροφή',
        downloadTip: 'Λήψη',
        adaptiveTip: 'Προσαρμογή στη σελίδα',
        originTip: 'Αρχικό μέγεθος',
    },
    Chat: {
        deleteConfirm: 'Θέλετε σίγουρα να διαγράψετε αυτήν τη συνεδρία;',
        clearContext: 'Το περιεχόμενο διαγράφηκε',
        copySuccess: 'Επιτυχής αντιγραφή.',
        stop: 'Διακοπή',
        copy: 'Αντιγραφή',
        copied: 'Αντιγράφηκε',
        dropAreaText: 'Τοποθετήστε το αρχείο εδώ',
    },
    UserGuide: {
        skip: 'Παράλειψη',
        next: 'Επόμενο',
        prev: 'Προηγ.',
        finish: 'Ολοκλήρωση',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Αναζήτηση',
        replace: 'Αντικατάσταση',
        replaceAll: 'Αντικατάσταση όλων',
    },
    VideoPlayer: {
        rateChange: 'Αλλαγή ταχύτητας σε ${rate}',
        qualityChange: 'Αλλαγή ποιότητας σε ${quality}',
        routeChange: 'Αλλαγή διαδρομής σε ${route}',
        mirror: 'Κατοπτρισμός',
        cancelMirror: 'Ακύρωση κατοπτρισμού',
        loading: 'Φόρτωση…',
        stall: 'Ανεπιτυχής φόρτωση',
        noResource: 'Δεν υπάρχουν πόροι',
        videoError: 'Σφάλμα φόρτωσης βίντεο',
    },
    AIChatDialogue: {
        delete: 'Διαγραφή',
        deleteConfirm: 'Θέλετε σίγουρα να διαγράψετε αυτό το μήνυμα;',
        deleteContent: 'Αυτό το μήνυμα θα διαγραφεί οριστικά και δεν θα μπορεί να ανακτηθεί.',
        copySuccess: 'Επιτυχής αντιγραφή',
        loading: 'Φόρτωση…',
        reasoning: {
            completed: 'Η συλλογιστική ολοκληρώθηκε',
            thinking: 'Σκέφτομαι…'
        },
        annotationText: 'πληροφορίες'
    },
    Feedback: {
        submit: 'Υποβολή',
        cancel: 'Ακύρωση'
    },
    AIChatInput: {
        template: 'Πρότυπο',
        configure: 'Ρύθμιση',
        selected: 'Έγινε επιλογή ${count} στοιχείων',
    }
};

export default local;