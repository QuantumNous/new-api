import { hu } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'hu-HU',
    dateFnsLocale: hu,
    currency: 'HUF',
    Pagination: {
        pageSize: 'Tételek oldalanként: ${pageSize}',
        total: 'Összes oldal: ${total}',
        jumpTo: 'Ugrás ide:',
        page: ' oldal',
    },
    Modal: {
        confirm: 'Megerősítés',
        cancel: 'Mégse',
    },
    Tabs: {
        more: "Továbbiak"
    },
    TimePicker: {
        placeholder: {
            time: 'Idő kiválasztása',
            timeRange: 'Időtartomány kiválasztása',
        },
        begin: 'Kezdés ideje',
        end: 'Befejezés ideje',
        hour: '',
        minute: '',
        second: '',
        AM: 'DE.',
        PM: 'DU.',
    },
    DatePicker: {
        placeholder: {
            date: 'Dátum kiválasztása',
            dateTime: 'Dátum és idő kiválasztása',
            dateRange: ['Kezdés dátuma', 'Befejezés dátuma'],
            dateTimeRange: ['Kezdés dátuma', 'Befejezés dátuma'],
            monthRange: ['Kezdés hónapja', 'Befejezés hónapja'],
        },
        presets: 'Előbeállítások',
        footer: {
            confirm: 'Megerősítés',
            cancel: 'Mégse',
        },
        selectDate: 'Dátum kiválasztása',
        selectTime: 'Idő kiválasztása',
        year: 'év',
        month: 'hónap',
        day: 'nap',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan.',
            2: 'Febr.',
            3: 'Márc.',
            4: 'Ápr.',
            5: 'Május',
            6: 'Jún.',
            7: 'Júl.',
            8: 'Aug.',
            9: 'Szept.',
            10: 'Okt.',
            11: 'Nov.',
            12: 'Dec.',
        },
        fullMonths: {
            1: 'Január',
            2: 'Február',
            3: 'Március',
            4: 'Április',
            5: 'Május',
            6: 'Június',
            7: 'Július',
            8: 'Augusztus',
            9: 'Szeptember',
            10: 'Október',
            11: 'November',
            12: 'December',
        },
        weeks: {
            Mon: 'Hé',
            Tue: 'K',
            Wed: 'Sze',
            Thu: 'Csüt',
            Fri: 'Pé',
            Sat: 'Szo',
            Sun: 'Vas',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy/MM/dd',
        },
    },
    Popconfirm: {
        confirm: 'Megerősítés',
        cancel: 'Mégse',
    },
    Navigation: {
        collapseText: 'Oldalsáv összecsukása',
        expandText: 'Oldalsáv kibővítése',
    },
    Table: {
        emptyText: 'Nincs eredmény',
        pageText: 'Megjelenítve: ${currentStart}–${currentEnd}/${total}',
        descend: 'Kattints a lefelé haladáshoz',
        ascend: 'Kattints a felfelé haladáshoz',
        cancelSort: 'Rendezés törlése',
    },
    Select: {
        emptyText: 'Nincs eredmény',
        createText: 'Létrehozás',
    },
    Cascader: {
        emptyText: 'Nincs eredmény',
    },
    Tree: {
        emptyText: 'Nincs eredmény',
        searchPlaceholder: 'Keresés',
    },
    List: {
        emptyText: 'Nincs eredmény',
    },
    Calendar: {
        allDay: 'Egész nap',
        AM: 'DE. ${time}',
        PM: 'DU. ${time}',
        datestring: 'üres angol',
        remaining: '${remained} további',
    },
    Upload: {
        mainText: 'Kattints a fájl feltöltéséhez, vagy húzd ide a fájlt',
        illegalTips: 'Ez a fájltípus nem támogatott',
        legalTips: 'Kiadás és feltöltés indítása',
        retry: 'Újrapróbálkozás',
        replace: 'Fájl cseréje',
        clear: 'Törlés',
        selectedFiles: 'Kiválasztott fájlok',
        illegalSize: 'Nem megengedett fájlméret',
        fail: 'Feltöltés sikertelen',
    },
    TreeSelect: {
        searchPlaceholder: 'Keresés',
    },
    Typography: {
        copy: 'Másolás',
        copied: 'Másolva',
        expand: 'Kibővítés',
        collapse: 'Összecsukás',
    },
    Transfer: {
        emptyLeft: 'Nincs adat',
        emptySearch: 'Nincs keresési eredmény',
        emptyRight: 'Nincs tartalom, ellenőrizd a bal oldalról',
        placeholder: 'Keresés',
        clear: 'Törlés',
        selectAll: 'Összes kiválasztása',
        clearSelectAll: 'Összes kiválasztás megszüntetése',
        total: 'Összes tétel: ${total}',
        selected: 'Kiválasztott elemek: ${total}',
    },
    Form: {
        optional: '(opcionális)',
    },
    Image: {
        preview: 'Előnézet',
        loading: 'Betöltés',
        loadError: 'Betöltés sikertelen',
        prevTip: 'Előző',
        nextTip: 'Következő',
        zoomInTip: 'Nagyítás',
        zoomOutTip: 'Kicsinyítés',
        rotateTip: 'Forgatás',
        downloadTip: 'Letöltés',
        adaptiveTip: 'Igazítás az oldalhoz',
        originTip: 'Eredeti méret',
    },
    Chat: {
        deleteConfirm: 'Biztosan törlöd ezt a munkamenetet?',
        clearContext: 'Kontextus törölve',
        copySuccess: 'Másolás sikeres.',
        stop: 'Leállítás',
        copy: 'Másolás',
        copied: 'Másolva',
        dropAreaText: 'Helyezd ide a fájlt',
    },
    UserGuide: {
        skip: 'Kihagyás',
        next: 'Következő',
        prev: 'Előző',
        finish: 'Befejezés',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Keresés',
        replace: 'Csere',
        replaceAll: 'Összes cseréje',
    },
    VideoPlayer: {
        rateChange: 'Sebesség váltása: ${rate}',
        qualityChange: 'Minőség váltása: ${quality}',
        routeChange: 'Útvonal váltása: ${route}',
        mirror: 'Tükrözés',
        cancelMirror: 'Tükrözés törlése',
        loading: 'Betöltés...',
        stall: 'Betöltés sikertelen',
        noResource: 'Nincs forrás',
        videoError: 'Videóbetöltési hiba',
    },
    AIChatDialogue: {
        delete: 'Törlés',
        deleteConfirm: 'Biztosan törlöd ezt az üzenetet?',
        deleteContent: 'Ezt az üzenetet véglegesen töröljük, és nem lehet visszaállítani.',
        copySuccess: 'Másolás sikeres',
        loading: 'Betöltés...',
        reasoning: {
            completed: 'Indoklás kész',
            thinking: 'Gondolkodás...'
        },
        annotationText: 'információ'
    },
    Feedback: {
        submit: 'Beküldés',
        cancel: 'Mégse'
    },
    AIChatInput: {
        template: 'Sablon',
        configure: 'Beállítás',
        selected: '${count} elem kiválasztva',
    }
};

export default local;