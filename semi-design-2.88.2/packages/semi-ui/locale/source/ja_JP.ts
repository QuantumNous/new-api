import { ja } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ja-JP',
    dateFnsLocale: ja,
    currency: 'JPY',
    Pagination: {
        pageSize: '1ページあたりのアイテム数：${pageSize}',
        total: '合計ページ数：${total}',
        jumpTo: 'ページへ',
        page: 'ページ',
    },
    Modal: {
        confirm: '確認する',
        cancel: 'キャンセル',
    },
    Tabs: {
        more: "もっと"
    },
    TimePicker: {
        placeholder: {
            time: '時間を選択してください',
            timeRange: '時間範囲を選択してください'
        },
        begin: '始まる時間',
        end: '終了時間',
        hour: '時',
        minute: '分',
        second: '秒',
        AM: '午前',
        PM: '午後',
    },
    DatePicker: {
        placeholder: {
            date: '日付を選択してください',
            dateTime: '日時を選択してください',
            dateRange: ['開始日', '終了日'],
            dateTimeRange: ['開始日', '終了日'],
            monthRange: ['開始月', '終了月'],
        },
        presets: 'クイック選択',
        footer: {
            confirm: '確認する',
            cancel: 'キャンセル',
        },
        selectDate: '日付を選ぶ',
        selectTime: '時間を選ぶ',
        year: '年',
        month: '月',
        day: '日',
        monthText: '${year}年 ${month}', // 此处不使用标准token是因为需要做replace，月份M这个Token可能会被误伤，例如May
        months: {
            1: '1月',
            2: '2月',
            3: '3月',
            4: '4月',
            5: '5月',
            6: '6月',
            7: '7月',
            8: '8月',
            9: '9月',
            10: '10月',
            11: '11月',
            12: '12月',
        },
        // timepicker scrollwheel里只需要展示[1、2……]，所以这里的fullMonths根据UI定制了
        fullMonths: {
            1: '一月',
            2: '二月',
            3: '三月',
            4: '四月',
            5: '五月',
            6: '六月',
            7: '七月',
            8: '八月',
            9: '九月',
            10: '十月',
            11: '十一月',
            12: '十二月',
        },
        weeks: {
            Mon: '月',
            Tue: '火',
            Wed: '水',
            Thu: '木',
            Fri: '金',
            Sat: '土',
            Sun: '日',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy/MM/dd',
        },
    },
    Popconfirm: {
        confirm: '確認する',
        cancel: 'キャンセル',
    },
    Navigation: {
        collapseText: 'サイドバーを折りたたむ',
        expandText: 'サイドバーを展開',
    },
    Table: {
        emptyText: 'データがありません',
        pageText: '${total}件のうち、${currentStart}～${currentEnd}件目を表示しています',
        descend: 'クリックして降順',
        ascend: 'クリックして昇順',
        cancelSort: 'ソートのキャンセル',
    },
    Select: {
        emptyText: 'データがありません',
        createText: '作成する',
    },
    Tree: {
        emptyText: 'データがありません',
        searchPlaceholder: '検索する',
    },
    Cascader: {
        emptyText: 'データがありません',
    },
    List: {
        emptyText: 'データがありません',
    },
    Calendar: {
        allDay: '終日',
        AM: '午前${time}時',
        PM: '午後${time}時',
        datestring: '日',
        remaining: 'あと${remained}つ',
    },
    Upload: {
        mainText: '[ファイルのアップロード]または[ファイルをここにドラッグ]をクリックします',
        illegalTips: 'このタイプのファイルはサポートされていません',
        legalTips: '手放してアップロード',
        retry: '再試行',
        replace: 'ファイルを置き換える',
        clear: 'クリア',
        selectedFiles: '選択されたファイル',
        illegalSize: '不正なファイルサイズ',
        fail: 'アップロードに失敗しました',
    },
    TreeSelect: {
        searchPlaceholder: '検索する',
    },
    Typography: {
        copy: 'コピー',
        copied: 'コピーしました',
        expand: '展開',
        collapse: '折り',
    },
    Transfer: {
        emptyLeft: 'データがありません',
        emptySearch: '検索結果がありません',
        emptyRight: '内容なし、左から確認',
        placeholder: '検索する',
        clear: '空っぽ',
        selectAll: 'すべて選択',
        clearSelectAll: 'すべてを選択解除',
        total: '合計アイテム数：${total}',
        selected: '選択されているアイテム数：${total}',
    },
    Form: {
        optional: '(オプション)',
    },
    Image: {
        preview: 'プレビュー',
        loading: '読み込み中',
        loadError: '読み込みに失敗しました',
        prevTip: '前へ',
        nextTip: '次へ',
        zoomInTip: 'ズームイン',
        zoomOutTip: 'ズームアウト',
        rotateTip: '回転',
        downloadTip: 'ダウンロード',
        adaptiveTip: 'ページに適応',
        originTip: '元のサイズ',
    },
    Chat: {
        deleteConfirm: 'このセッションを削除してもよろしいですか？',
        clearContext: 'コンテキストを削除しました',
        copySuccess: '正常にコピーされました',
        stop: 'とめる',
        copy: 'コピー',
        copied: 'コピーしました',
        dropAreaText: 'ファイルをここに置いてください',
    },
    UserGuide: {
        skip: 'スキップ',
        next: '次へ',
        prev: '前へ',
        finish: '完了',
    },
    InputNumber: {},
    JsonViewer: {
        search: '検索',
        replace: '置換',
        replaceAll: 'すべて置換',
    },
    VideoPlayer: {
        rateChange: '速さを${rate}に変更',
        qualityChange: '品質を${quality}に変更',
        routeChange: 'ルートを${route}に変更',
        mirror: '鏡像',
        cancelMirror: '鏡像を解除',
        loading: '読み込み中...',
        stall: '読み込みに失敗しました',
        noResource: 'リソースなし',
        videoError: '動画の読み込みエラー'
    },
    AIChatDialogue: {
        delete: '削除',
        deleteConfirm: 'このメッセージを削除してもよろしいですか？',
        deleteContent: 'このメッセージは削除されました。',
        copySuccess: '正常にコピーされました',
        loading: '読み込み中...',
        reasoning: {
            completed: '思考完了',
            thinking: '考え...'
        },
        annotationText: '情報要素'
    },
    Feedback: {
        submit: '送信',
        cancel: 'キャンセル'
    },
    AIChatInput: {
        template: 'テンプレート',
        configure: '設定',
        selected: '選択された ${count} 個',
    }
};

// [i18n-Japan]
export default local;
