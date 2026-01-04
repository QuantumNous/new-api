import { zhCN } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'zh-CN',
    currency: 'CNY',
    dateFnsLocale: zhCN, // locale code to dateFns locale
    Pagination: {
        pageSize: '每页条数：${pageSize}',
        total: '总页数：${total}',
        jumpTo: '跳至',
        page: '页',
    },
    Modal: {
        confirm: '确定',
        cancel: '取消',
    },
    Tabs: {
        more: "更多",
    },
    TimePicker: {
        placeholder: {
            time: '请选择时间',
            timeRange: '请选择时间范围',
        },
        begin: '开始时间',
        end: '结束时间',
        hour: '时',
        minute: '分',
        second: '秒',
        AM: '上午',
        PM: '下午',
    },
    DatePicker: {
        placeholder: {
            date: '请选择日期',
            dateTime: '请选择日期及时间',
            dateRange: ['开始日期', '结束日期'],
            dateTimeRange: ['开始日期', '结束日期'],
            monthRange: ['开始月份', '结束月份'],
        },
        presets: '快捷选择',
        footer: {
            confirm: '确定',
            cancel: '取消',
        },
        selectDate: '返回选择日期',
        selectTime: '选择时间',
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
        collapseText: '收起侧边栏',
        expandText: '展开侧边栏',
    },
    Popconfirm: {
        confirm: '确定',
        cancel: '取消',
    },
    Table: {
        emptyText: '暂无数据',
        pageText: '显示第 ${currentStart} 条-第 ${currentEnd} 条，共 ${total} 条',
        descend: '点击降序',
        ascend: '点击升序',
        cancelSort: '取消排序',
    },
    Select: {
        emptyText: '暂无数据',
        createText: '创建',
    },
    Cascader: {
        emptyText: '暂无数据',
    },
    Tree: {
        emptyText: '暂无数据',
        searchPlaceholder: '搜索',
    },
    List: {
        emptyText: '暂无数据',
    },
    Calendar: {
        allDay: '全天',
        AM: '上午${time}时',
        PM: '下午${time}时',
        datestring: '日',
        remaining: '还有${remained}项',
    },
    Upload: {
        mainText: '点击上传文件或拖拽文件到这里',
        illegalTips: '不支持此类型文件',
        legalTips: '松手开始上传',
        retry: '重试',
        replace: '替换文件',
        clear: '清空',
        selectedFiles: '已选择文件',
        illegalSize: '文件尺寸不合法',
        fail: '上传失败',
    },
    TreeSelect: {
        searchPlaceholder: '搜索',
    },
    Typography: {
        copy: '复制',
        copied: '复制成功',
        expand: '展开',
        collapse: '收起',
    },
    Transfer: {
        emptyLeft: '暂无数据',
        emptySearch: '无搜索结果',
        emptyRight: '暂无内容，可从左侧勾选',
        placeholder: '搜索',
        clear: '清空',
        selectAll: '全选',
        clearSelectAll: '取消全选',
        total: '总个数：${total}',
        selected: '已选个数：${total}',
    },
    Form: {
        optional: '（可选）',
    },
    Image: {
        preview: '预览',
        loading: '加载中',
        loadError: '加载失败',
        prevTip: '上一张',
        nextTip: '下一张',
        zoomInTip: '放大',
        zoomOutTip: '缩小',
        rotateTip: '旋转',
        downloadTip: '下载',
        adaptiveTip: '适应页面',
        originTip: '原始尺寸',
    },
    Chat: {
        deleteConfirm: '确认删除该会话吗？',
        clearContext: '上下文已清除',
        copySuccess: '复制成功',
        stop: '停止',
        copy: '复制',
        copied: '复制成功',
        dropAreaText: '将文件放到这里',
    },
    UserGuide: {
        skip: '跳过',
        next: '下一步',
        prev: '上一步',
        finish: '完成',
    },
    InputNumber: {},
    JsonViewer: {
        search: '查找',
        replace: '替换',
        replaceAll: '全部替换',
    },
    VideoPlayer: {
        rateChange: '切换速率至 ${rate}',
        qualityChange: '切换清晰度至${quality}',
        routeChange: '切换线路至${route}',
        mirror: '镜像',
        cancelMirror: '取消镜像',
        loading: '加载中...',
        stall: '加载失败',
        noResource: '暂无资源',
        videoError: '视频加载错误'
    },
    AIChatDialogue: {
        delete: '删除',
        deleteConfirm: '确认要删除吗？',
        deleteContent: '删除后将无法恢复！',
        copySuccess: '复制成功',
        loading: '请稍候...',
        reasoning: {
            completed: '已思考完成',
            thinking: '正在思考中...'
        },
        annotationText: '篇资料'
    },
    Feedback: {
        submit: '提交',
        cancel: '取消'
    },
    AIChatInput: {
        template: '模板',
        configure: '配置',
        selected: '已选 ${count} 个',
    }
};

// 中文
export default local;
