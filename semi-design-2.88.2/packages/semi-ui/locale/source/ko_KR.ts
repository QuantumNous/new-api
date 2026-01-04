import { ko } from 'date-fns/locale';
import { Locale } from '../interface';

const local: Locale = {
    code: 'ko-KR',
    dateFnsLocale: ko,
    currency: 'KRW',
    Pagination: {
        pageSize: '페이지당 항목: ${pageSize}',
        total: '총 페이지: ${total}',
        jumpTo: '이동',
        page: '페이지',
    },
    Modal: {
        confirm: '확인',
        cancel: '취소',
    },
    Tabs: {
        more: "더"
    },
    TimePicker: {
        placeholder: {
            time: '시간 선택',
            timeRange: '시간 범위 선택'
        },
        begin: '시작 시간',
        end: '종료 시간',
        // 暂不需要单位，所以为空
        hour: '',
        minute: '',
        second: '',
        AM: '아침',
        PM: '오후',
    },
    DatePicker: {
        placeholder: {
            date: '날짜 선택',
            dateTime: '날짜 및 시간 선택',
            dateRange: ['시작 날짜', '종료일'],
            dateTimeRange: ['시작 날짜', '종료일'],
            monthRange: ['시작 월', '종료 월'],
        },
        presets: '빠른 선택',
        footer: {
            confirm: '확인',
            cancel: '취소',
        },
        selectDate: '선택 날짜 반환',
        selectTime: '시간 선택',
        year: '년',
        month: '월',
        day: '주간',
        monthText: '${year}년 ${month}',
        months: {
            1: '1 월',
            2: '2 월',
            3: '3 월',
            4: '4 월',
            5: '5 월',
            6: '6 월',
            7: '7 월',
            8: '8 월',
            9: '9 월',
            10: '10 월',
            11: '11 월',
            12: '12 월',
        },
        fullMonths: {
            1: '1 월',
            2: '2 월',
            3: '3 월',
            4: '4 월',
            5: '5 월',
            6: '6 월',
            7: '7 월',
            8: '8 월',
            9: '9 월',
            10: '10 월',
            11: '11 월',
            12: '12 월',
        },
        weeks: {
            Mon: '월',
            Tue: '화',
            Wed: '수',
            Thu: '목',
            Fri: '금',
            Sat: '토',
            Sun: '일',
        },
        localeFormatToken: {
            FORMAT_SWITCH_DATE: 'yyyy-MM-dd',
        },
    },
    Popconfirm: {
        confirm: '확인',
        cancel: '취소',
    },
    Navigation: {
        collapseText: '사이드 바 축소',
        expandText: '사이드 바 확장',
    },
    Table: {
        emptyText: '결과 없음',
        pageText: '${total} 중 ${currentStart}-${currentEnd}',
        descend: '내림차순을 보려면 클릭하세요',
        ascend: '오름차순을 보려면 클릭하세요',
        cancelSort: '정렬 취소',
    },
    Select: {
        emptyText: '결과 없음',
        createText: '옵션 생성',
    },
    Cascader: {
        emptyText: '결과 없음',
    },
    Tree: {
        emptyText: '결과 없음',
        searchPlaceholder: '검색',
    },
    List: {
        emptyText: '결과 없음',
    },
    Calendar: {
        allDay: '하루 종일',
        AM: '오전 ${time}시',
        PM: '오후 ${time}시',
        datestring: '일',
        remaining: '${remained} 가지 더',
    },
    Upload: {
        mainText: '파일 업로드를 클릭하거나 여기로 파일 드래그',
        illegalTips: '이 유형의 파일은 지원되지 않습니다',
        legalTips: '마우스를 놓습니다 업로드 시작',
        retry: '재시도',
        replace: '파일 바꾸기',
        clear: '클리어',
        selectedFiles: '선택된 파일',
        illegalSize: '잘못된 파일 크기',
        fail: '업로드 실패',
    },
    TreeSelect: {
        searchPlaceholder: '검색',
    },
    Typography: {
        copy: '복사',
        copied: '복사했습니다',
        expand: '배포',
        collapse: '접어',
    },
    Transfer: {
        emptyLeft: '결과 없음',
        emptySearch: '검색 결과가 없습니다',
        emptyRight: '내용이 없습니다. 왼쪽에서 확인하십시오.',
        placeholder: '검색',
        clear: '비우기',
        selectAll: '모두 선택',
        clearSelectAll: '모두 선택 취소',
        total: '총 항목: ${total}',
        selected: '선택한 항목: ${total}',
    },
    Form: {
        optional: '(선택 과목)',
    },
    Image: {
        preview: '시사',
        loading: '로딩 중',
        loadError: '불러 오지 못했습니다',
        prevTip: '이전',
        nextTip: '다음',
        zoomInTip: '확대',
        zoomOutTip: '축소',
        rotateTip: '회전',
        downloadTip: '다운로드',
        adaptiveTip: '페이지에 맞게 조정',
        originTip: '원래 크기',
    },
    Chat: {
        deleteConfirm: '이 대화를 삭제하시겠습니까?',
        clearContext: '컨텍스트가 지워졌습니다',
        copySuccess: '복사 성공',
        stop: '중지',
        copy: '복사',
        copied: '복사했습니다',
        dropAreaText: '파일을 여기에 놓으세요',
    },
    UserGuide: {
        skip: '건너뛰기',
        next: '다음',
        prev: '이전',
        finish: '완료',
    },
    InputNumber: {},
    JsonViewer: {
        search: '검색',
        replace: '교체',
        replaceAll: '모두 교체',
    },
    VideoPlayer: {
        rateChange: '속도를 ${rate}로 변경',
        qualityChange: '품질을 ${quality}로 변경',
        routeChange: '경로를 ${route}로 변경',
        mirror: '거울',
        cancelMirror: '거울 해제',
        loading: '로딩 중...',
        stall: '로딩 실패',
        noResource: '리소스 없음',
        videoError: '비디오 로드 오류'
    },
    AIChatDialogue: {
        delete: '삭제',
        deleteConfirm: '이 메시지를 삭제하시겠습니까?',
        deleteContent: '이 메시지는 삭제되었습니다.',
        copySuccess: '복사 성공',
        loading: '로딩 중...',
        reasoning: {
            completed: '처리 완료',
            thinking: '처리 중...'
        },
        annotationText: '정보 요소'
    },
    Feedback: {
        submit: '제출',
        cancel: '취소'
    },
    AIChatInput: {
        template: '템플릿',
        configure: '설정',
        selected: '선택된 ${count} 개',
    }
};

// [i18n-Korea]
export default local;
