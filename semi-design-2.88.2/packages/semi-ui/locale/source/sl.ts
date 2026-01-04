import { sl } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'sl',
    dateFnsLocale: sl,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Št. izdelkov na stran: ${pageSize}',
        total: 'Skupno št. strani: ${total}',
        jumpTo: 'Skoči na',
        page: ' stram',
    },
    Modal: {
        confirm: 'Potrdi',
        cancel: 'Prekliči',
    },
    Tabs: {
        more: "Več"
    },
    TimePicker: {
        placeholder: {
            time: 'Izberi čas',
            timeRange: 'Izberi časovno obdobje',
        },
        begin: 'Čas začetka',
        end: 'Čas konca',
        hour: '',
        minute: '',
        second: '',
        AM: 'dop',
        PM: 'pop',
    },
    DatePicker: {
        placeholder: {
            date: 'Izberi datum',
            dateTime: 'Izberi datum in čas',
            dateRange: ['Datum začetka', 'Datum konca'],
            dateTimeRange: ['Datum začetka', 'Datum konca'],
            monthRange: ['Mesec začetka', 'Mesec konca'],
        },
        presets: 'Prednastavitve',
        footer: {
            confirm: 'Potrdi',
            cancel: 'Prekliči',
        },
        selectDate: 'Izberi datum',
        selectTime: 'Izberi čas',
        year: 'leto',
        month: 'mesec',
        day: 'dan',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mar',
            4: 'Apr',
            5: 'Maj',
            6: 'Jun',
            7: 'Jul',
            8: 'Avg',
            9: 'Sep',
            10: 'Okt',
            11: 'Nov',
            12: 'Dec',
        },
        fullMonths: {
            1: 'Januar',
            2: 'Februar',
            3: 'Marec',
            4: 'April',
            5: 'Maj',
            6: 'Junij',
            7: 'Julij',
            8: 'Avgust',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'December',
        },
        weeks: {
            Mon: 'Pon',
            Tue: 'Tor',
            Wed: 'Sre',
            Thu: 'Čet',
            Fri: 'Pet',
            Sat: 'Sob',
            Sun: 'Ned',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'MM/dd/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Potrdi',
        cancel: 'Prekliči',
    },
    Navigation: {
        collapseText: 'Strni stransko vrstico',
        expandText: 'Razširi stransko vrstico',
    },
    Table: {
        emptyText: 'Brez rezultatov',
        pageText: 'Prikazano ${currentStart} do ${currentEnd} od ${total}',
        descend: 'Klikni za padajoč vrstni red',
        ascend: 'Klikni za naraščajoč vrstni red',
        cancelSort: 'Prekliči razvrščanje',
    },
    Select: {
        emptyText: 'Brez rezultatov',
        createText: 'Ustvari',
    },
    Cascader: {
        emptyText: 'Brez rezultatov',
    },
    Tree: {
        emptyText: 'Brez rezultatov',
        searchPlaceholder: 'Išči',
    },
    List: {
        emptyText: 'Brez rezultatov',
    },
    Calendar: {
        allDay: 'Ves dan',
        AM: '${time} dop.',
        PM: '${time} pop.',
        datestring: '',
        remaining: 'ostane še ${remained}',
    },
    Upload: {
        mainText: 'Klikni za nalaganje datoteke ali povleci datoteko sem',
        illegalTips: 'Ta vrsta datoteke ni podprta',
        legalTips: 'Sprosti in začni nalaganje',
        retry: 'Poskusi znova',
        replace: 'Zamenjaj datoteko',
        clear: 'Počisti',
        selectedFiles: 'Izbrane datoteke',
        illegalSize: 'Nezakonitih velikosti datotek',
        fail: 'Nalaganje ni uspelo',
    },
    TreeSelect: {
        searchPlaceholder: 'Išči',
    },
    Typography: {
        copy: 'Kopiraj',
        copied: 'Kopirano',
        expand: 'Razširi',
        collapse: 'Strni',
    },
    Transfer: {
        emptyLeft: 'Ni podatkov',
        emptySearch: 'Ni rezultatov iskanja',
        emptyRight: 'Brez vsebine, preveri z leve',
        placeholder: 'Išči',
        clear: 'Počisti',
        selectAll: 'Izberi vse',
        clearSelectAll: 'Prekliči izbor vseh',
        total: 'Skupno št. izdelkov: ${total}',
        selected: 'Št. izbranih izdelkov: ${total}',
    },
    Form: {
        optional: '(neobvezno)',
    },
    Image: {
        preview: 'Predogled',
        loading: 'Nalaganje ...',
        loadError: 'Nalaganje ni uspelo',
        prevTip: 'Nazaj',
        nextTip: 'Naprej',
        zoomInTip: 'Povečaj',
        zoomOutTip: 'Pomanjšaj',
        rotateTip: 'Zasukaj',
        downloadTip: 'Prenesi',
        adaptiveTip: 'Prilagodi strani',
        originTip: 'Izvirna velikost',
    },
    Chat: {
        deleteConfirm: 'Ali si prepričan/-a, da želiš izbrisati to sejo?',
        clearContext: 'Kontekst izbrisan',
        copySuccess: 'Kopiranje uspešno.',
        stop: 'Ustavi',
        copy: 'Kopiraj',
        copied: 'Kopirano',
        dropAreaText: 'Datoteko povleci sem',
    },
    UserGuide: {
        skip: 'Preskoči',
        next: 'Naprej',
        prev: 'Nazaj',
        finish: 'Končaj',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Išči',
        replace: 'Zamenjaj',
        replaceAll: 'Zamenjaj vse',
    },
    VideoPlayer: {
        rateChange: 'Preklop hitrosti na ${rate}',
        qualityChange: 'Preklop kakovosti na ${quality}',
        routeChange: 'Preklop poti na ${route}',
        mirror: 'Zrcalo',
        cancelMirror: 'Prekliči zrcalo',
        loading: 'Nalaganje ...',
        stall: 'Nalaganje ni uspelo',
        noResource: 'Brez vira',
        videoError: 'Napaka pri nalaganju videoposnetka',
    },
    AIChatDialogue: {
        delete: 'Izbriši',
        deleteConfirm: 'Ali si prepričan/-a, da želiš izbrisati to sporočilo?',
        deleteContent: 'To sporočilo bo trajno izbrisano in ga ne bo mogoče obnoviti.',
        copySuccess: 'Kopiranje uspešno',
        loading: 'Nalaganje ...',
        reasoning: {
            completed: 'Razmislek zaključen',
            thinking: 'Razmišljanje ...'
        },
        annotationText: 'viri informacij'
    },
    Feedback: {
        submit: 'Pošlji',
        cancel: 'Prekliči'
    },
    AIChatInput: {
        template: 'Predloga',
        configure: 'Nastavi',
        selected: 'Izbranih elementov: ${count}',
    }
};

export default local;