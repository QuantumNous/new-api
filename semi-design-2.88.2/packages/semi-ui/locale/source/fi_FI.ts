import { fi } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'fi-FI',
    dateFnsLocale: fi,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Tuotteet sivua kohden: ${pageSize}',
        total: 'Sivuja yhteensä: ${total}',
        jumpTo: 'Siirry',
        page: ' sivulle',
    },
    Modal: {
        confirm: 'Vahvista',
        cancel: 'Peruuta',
    },
    Tabs: {
        more: "Lisää"
    },
    TimePicker: {
        placeholder: {
            time: 'Valitse aika',
            timeRange: 'Valitse aikaväli',
        },
        begin: 'Alkamisaika',
        end: 'Päättymisaika',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Valitse päivä',
            dateTime: 'Valitse päivä ja aika',
            dateRange: ['Alkamispäivä', 'Päättymispäivä'],
            dateTimeRange: ['Alkamispäivä', 'Päättymispäivä'],
            monthRange: ['Alkamisuukausi', 'Päättymiskuukausi'],
        },
        presets: 'Esiasetukset',
        footer: {
            confirm: 'Vahvista',
            cancel: 'Peruuta',
        },
        selectDate: 'Valitse päivä',
        selectTime: 'Valitse aika',
        year: 'vuosi',
        month: 'kuukausi',
        day: 'päivä',
        monthText: '${month} ${year}',
        months: {
            1: 'Tammi',
            2: 'Helmi',
            3: 'Maalis',
            4: 'Huhti',
            5: 'Touko',
            6: 'Kesä',
            7: 'Heinä',
            8: 'Elo',
            9: 'Syys',
            10: 'Loka',
            11: 'Marras',
            12: 'Joulu',
        },
        fullMonths: {
            1: 'Tammikuu',
            2: 'Helmikuu',
            3: 'Maaliskuu',
            4: 'Huhtikuu',
            5: 'Toukokuu',
            6: 'Kesäkuu',
            7: 'Heinäkuu',
            8: 'Elokuu',
            9: 'Syyskuu',
            10: 'Lokakuu',
            11: 'Marraskuu',
            12: 'Joulukuu',
        },
        weeks: {
            Mon: 'Ma',
            Tue: 'Ti',
            Wed: 'Ke',
            Thu: 'To',
            Fri: 'Pe',
            Sat: 'La',
            Sun: 'Su',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Vahvista',
        cancel: 'Peruuta',
    },
    Navigation: {
        collapseText: 'Kavenna sivupalkki',
        expandText: 'Laajenna sivupalkki',
    },
    Table: {
        emptyText: 'Ei tuloksia',
        pageText: 'Näytetään ${currentStart}–${currentEnd}/${total}',
        descend: 'Muuta laskevaksi napsauttamalla',
        ascend: 'Muuta nousevaksi napsauttamalla',
        cancelSort: 'Peruuta lajittelu',
    },
    Select: {
        emptyText: 'Ei tuloksia',
        createText: 'Luo',
    },
    Cascader: {
        emptyText: 'Ei tuloksia',
    },
    Tree: {
        emptyText: 'Ei tuloksia',
        searchPlaceholder: 'Hae',
    },
    List: {
        emptyText: 'Ei tuloksia',
    },
    Calendar: {
        allDay: 'Koko päivä',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} jäljellä',
    },
    Upload: {
        mainText: 'Lataa tiedosto napsauttamalla tai vedä se tähän',
        illegalTips: 'Tätä tiedostotyyppiä ei tueta',
        legalTips: 'Vapauta ja aloita lataaminen',
        retry: 'Yritä uudelleen',
        replace: 'Korvaa tiedosto',
        clear: 'Tyhjennä',
        selectedFiles: 'Valitut tiedostot',
        illegalSize: 'Kielletty tiedostokoko',
        fail: 'Lataus epäonnistui',
    },
    TreeSelect: {
        searchPlaceholder: 'Hae',
    },
    Typography: {
        copy: 'Kopioi',
        copied: 'Kopioitu',
        expand: 'Laajenna',
        collapse: 'Tiivistä',
    },
    Transfer: {
        emptyLeft: 'Ei tietoja',
        emptySearch: 'Ei hakutuloksia',
        emptyRight: 'Ei sisältöä, tarkista vasemmalta',
        placeholder: 'Hae',
        clear: 'Tyhjennä',
        selectAll: 'Valitse kaikki',
        clearSelectAll: 'Poista kaikki valinnat',
        total: 'Kohteita yhteensä: ${total}',
        selected: 'Valittuja kohteita: ${total}',
    },
    Form: {
        optional: '(valinnainen)',
    },
    Image: {
        preview: 'Esikatselu',
        loading: 'Ladataan',
        loadError: 'Lataus epäonnistui',
        prevTip: 'Edellinen',
        nextTip: 'Seuraava',
        zoomInTip: 'Lähennä',
        zoomOutTip: 'Loitonna',
        rotateTip: 'Kierrä',
        downloadTip: 'Lataa',
        adaptiveTip: 'Sovita sivuun',
        originTip: 'Alkuperäinen koko',
    },
    Chat: {
        deleteConfirm: 'Haluatko varmasti poistaa istunnon?',
        clearContext: 'Konteksti tyhjennetty',
        copySuccess: 'Kopiointi onnistui.',
        stop: 'Lopeta',
        copy: 'Kopioi',
        copied: 'Kopioitu',
        dropAreaText: 'Aseta tiedosto tähän',
    },
    UserGuide: {
        skip: 'Ohita',
        next: 'Seuraava',
        prev: 'Edellinen',
        finish: 'Valmis',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Hae',
        replace: 'Korvaa',
        replaceAll: 'Korvaa kaikki',
    },
    VideoPlayer: {
        rateChange: 'Vaihda nopeuteen ${rate}',
        qualityChange: 'Vaihda laaduksi ${quality}',
        routeChange: 'Vaihda lähdöksi ${route}',
        mirror: 'Peilaus',
        cancelMirror: 'Peruuta peilaus',
        loading: 'Ladataan...',
        stall: 'Lataus epäonnistui',
        noResource: 'Ei resurssia',
        videoError: 'Virhe videota ladattaessa',
    },
    AIChatDialogue: {
        delete: 'Poista',
        deleteConfirm: 'Haluatko varmasti poistaa viestin?',
        deleteContent: 'Viesti poistetaan pysyvästi, eikä sitä voida palauttaa.',
        copySuccess: 'Kopiointi onnistui',
        loading: 'Ladataan...',
        reasoning: {
            completed: 'Päätelmä valmis',
            thinking: 'Ajattelen...'
        },
        annotationText: 'tietolähdettä'
    },
    Feedback: {
        submit: 'Lähetä',
        cancel: 'Peruuta'
    },
    AIChatInput: {
        template: 'Malli',
        configure: 'Määritä',
        selected: 'Valitut ${count} kohdetta',
    }
};

export default local;