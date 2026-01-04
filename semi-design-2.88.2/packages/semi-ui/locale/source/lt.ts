import { lt } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'lt',
    dateFnsLocale: lt,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Elementų puslapyje: ${pageSize}',
        total: 'Iš viso puslapių: ${total}',
        jumpTo: 'Pereiti į',
        page: ' puslapį',
    },
    Modal: {
        confirm: 'Patvirtinti',
        cancel: 'Atšaukti',
    },
    Tabs: {
        more: "Daugiau"
    },
    TimePicker: {
        placeholder: {
            time: 'Pasirink laiką',
            timeRange: 'Pasirink laiko intervalą',
        },
        begin: 'Pradžios laikas',
        end: 'Pabaigos laikas',
        hour: '',
        minute: '',
        second: '',
        AM: 'priešpiet',
        PM: 'popiet',
    },
    DatePicker: {
        placeholder: {
            date: 'Pasirink datą',
            dateTime: 'Pasirink datą ir laiką',
            dateRange: ['Pradžios data', 'Pabaigos data'],
            dateTimeRange: ['Pradžios data', 'Pabaigos data'],
            monthRange: ['Pradžios mėnuo', 'Pabaigos mėnuo'],
        },
        presets: 'Išankstiniai nustatymai',
        footer: {
            confirm: 'Patvirtinti',
            cancel: 'Atšaukti',
        },
        selectDate: 'Pasirink datą',
        selectTime: 'Pasirink laiką',
        year: 'metai',
        month: 'mėnuo',
        day: 'diena',
        monthText: '${year} ${month}',
        months: {
            1: 'Sau',
            2: 'Vas',
            3: 'Kov',
            4: 'Bal',
            5: 'Gegužė',
            6: 'Bir',
            7: 'Lie',
            8: 'Rgp',
            9: 'Rug',
            10: 'Spa',
            11: 'Lap',
            12: 'Gru',
        },
        fullMonths: {
            1: 'Sausis',
            2: 'Vasaris',
            3: 'Kovas',
            4: 'Balandis',
            5: 'Gegužė',
            6: 'Birželis',
            7: 'Liepa',
            8: 'Rugpjūtis',
            9: 'Rugsėjis',
            10: 'Spalis',
            11: 'Lapkritis',
            12: 'Gruodis',
        },
        weeks: {
            Mon: 'Pr',
            Tue: 'A',
            Wed: 'T',
            Thu: 'K',
            Fri: 'Pn',
            Sat: 'Š',
            Sun: 'S',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy-MM-dd',
        },
    },
    Popconfirm: {
        confirm: 'Patvirtinti',
        cancel: 'Atšaukti',
    },
    Navigation: {
        collapseText: 'Suskleisti šoninę juostą',
        expandText: 'Išskleisti šoninę juostą',
    },
    Table: {
        emptyText: 'Rezultatų nėra',
        pageText: 'Rodoma ${currentStart}–${currentEnd} iš ${total}',
        descend: 'Spustelėk, jei nori rikiuoti mažėjimo tvarka',
        ascend: 'Spustelėk, jei nori rikiuoti didėjimo tvarka',
        cancelSort: 'Atšaukti rikiavimą',
    },
    Select: {
        emptyText: 'Rezultatų nėra',
        createText: 'Kurti',
    },
    Cascader: {
        emptyText: 'Rezultatų nėra',
    },
    Tree: {
        emptyText: 'Rezultatų nėra',
        searchPlaceholder: 'Ieškoti',
    },
    List: {
        emptyText: 'Rezultatų nėra',
    },
    Calendar: {
        allDay: 'Visa diena',
        AM: '${time} priešpiet',
        PM: '${time} popiet',
        datestring: '',
        remaining: 'Dar ${remained}',
    },
    Upload: {
        mainText: 'Spustelėk ir įkelk failą arba nuvilk jį čia',
        illegalTips: 'Šio tipo failas nepalaikomas',
        legalTips: 'Paleisk ir pradėk įkėlimą',
        retry: 'Bandyti dar kartą',
        replace: 'Pakeisti failą',
        clear: 'Išvalyti',
        selectedFiles: 'Pasirinkti failai',
        illegalSize: 'Neleidžiamas failo dydis',
        fail: 'Nepavyko įkelti',
    },
    TreeSelect: {
        searchPlaceholder: 'Ieškoti',
    },
    Typography: {
        copy: 'Kopijuoti',
        copied: 'Nukopijuota',
        expand: 'Išskleisti',
        collapse: 'Suskleisti',
    },
    Transfer: {
        emptyLeft: 'Nėra duomenų',
        emptySearch: 'Nėra paieškos rezultatų',
        emptyRight: 'Nėra turinio, patikrink kairėje',
        placeholder: 'Ieškoti',
        clear: 'Išvalyti',
        selectAll: 'Pasirinkti viską',
        clearSelectAll: 'Atšaukti visų pasirinkimą',
        total: 'Iš viso elementų: ${total}',
        selected: 'Pasirinkti elementai: ${total}',
    },
    Form: {
        optional: '(neprivaloma)',
    },
    Image: {
        preview: 'Peržiūra',
        loading: 'Įkeliama',
        loadError: 'Nepavyko įkelti',
        prevTip: 'Ankstesnis',
        nextTip: 'Kitas',
        zoomInTip: 'Priartinti',
        zoomOutTip: 'Nutolinti',
        rotateTip: 'Pasukti',
        downloadTip: 'Atsisiųsti',
        adaptiveTip: 'Pritaikyti prie puslapio',
        originTip: 'Pradinis dydis',
    },
    Chat: {
        deleteConfirm: 'Ar tikrai nori pašalinti šią sesiją?',
        clearContext: 'Kontekstas išvalytas',
        copySuccess: 'Sėkmingai nukopijuota.',
        stop: 'Stabdyti',
        copy: 'Kopijuoti',
        copied: 'Nukopijuota',
        dropAreaText: 'Padėk failą čia',
    },
    UserGuide: {
        skip: 'Praleisti',
        next: 'Kitas',
        prev: 'Ankst.',
        finish: 'Baigti',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Ieškoti',
        replace: 'Pakeisti',
        replaceAll: 'Pakeisti viską',
    },
    VideoPlayer: {
        rateChange: 'Pakeisti spartą į ${rate}',
        qualityChange: 'Pakeisti kokybę į ${quality}',
        routeChange: 'Pakeisti maršrutą į ${route}',
        mirror: 'Veidrodinis',
        cancelMirror: 'Atšaukti veidrodinį',
        loading: 'Įkeliama...',
        stall: 'Nepavyko įkelti',
        noResource: 'Nėra išteklių',
        videoError: 'Video įkėlimo klaida',
    },
    AIChatDialogue: {
        delete: 'Pašalinti',
        deleteConfirm: 'Ar tikrai nori pašalinti šią žinutę?',
        deleteContent: 'Ši žinutė bus visam laikui pašalinta ir jis nebus galima atkurti.',
        copySuccess: 'Sėkmingai nukopijuota',
        loading: 'Įkeliama...',
        reasoning: {
            completed: 'Motyvai baigti',
            thinking: 'Mąsto...'
        },
        annotationText: 'informacijos elementai'
    },
    Feedback: {
        submit: 'Pateikti',
        cancel: 'Atšaukti'
    },
    AIChatInput: {
        template: 'Šablonas',
        configure: 'Konfigūruoti',
        selected: 'Pasirinkta ${count} elem.',
    }
};

// [i18n-Italian]
export default local;