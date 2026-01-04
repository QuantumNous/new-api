import { frCA } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'fr-CA',
    dateFnsLocale: frCA,
    currency: 'CAD',
    Pagination: {
        pageSize: 'Articles par page : ${pageSize}',
        total: 'Total des pages : ${total}',
        jumpTo: 'Aller à',
        page: ' la page',
    },
    Modal: {
        confirm: 'Confirmer',
        cancel: 'Annuler',
    },
    Tabs: {
        more: "Plus"
    },
    TimePicker: {
        placeholder: {
            time: 'Choisis une heure',
            timeRange: 'Sélectionne une plage horaire',
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
            date: 'Sélectionne une date',
            dateTime: 'Sélectionne la date et l\'heure',
            dateRange: ['Date de début', 'Date de fin'],
            dateTimeRange: ['Date de début', 'Date de fin'],
            monthRange: ['Mois de début', 'Mois de fin'],
        },
        presets: 'Préréglages',
        footer: {
            confirm: 'Confirmer',
            cancel: 'Annuler',
        },
        selectDate: 'Sélectionne la date',
        selectTime: 'Choisis une heure',
        year: 'année',
        month: 'mois',
        day: 'jour',
        monthText: '${month} ${year}',
        months: {
            1: 'Janv.',
            2: 'Févr.',
            3: 'Mars',
            4: 'Avr.',
            5: 'Mai',
            6: 'Juin',
            7: 'Juill.',
            8: 'Août',
            9: 'Sept.',
            10: 'Oct.',
            11: 'Nov.',
            12: 'Déc.',
        },
        fullMonths: {
            1: 'Janvier',
            2: 'Février',
            3: 'Mars',
            4: 'Avril',
            5: 'Mai',
            6: 'Juin',
            7: 'Juillet',
            8: 'Août',
            9: 'Septembre',
            10: 'Octobre',
            11: 'Novembre',
            12: 'Décembre',
        },
        weeks: {
            Mon: 'Lun.',
            Tue: 'Mar.',
            Wed: 'Mer.',
            Thu: 'Jeu.',
            Fri: 'Ven.',
            Sat: 'Sam.',
            Sun: 'Dim.',
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
        collapseText: 'Réduire la barre latérale',
        expandText: 'Agrandir la barre latérale',
    },
    Table: {
        emptyText: 'Aucun résultat',
        pageText: 'Affichage de ${currentStart} à ${currentEnd} sur ${total}',
        descend: 'Clique pour descendre',
        ascend: 'Clique pour monter',
        cancelSort: 'Annuler le tri',
    },
    Select: {
        emptyText: 'Aucun résultat',
        createText: 'Créer',
    },
    Cascader: {
        emptyText: 'Aucun résultat',
    },
    Tree: {
        emptyText: 'Aucun résultat',
        searchPlaceholder: 'Recherche',
    },
    List: {
        emptyText: 'Aucun résultat',
    },
    Calendar: {
        allDay: 'Toute la journée',
        AM: '${time}',
        PM: '${time}',
        datestring: '',
        remaining: '${remained} supplémentaire(s)',
    },
    Upload: {
        mainText: 'Clique pour téléverser le fichier ou fais-le glisser ici',
        illegalTips: 'Ce type de fichier n\'est pas pris en charge',
        legalTips: 'Relâche et commence le téléversement',
        retry: 'Réessayer',
        replace: 'Remplacer le fichier',
        clear: 'Effacer',
        selectedFiles: 'Fichiers sélectionnés',
        illegalSize: 'Taille de fichier illégale',
        fail: 'Échec du téléversement',
    },
    TreeSelect: {
        searchPlaceholder: 'Rechercher',
    },
    Typography: {
        copy: 'Copier',
        copied: 'Copié',
        expand: 'Agrandir',
        collapse: 'Réduire',
    },
    Transfer: {
        emptyLeft: 'Aucune donnée',
        emptySearch: 'Aucun résultat de recherche',
        emptyRight: 'Pas de contenu, vérifie à partir de la gauche',
        placeholder: 'Rechercher',
        clear: 'Effacer',
        selectAll: 'Tout sélectionner',
        clearSelectAll: 'Tout désélectionner',
        total: 'Total d\'articles : ${total}',
        selected: 'Articles sélectionnés : ${total}',
    },
    Form: {
        optional: '(facultatif)',
    },
    Image: {
        preview: 'Aperçu',
        loading: 'Chargement',
        loadError: 'Échec du chargement',
        prevTip: 'Précédent',
        nextTip: 'Suivant',
        zoomInTip: 'Zoomer',
        zoomOutTip: 'Dézoomer',
        rotateTip: 'Pivoter',
        downloadTip: 'Télécharger',
        adaptiveTip: 'Adapter à la page',
        originTip: 'Taille originale',
    },
    Chat: {
        deleteConfirm: 'Veux-tu vraiment supprimer cette session?',
        clearContext: 'Contexte effacé',
        copySuccess: 'Copie réussie.',
        stop: 'Arrêter',
        copy: 'Copier',
        copied: 'Copié',
        dropAreaText: 'Placer le fichier ici',
    },
    UserGuide: {
        skip: 'Ignorer',
        next: 'Suivant',
        prev: 'Précédent',
        finish: 'Terminer',
    },
    InputNumber: {},
    JsonViewer: {
        search: 'Rechercher',
        replace: 'Remplacer',
        replaceAll: 'Tout remplacer',
    },
    VideoPlayer: {
        rateChange: 'Changer le taux à ${rate}',
        qualityChange: 'Changer la qualité à ${quality}',
        routeChange: 'Changer le chemin pour ${route}',
        mirror: 'Miroir',
        cancelMirror: 'Annuler le miroir',
        loading: 'Chargement en cours…',
        stall: 'Échec du chargement',
        noResource: 'Aucune ressource',
        videoError: 'Erreur de chargement de la vidéo',
    },
    AIChatDialogue: {
        delete: 'Supprimer',
        deleteConfirm: 'Veux-tu vraiment supprimer ce message?',
        deleteContent: 'Ce message sera définitivement supprimé et ne pourra pas être récupéré.',
        copySuccess: 'Copie réussie',
        loading: 'Chargement en cours…',
        reasoning: {
            completed: 'Raisonnement terminé',
            thinking: 'Réflexion en cours...'
        },
        annotationText: 'informations'
    },
    Feedback: {
        submit: 'Envoyer',
        cancel: 'Annuler'
    },
    AIChatInput: {
        template: 'Modèle',
        configure: 'Configurer',
        selected: '${count} éléments sélectionnés',
    }
};

export default local;