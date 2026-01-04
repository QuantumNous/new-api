import { de } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'de',
    dateFnsLocale: de,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Elemente pro Seite: ${pageSize}',
        total: 'Seiten gesamt: ${total}',
        jumpTo: 'Springen zu',
        page: ' Seiten',
    },
    Modal: {
        confirm: 'Bestätigen',
        cancel: 'Abbrechen',
    },
    Tabs: {
        more: "Mehr"
    },
    TimePicker: {
        placeholder: {
            time: 'Zeit auswählen',
            timeRange: 'Einen Zeitintervall auswählen',
        },
        begin: 'Startzeit',
        end: 'Endzeit',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Datum auswählen',
            dateTime: 'Datum und Uhrzeit auswählen',
            dateRange: ['Startdatum', 'Enddatum'],
            dateTimeRange: ['Startdatum', 'Enddatum'],
            monthRange: ['Startmonat', 'Endmonat'],
        },
        presets: 'Schnellauswahl',
        footer: {
            confirm: 'Bestätigen',
            cancel: 'Abbrechen',
        },
        selectDate: 'Datum auswählen',
        selectTime: 'Uhrzeit auswählen',
        year: 'Jahr',
        month: 'Monat',
        day: 'Tag',
        monthText: '${month} ${year}',
        months: {
            1: 'Jan',
            2: 'Feb',
            3: 'Mär',
            4: 'Apr',
            5: 'Mai',
            6: 'Jun',
            7: 'Jul',
            8: 'Aug',
            9: 'Sep',
            10: 'Okt',
            11: 'Nov',
            12: 'Dez',
        },
        fullMonths: {
            1: 'Januar',
            2: 'Februar',
            3: 'März',
            4: 'April',
            5: 'Mai',
            6: 'Juni',
            7: 'Juli',
            8: 'August',
            9: 'September',
            10: 'Oktober',
            11: 'November',
            12: 'Dezember',
        },
        weeks: {
            Mon: 'Mo.',
            Tue: 'Di.',
            Wed: 'Mi.',
            Thu: 'Do.',
            Fri: 'Fr.',
            Sat: 'Sa.',
            Sun: 'So.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd.MM.yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Bestätigen',
        cancel: 'Abbrechen',
    },
    Navigation: {
        collapseText: 'Seitenleiste verstecken',
        expandText: 'Seitenleiste anzeigen',
    },
    Table: {
        emptyText: 'Kein Ergebnis',
        pageText: 'Anzeigen ${currentStart} bis ${currentEnd} von ${total}',
        descend: 'Klicken, um absteigend zu sortieren',
        ascend: 'Klicken, um aufsteigend zu sortieren',
        cancelSort: 'Sortierung abbrechen',
    },
    Select: {
        emptyText: 'Kein Ergebnis',
        createText: 'Kreieren',
    },
    Tree: {
        emptyText: 'Kein Ergebnis',
        searchPlaceholder: 'Suchen',
    },
    Cascader: {
        emptyText: 'Kein Ergebnis',
    },
    List: {
        emptyText: 'Kein Ergebnis',
    },
    Calendar: {
        allDay: 'Den ganzen Tag',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} mehr',
    },
    Upload: {
        mainText: 'Klicken Sie auf Datei hochladen oder ziehen Sie die Datei hierher',
        illegalTips: 'Dieser Dateityp wird nicht unterstützt',
        legalTips: 'Freigeben und Hochladen starten',
        retry: 'Wiederholen',
        replace: 'Datei ersetzen',
        clear: 'Löschen',
        selectedFiles: 'Ausgewählte Dateien',
        illegalSize: 'Illegale Dateigröße',
        fail: 'Hochladen fehlgeschlagen',
    },
    TreeSelect: {
        searchPlaceholder: 'Suchen',
    },
    Typography: {
        copy: 'Kopieren',
        copied: 'Kopiert',
        expand: 'Erweitern',
        collapse: 'Verstecken',
    },
    Transfer: {
        emptyLeft: 'Keine Daten',
        emptySearch: 'Keine Suchergebnisse',
        emptyRight: 'Keine Inhalte, links kontrollieren',
        placeholder: 'Suchen',
        clear: 'Löschen',
        selectAll: 'Alles auswählen',
        clearSelectAll: 'Alles abwählen',
        total: 'Elemente gesamt: ${total}',
        selected: 'Elemente ausgewählt: ${total}',
    },
    Form: {
        optional: '(Optional)',
    },
    Image: {
        preview: 'Vorschau',
        loading: 'Wird geladen',
        loadError: 'Laden fehlgeschlagen',
        prevTip: 'Zurück',
        nextTip: 'Weiter',
        zoomInTip: 'Vergrößern',
        zoomOutTip: 'herauszoomen',
        rotateTip: 'Drehen',
        downloadTip: 'herunterladen',
        adaptiveTip: 'An die Seite anpassen',
        originTip: 'Originalgröße',
    },
    Chat: {
        deleteConfirm: 'Möchten Sie diesen Chat wirklich löschen?',
        clearContext: 'Der Kontext wurde gelöscht',
        copySuccess: 'Erfolgreich kopiert',
        stop: 'stoppen',
        copy: 'Kopieren',
        copied: 'Kopiert',
        dropAreaText: 'Datei hier ablegen',
    },
    UserGuide: {
        skip: 'Überspringen',
        next: 'Weiter',
        prev: 'Zurück',
        finish: 'Fertig',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Suchen',
        replace: 'Ersetzen',
        replaceAll: 'Alle ersetzen',
    },
    VideoPlayer: {
        rateChange: 'Geschwindigkeit auf ${rate} wechseln',
        qualityChange: 'Qualität auf ${quality} wechseln',
        routeChange: 'Route auf ${route} wechseln',
        mirror: 'Spiegel',
        cancelMirror: 'Spiegelung aufheben',
        loading: 'Wird geladen...',
        stall: 'Laden fehlgeschlagen',
        noResource: 'Keine Ressource',
        videoError: 'Video-Ladefehler'
    },
    AIChatDialogue: {
        delete: 'Löschen',
        deleteConfirm: 'Möchten Sie diese Nachricht wirklich löschen?',
        deleteContent: 'Diese Nachricht wird unwiederruflich gelöscht.',
        copySuccess: 'Erfolgreich kopiert',
        loading: 'Wird geladen...',
        reasoning: {
            completed: 'Verarbeitung abgeschlossen',
            thinking: 'Wird verarbeitet...'
        },
        annotationText: 'Informationselemente'
    },
    Feedback: {
        submit: 'Absenden',
        cancel: 'Abbrechen'
    },
    AIChatInput: {
        template: 'Vorlage',
        configure: 'Konfigurieren',
        selected: 'Ausgewählt ${count} Elemente',
    }
};

// [i18n-German]
export default local;
