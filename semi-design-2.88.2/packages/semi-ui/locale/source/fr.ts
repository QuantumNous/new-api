import { fr } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'fr',
    dateFnsLocale: fr,
    currency: 'EUR',
    Pagination: {
        pageSize: 'Éléments par page : ${pageSize}',
        total: 'Total des pages : ${total}',
        jumpTo: 'Sauter à',
        page: ' pages',
    },
    Modal: {
        confirm: 'Confirmer',
        cancel: 'Annuler',
    },
    Tabs: {
        more: "Plus",
    },
    TimePicker: {
        placeholder: {
            time: 'Sélectionner temps',
            timeRange: 'Sélectionner une période de temps',
        },
        begin: 'Heure de début',
        end: 'Heure de fin',
        hour: '',
        minute: '',
        second: '',
        AM: 'AM',
        PM: 'PM',
    },
    DatePicker: {
        placeholder: {
            date: 'Sélectionner date',
            dateTime: 'Sélectionner date et temps',
            dateRange: ['Date de début', 'Date de fin'],
            dateTimeRange: ['Date de début', 'Date de fin'],
            monthRange: ['Mois de début', 'Mois de fin'],
        },
        presets: 'Préréglages',
        footer: {
            confirm: 'Confirmer',
            cancel: 'Annuler',
        },
        selectDate: 'Sélectionner date',
        selectTime: 'Sélectionner temps',
        year: 'année',
        month: 'mois',
        day: 'jour',
        monthText: '${month} ${year}',
        months: {
            1: 'janv.',
            2: 'févr.',
            3: 'mars',
            4: 'avr.',
            5: 'mai',
            6: 'juin',
            7: 'juill.',
            8: 'août',
            9: 'sept.',
            10: 'oct.',
            11: 'nov.',
            12: 'déc.',
        },
        fullMonths: {
            1: 'janvier',
            2: 'février',
            3: 'mars',
            4: 'avril',
            5: 'mai',
            6: 'juin',
            7: 'juillet',
            8: 'août',
            9: 'septembre',
            10: 'octobre',
            11: 'novembre',
            12: 'décembre',
        },
        weeks: {
            Mon: 'lun.',
            Tue: 'mar.',
            Wed: 'mer.',
            Thu: 'jeu.',
            Fri: 'ven.',
            Sat: 'sam.',
            Sun: 'dim.',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'dd/MM/yyyy',
        },
    },
    Popconfirm: {
        confirm: 'Confirmer',
        cancel: 'Annuler',
    },
    Navigation: {
        collapseText: 'Comprimer la barre latérale',
        expandText: 'Étendre la barre latérale',
    },
    Table: {
        emptyText: 'Aucun Résultat',
        pageText: 'Montrant ${currentStart} to ${currentEnd} of ${total}',
        descend: 'Cliquez pour descendre',
        ascend: 'Cliquez pour monter',
        cancelSort: 'Annuler le tri',
    },
    Select: {
        emptyText: 'Aucun Résultat',
        createText: 'Créer',
    },
    Tree: {
        emptyText: 'Aucun Résultat',
        searchPlaceholder: 'Recherche',
    },
    Cascader: {
        emptyText: 'Aucun Résultat',
    },
    List: {
        emptyText: 'Aucun Résultat',
    },
    Calendar: {
        allDay: ' Toute la journée',
        AM: '${time} AM',
        PM: '${time} PM',
        datestring: '',
        remaining: '${remained} plus',
    },
    Upload: {
        mainText: 'Cliquez pour télécharger le fichier ou faites glisser le fichier vers ici',
        illegalTips: 'Ce type de fichier n\'est pas pris en charge',
        legalTips: 'Libérer et commencer le chargement',
        retry: 'Réessayer',
        replace: 'Remplacer le fichier',
        clear: 'Supprimer',
        selectedFiles: 'Fichiers sélectionnés',
        illegalSize: 'Taille de fichier erronée',
        fail: 'Échec du chargement',
    },
    TreeSelect: {
        searchPlaceholder: 'Recherche',
    },
    Typography: {
        copy: 'Copier',
        copied: 'Copié',
        expand: 'Étendre',
        collapse: 'Comprimer',
    },
    Transfer: {
        emptyLeft: 'Aucune Donnée',
        emptySearch: 'Aucun résultat n\'a été trouvé',
        emptyRight: 'Pas de contenu, vérification à gauche',
        placeholder: 'Recherche',
        clear: 'Supprimer',
        selectAll: 'Sélectionner tout',
        clearSelectAll: 'Désélectionner tout',
        total: 'Total des éléments : ${total}',
        selected: 'Éléments sélectionnés : ${total}',
    },
    Form: {
        optional: '(optionnel)',
    },
    Image: {
        preview: 'Aperçu',
        loading: 'Chargement',
        loadError: 'Échec du chargement',
        prevTip: 'Précédent',
        nextTip: 'Suivant',
        zoomInTip: 'Zoom avant',
        zoomOutTip: 'Zoom arrière',
        rotateTip: 'Rotation',
        downloadTip: 'Télécharger',
        adaptiveTip: 'Adapter à la page',
        originTip: 'Taille d\'origine',
    },
    Chat: {
        deleteConfirm: 'Êtes-vous sûr de vouloir supprimer cette conversation ?',
        clearContext: 'Le contexte a été effacé',
        copySuccess: 'Copie réussie',
        stop: 'Arrêter',
        copy: 'Copier',
        copied: 'Copié',
        dropAreaText: 'Déposez le fichier ici',
    },
    UserGuide: {
        skip: 'Passer',
        next: 'Suivant',
        prev: 'Précédent',
        finish: 'Terminer',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Rechercher',
        replace: 'Remplacer',
        replaceAll: 'Remplacer tout',
    },
    VideoPlayer: {
        rateChange: 'Changer la vitesse à ${rate}',
        qualityChange: 'Changer la qualité à ${quality}',
        routeChange: 'Changer la route à ${route}',
        mirror: 'Miroir',
        cancelMirror: 'Annuler le miroir',
        loading: 'Chargement...',
        stall: 'Chargement échoué',
        noResource: 'Aucune ressource',
        videoError: 'Erreur de chargement de la vidéo'
    },
    AIChatDialogue: {
        delete: 'Supprimer',
        deleteConfirm: 'Êtes-vous sûr de vouloir supprimer ce message ?',
        deleteContent: 'Ce message sera supprimé définitivement et ne pourra pas être récupéré.',
        copySuccess: 'Copie réussie',
        loading: 'Chargement...',
        reasoning: {
            completed: 'Traitement terminé',
            thinking: 'Traitement en cours...'
        },
        annotationText: 'éléments d\'information'
    },
    Feedback: {
        submit: 'Soumettre',
        cancel: 'Annuler'
    },
    AIChatInput: {
        template: 'Modèle',
        configure: 'Configurer',
        selected: '${count} éléments sélectionnés',
    }
};

// [i18n-French]
export default local;
