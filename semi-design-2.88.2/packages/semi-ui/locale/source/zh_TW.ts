import { zhTW } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'zh-TW',
    dateFnsLocale: zhTW, // locale code to dateFns locale
    currency: 'TWD',
    Pagination: {
        pageSize: '每頁項目數：${pageSize}',
        total: '總頁數：${total}',
        jumpTo: '跳至',
        page: '頁',
    },
    Modal: {
        confirm: '確定',
        cancel: '取消',
    },
    Tabs: {
        more: "更多"
    },
    TimePicker: {
        placeholder: {
            time: '請選擇時間',
            timeRange: '請選擇時間範圍',
        },
        begin: '開始時間',
        end: '結束時間',
        hour: '時',
        minute: '分',
        second: '秒',
        AM: '上午',
        PM: '下午',
    },
    DatePicker: {
        placeholder: {
            date: '請選擇日期',
            dateTime: '請選擇日期及時間',
            dateRange: ['開始日期', '結束日期'],
            dateTimeRange: ['開始日期', '結束日期'],
            monthRange: ['開始月份', '結束月份'],
        },
        presets: '快捷選擇',
        footer: {
            confirm: '確定',
            cancel: '取消',
        },
        selectDate: '返回選擇日期',
        selectTime: '選擇時間',
        year: '年',
        month: '月',
        day: '日',
        monthText: '${year}年 ${month}', // 此處不使用標准token是因爲需要做replace，月份M這個Token可能會被誤傷，例如May
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
        // timepicker scrollwheel裏只需要展示[1、2……]，所以這裏的fullMonths根據UI定制了
        fullMonths: {
            1: '1',
            2: '2',
            3: '3',
            4: '4',
            5: '5',
            6: '6',
            7: '7',
            8: '8',
            9: '9',
            10: '10',
            11: '11',
            12: '12',
        },
        weeks: {
            Mon: '一',
            Tue: '二',
            Wed: '三',
            Thu: '四',
            Fri: '五',
            Sat: '六',
            Sun: '日',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy-MM-dd',
        },
    },
    Navigation: {
        collapseText: '收起側邊欄',
        expandText: '展開側邊欄',
    },
    Popconfirm: {
        confirm: '確定',
        cancel: '取消',
    },
    Table: {
        emptyText: '暫無數據',
        pageText: '顯示第 ${currentStart} 條-第 ${currentEnd} 條，共 ${total} 條',
        descend: '點擊降序',
        ascend: '點擊升序',
        cancelSort: '取消排序',
    },
    Select: {
        emptyText: '暫無數據',
        createText: '創建',
    },
    Cascader: {
        emptyText: '暫無數據',
    },
    Tree: {
        emptyText: '暫無數據',
        searchPlaceholder: '搜索',
    },
    List: {
        emptyText: '暫無數據',
    },
    Calendar: {
        allDay: '全天',
        AM: '上午${time}時',
        PM: '下午${time}時',
        datestring: '日',
        remaining: '還有${remained}項',
    },
    Upload: {
        mainText: '點擊上傳文件或拖拽文件到這裏',
        illegalTips: '不支持此類型文件',
        legalTips: '松手開始上傳',
        retry: '重試',
        replace: '替換文件',
        clear: '清空',
        selectedFiles: '已選擇文件',
        illegalSize: '文件尺寸不合法',
        fail: '上傳失敗',
    },
    TreeSelect: {
        searchPlaceholder: '搜索',
    },
    Typography: {
        copy: '複制',
        copied: '複制成功',
        expand: '展開',
        collapse: '收起',
    },
    Transfer: {
        emptyLeft: '暫無數據',
        emptySearch: '無搜索結果',
        emptyRight: '暫無內容，可從左側勾選',
        placeholder: '搜索',
        clear: '清空',
        selectAll: '全選',
        clearSelectAll: '取消全選',
        total: '總項目數：${total}',
        selected: '選取的項目數：${total}',
    },
    Form: {
        optional: '（可選）',
    },
    Image: {
        preview: '預覽',
        loading: '加載中',
        loadError: '加載失敗',
        prevTip: '上一張',
        nextTip: '下一張',
        zoomInTip: '放大',
        zoomOutTip: '縮小',
        rotateTip: '旋轉',
        downloadTip: '下載',
        adaptiveTip: '適應頁面',
        originTip: '原始尺寸',
    },
    Chat: {
        deleteConfirm: '確認刪除該對話嗎？',
        clearContext: '上下文已清除',
        copySuccess: '複製成功',
        stop: '停止',
        copy: '複制',
        copied: '複制成功',
        dropAreaText: '將文件放到這裡',
    },
    UserGuide: {
        skip: '跳過',
        next: '下一步',
        prev: '上一步',
        finish: '完成',
    },
    InputNumber: {},
    JsonViewer: {
        search: '查找',
        replace: '替換',
        replaceAll: '全部替換',
    },
    VideoPlayer: {
        rateChange: '切換速率至 ${rate}',
        qualityChange: '切換清晰度至${quality}',
        routeChange: '切換路徑至${route}',
        mirror: '鏡像',
        cancelMirror: '取消鏡像',
        loading: '加載中...',
        stall: '加載失敗',
        noResource: '暫無資源',
        videoError: '視頻加載錯誤'
    },
    AIChatDialogue: {
        delete: '刪除',
        deleteConfirm: '確認刪除該對話嗎？',
        deleteContent: '刪除後將無法恢復！',
        copySuccess: '複製成功',
        loading: '請稍候...',
        reasoning: {
            completed: '已思考完成',
            thinking: '正在思考中...'
        },
        annotationText: '篇資料'
    },
    Feedback: {
        submit: '提交',
        cancel: '取消'
    },
    AIChatInput: {
        template: '模板',
        configure: '配置',
        selected: '已選 ${count} 個',
    }
};

// 中文
export default local;
