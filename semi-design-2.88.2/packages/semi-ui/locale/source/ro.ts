import { ro } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ro',
    dateFnsLocale: ro,
    currency: 'RON',
    Pagination: {
        pageSize: 'Elemente per pagină: ${pageSize}',
        total: 'Total pagini: ${total}',
        jumpTo: 'Treci la',
        page: 'pagini',
    },
    Modal: {
        confirm: 'Confirmă',
        cancel: 'Anulează',
    },
    Tabs: {
        more: "Mai mult"
    },
    TimePicker: {
        placeholder: {
            time: 'Selectează timpul',
            timeRange: 'Selectează o perioadă de timp',
        },
        begin: 'Ora de începere',
        end: 'Ora de încheiere',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Selectează data',
            dateTime: 'Selectează data și ora',
            dateRange: ['Data de început', 'Data de sfârșit'],
            dateTimeRange: ['Data de început', 'Data de sfârșit'],
            monthRange: ['Luna de început', 'Luna de sfârșit'],
        },
        presets: 'Selecții rapide',
        footer: {
            confirm: 'Confirmă',
            cancel: 'Anulează',
        },
        selectDate: 'Selectează data',
        selectTime: 'Selectează timpul',
        year: 'an',
        month: 'lună',
        day: 'zi',
        monthText: '${month} ${year}',
        months: {
            1: 'Ian',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Mai',
            6: 'Iun',
            7: 'Iul',
            8: 'Aug',
            9: 'Sep',
            10: 'Oct',
            11: 'Noi',
            12: 'Dec',
        },
        fullMonths: {
            1: 'Ianuarie',
            2: 'Februarie',
            3: 'Martie',
            4: 'Aprilie',
            5: 'Mai',
            6: 'Iunie',
            7: 'Iulie',
            8: 'August',
            9: 'Septembrie',
            10: 'Octombrie',
            11: 'Noiembrie',
            12: 'Decembrie',
        },
        weeks: {
            Mon: 'Lun',
            Tue: 'Mar',
            Wed: 'Mie',
            Thu: 'Joi',
            Fri: 'Vin',
            Sat: 'Sâm',
            Sun: 'dum',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Confirmă',
        cancel: 'Anulează',
    },
    Navigation: {
        collapseText: 'Comprimă bara laterală',
        expandText: 'Extinde bara laterală',
    },
    Table: {
        emptyText: 'Nici un rezultat',
        pageText: 'Arată ${currentStart} la ${currentEnd} de ${total}',
        descend: 'Faceți clic pentru a coborî',
        ascend: 'Faceți clic pentru a urca',
        cancelSort: 'Anulați sortarea',
    },
    Select: {
        emptyText: 'Nici un rezultat',
        createText: 'Creează',
    },
    Tree: {
        emptyText: 'Nici un rezultat',
        searchPlaceholder: 'Căutare',
    },
    Cascader: {
        emptyText: 'Nici un rezultat',
    },
    List: {
        emptyText: 'Nici un rezultat',
    },
    Calendar: {
        allDay: 'Toată ziua',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: 'Cantitate ramasa: ${remained}',
    },
    Upload: {
        mainText: 'Dă clic pentru a descărca fișierul sau trage fișierul aici',
        illegalTips: 'Acest tip de fișier nu este acceptat',
        legalTips: 'Eliberează și începe încărcarea',
        retry: 'Încearcă din nou',
        replace: 'Înlocuiește fișierul',
        clear: 'Șterge',
        selectedFiles: 'Fișiere selectate',
        illegalSize: 'Dimensiunea greșită a fișierului',
        fail: 'Eșec de încărcare',
    },
    TreeSelect: {
        searchPlaceholder: 'Căutare',
    },
    Typography: {
        copy: 'Copiază',
        copied: 'Copiat',
        expand: 'Extinde',
        collapse: 'Comprimare',
    },
    Transfer: {
        emptyLeft: 'Nu există date',
        emptySearch: 'Nu s-au găsit rezultate',
        emptyRight: 'Fără conținut, verifică la stânga',
        placeholder: 'Căutare',
        clear: 'Șterge',
        selectAll: 'Selectează toate',
        clearSelectAll: 'Deselectează toate',
        total: 'Total elemente: ${total}',
        selected: 'Elemente selectate: ${total}',
    },
    Form: {
        optional: '(opțional)',
    },
    Image: {
        preview: 'Previzualizează',
        loading: 'Se încarcă',
        loadError: 'Nu s-a putut încărca',
        prevTip: 'Anterior',
        nextTip: 'Înainte',
        zoomInTip: 'Mărire',
        zoomOutTip: 'Micșorare',
        rotateTip: 'Rotește',
        downloadTip: 'Descarcă',
        adaptiveTip: 'Afișaj adaptabil',
        originTip: 'Afișaj implicit',
    },
    Chat: {
        deleteConfirm: 'Sunteți sigur că doriți să ștergeți această conversație?',
        clearContext: 'Contextul a fost șters',
        copySuccess: 'Copiere reușită',
        stop: 'Oprire',
        copy: 'Copiază',
        copied: 'Copiat',
        dropAreaText: 'Puneți fișierul aici',
    },
    UserGuide: {
        skip: 'Omite',
        next: 'Următorul',
        prev: 'Anterior',
        finish: 'Finalizare',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Căutare',
        replace: 'Înlocuiește',
        replaceAll: 'Înlocuiește toate',
    },
    VideoPlayer: {
        rateChange: 'Schimbați viteza la ${rate}',
        qualityChange: 'Schimbați calitatea la ${quality}',
        routeChange: 'Schimbați ruta la ${route}',
        mirror: 'Mirror',
        cancelMirror: 'Anulează oglindirea',
        loading: 'Se încarcă',
        stall: 'Se încarcă',
        noResource: 'Nicio resursă',
        videoError: 'Eroare la încărcarea videoclipului'
    },
    AIChatDialogue: {
        delete: 'Șterge',
        deleteConfirm: 'Sunteți sigur că doriți să ștergeți această conversație?',
        deleteContent: 'Conversația a fost ștearsă.',
        copySuccess: 'Copiere reușită',
        loading: 'Se încarcă...',
        reasoning: {
            completed: 'Procesare completată',
            thinking: 'Procesare în curs...'
        },
        annotationText: 'elemente de informație'
    },
    Feedback: {
        submit: 'Trimite',
        cancel: 'Anulează'
    },
    AIChatInput: {
        template: 'Sablon',
        configure: 'Configurare',
        selected: '${count} articole selectate',
    }
};

// [i18n-Romanian] 罗马尼亚语
export default local;