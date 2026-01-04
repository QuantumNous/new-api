

import { pl } from 'date-fns/locale';
import { Locale } from '../interface';

/**
 * [i18n-Poland (pl_PL)]
 * 波兰语
 *
 */

const local: Locale = {
    code: 'pl-PL',
    dateFnsLocale: pl, // locale code to dateFns locale
    currency: 'PLN',
    Pagination: {
        pageSize: 'Liczba pozycji na stronie: ${pageSize}',
        total: 'Strony ogółem: ${total}',
        jumpTo: 'Przejdź do',
        page: 'stron',
    },
    Modal: {
        confirm: 'Potwierdź',
        cancel: 'Anuluj',
    },
    Tabs: {
        more: "Więcej"
    },
    TimePicker: {
        placeholder: {
            time: 'Wybierz czas',
            timeRange: 'Wybierz przedział czasowy',
        },
        begin: 'Czas rozpoczęcia',
        end: 'Czas zakończenia',
        hour: '',
        minute: '',
        second: '',
        AM: '',
        PM: '',
    },
    DatePicker: {
        placeholder: {
            date: 'Wybierz datę',
            dateTime: 'Wybierz datę i godzinę',
            dateRange: ['Data rozpoczęcia', 'Data zakończenia'],
            dateTimeRange: ['Data rozpoczęcia', 'Data zakończenia'],
            monthRange: ['Miesiąc rozpoczęcia', 'Miesiąc zakończenia'],
        },
        presets: 'Szybki wybór',
        footer: {
            confirm: 'Potwierdź',
            cancel: 'Anuluj',
        },
        selectDate: 'Wybierz datę',
        selectTime: 'Wybierz godzinę',
        year: '',
        month: '',
        day: '',
        monthText: '${month} ${year}',
        months: {
            1: 'Sty',
            2: 'Lut',
            3: 'Mar',
            4: 'Kwi',
            5: 'Maj',
            6: 'Cze',
            7: 'Lip',
            8: 'Sie',
            9: 'Wrz',
            10: 'Paź',
            11: 'Lis',
            12: 'Gru',
        },
        fullMonths: {
            1: 'styczeń',
            2: 'luty',
            3: 'marzec',
            4: 'kwiecień',
            5: 'maj',
            6: 'czerwiec',
            7: 'lipiec',
            8: 'sierpień',
            9: 'wrzesień',
            10: 'październik',
            11: 'listopad',
            12: 'grudzień',
        },
        weeks: {
            Mon: 'Po',
            Tue: 'Wt',
            Wed: 'Śr',
            Thu: 'Cz',
            Fri: 'Pt',
            Sat: 'So',
            Sun: 'Nd',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy-MM-dd',
        },
    },
    Navigation: {
        collapseText: 'Ukryj pasek boczny',
        expandText: 'Pokaż pasek boczny',
    },
    Popconfirm: {
        confirm: 'Potwierdź',
        cancel: 'Anuluj',
    },
    Table: {
        emptyText: 'Nie znaleziono żadnych wyników',
        pageText: 'Wyświetlanie od ${currentStart} do ${currentEnd} z ${total}',
        descend: 'Kliknij, aby sortować malejąco',
        ascend: 'Kliknij, aby sortować rosnąco',
        cancelSort: 'Anuluj sortowanie',
    },
    Select: {
        emptyText: 'Nie znaleziono żadnych wyników',
        createText: 'Utwórz',
    },
    Cascader: {
        emptyText: 'Nie znaleziono żadnych wyników',
    },
    Tree: {
        emptyText: 'Nie znaleziono żadnych wyników',
        searchPlaceholder: 'Wyszukaj',
    },
    List: {
        emptyText: 'Nie znaleziono żadnych wyników',
    },
    Calendar: {
        allDay: 'Cały dzień',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: 'jeszcze ${remained}',
    },
    Upload: {
        mainText: 'Kliknij, aby wybrać plik, lub przeciągnij go tutaj, aby go przesłać.',
        illegalTips: 'Ten typ pliku jest nieobsługiwany.',
        legalTips: 'Zwolnij, aby rozpocząć przesyłanie.',
        retry: 'Spróbuj ponownie',
        replace: 'Zastąp plik',
        clear: 'Wyczyść',
        selectedFiles: 'Wybrane pliki',
        illegalSize: 'Nieprawidłowy rozmiar pliku',
        fail: 'Nie można przesłać',
    },
    TreeSelect: {
        searchPlaceholder: 'Wyszukaj',
    },
    Typography: {
        copy: 'Kopiuj',
        copied: 'Skopiowano',
        expand: 'Pokaż więcej',
        collapse: 'Ukryj',
    },
    Transfer: {
        emptyLeft: 'Brak danych',
        emptySearch: 'Brak wyników wyszukiwania',
        emptyRight: 'Tutaj pojawią się wybrane przedmioty. Wybierz przedmiot z lewej strony',
        placeholder: 'Wyszukaj',
        clear: 'Wyczyść',
        selectAll: 'Zaznacz wszystkie',
        clearSelectAll: 'Usuń zaznaczenie wszystkich',
        total: 'Pozycje ogółem: ${total}',
        selected: 'Wybrane pozycje: ${total}', 
    },
    Form: {
        optional: '（Opcjonalnie）',
    },
    Image: {
        preview: 'Podgląd',
        loading: 'Zgrywanie',
        loadError: 'Nie można zgrać',
        prevTip: 'Wstecz',
        nextTip: 'Dalej',
        zoomInTip: 'Powiększ',
        zoomOutTip: 'Pomniejsz',
        rotateTip: 'Obróć',
        downloadTip: 'Pobierz',
        adaptiveTip: 'Dostosowywanie ekranu',
        originTip: 'Wyświetlacz domyślny',
    },
    Chat: {
        deleteConfirm: 'Czy na pewno chcesz usunąć tę rozmowę?',
        clearContext: 'Kontekst został wyczyszczony',
        copySuccess: 'Skopiowano pomyślnie',
        stop: 'Zatrzymać',
        copy: 'Kopiuj',
        copied: 'Skopiowano',
        dropAreaText: 'Umieść plik tutaj',
    },
    UserGuide: {
        skip: 'Pomiń',
        next: 'Następny',
        prev: 'Poprzedni',
        finish: 'Zakończ',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Szukaj',
        replace: 'Zastąp',
        replaceAll: 'Zastąp wszystko',
    },
    VideoPlayer: {
        rateChange: 'Zmień prędkość na ${rate}',
        qualityChange: 'Zmień jakość na ${quality}',
        routeChange: 'Zmień ścieżkę na ${route}',
        mirror: 'Lustrzane odbicie',
        cancelMirror: 'Odwróć lustrzane odbicie',
        loading: 'Ładowanie...',
        stall: 'Ładowanie nie powiodło się',
        noResource: 'Brak zasobu',
        videoError: 'Błąd ładowania wideo'
    },
    AIChatDialogue: {
        delete: 'Usuń',
        deleteConfirm: 'Czy na pewno chcesz usunąć tę rozmowę?',
        deleteContent: 'Rozmowa została usunięta.',
        copySuccess: 'Skopiowano pomyślnie',
        loading: 'Ładowanie...',
        reasoning: {
            completed: 'Procesowanie zakończone',
            thinking: 'Procesowanie...'
        },
        annotationText: 'elementy informacji'
    },
    Feedback: {
        submit: 'Wyślij',
        cancel: 'Anuluj'
    },
    AIChatInput: {
        template: 'Szablon',
        configure: 'Konfiguracja',
        selected: 'Wybrano ${count} elementów',
    }
};

export default local;
