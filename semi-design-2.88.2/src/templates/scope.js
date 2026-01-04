/* eslint-disable camelcase, comma-dangle */
// 为 react-live 提供 scope
import { Form, Select as BasicSelect } from '@douyinfe/semi-ui';
import { DndProvider, DragSource, DropTarget } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import update from 'immutability-helper';
import InfiniteScroll from 'react-infinite-scroller';
import ReactDOM from 'react-dom';
import { InfiniteLoader, AutoSizer } from 'react-virtualized';
import VList from 'react-virtualized/dist/commonjs/List';

import * as dateFns from 'date-fns';
import classNames from 'classnames';
import { debounce, throttle, range, get, filter, map, some } from 'lodash-es';
import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import en_US from '@douyinfe/semi-ui/locale/source/en_US';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';
import ar from '@douyinfe/semi-ui/locale/source/ar';
import vi_VN from '@douyinfe/semi-ui/locale/source/vi_VN';
import ru_RU from '@douyinfe/semi-ui/locale/source/ru_RU';
import id_ID from '@douyinfe/semi-ui/locale/source/id_ID';
import ms_MY from '@douyinfe/semi-ui/locale/source/ms_MY';
import th_TH from '@douyinfe/semi-ui/locale/source/th_TH';
import tr_TR from '@douyinfe/semi-ui/locale/source/tr_TR';
import pt_BR from '@douyinfe/semi-ui/locale/source/pt_BR';
import zh_TW from '@douyinfe/semi-ui/locale/source/zh_TW';
import sv_SE from '@douyinfe/semi-ui/locale/source/sv_SE';
import pl_PL from '@douyinfe/semi-ui/locale/source/pl_PL';
import nl_NL from '@douyinfe/semi-ui/locale/source/nl_NL';
import es from '@douyinfe/semi-ui/locale/source/es';
import de from '@douyinfe/semi-ui/locale/source/de';
import it from '@douyinfe/semi-ui/locale/source/it';
import fr from '@douyinfe/semi-ui/locale/source/fr';
import ro from '@douyinfe/semi-ui/locale/source/ro';
import az from '@douyinfe/semi-ui/locale/source/az';
import bg from '@douyinfe/semi-ui/locale/source/bg';
import bn_IN from '@douyinfe/semi-ui/locale/source/bn_IN';  
import ca from '@douyinfe/semi-ui/locale/source/ca';
import cs_CZ from '@douyinfe/semi-ui/locale/source/cs_CZ';
import ceb_PH from '@douyinfe/semi-ui/locale/source/ceb_PH';
import da from '@douyinfe/semi-ui/locale/source/da';
import el_GR from '@douyinfe/semi-ui/locale/source/el_GR';
import es_419 from '@douyinfe/semi-ui/locale/source/es_419';
import et from '@douyinfe/semi-ui/locale/source/et';
import fa_IR from '@douyinfe/semi-ui/locale/source/fa_IR';
import fil_PH from '@douyinfe/semi-ui/locale/source/fil_PH';
import fi_FI from '@douyinfe/semi-ui/locale/source/fi_FI';
import fr_CA from '@douyinfe/semi-ui/locale/source/fr_CA';
import ga from '@douyinfe/semi-ui/locale/source/ga';
import he_IL from '@douyinfe/semi-ui/locale/source/he_IL';
import hi_IN from '@douyinfe/semi-ui/locale/source/hi_IN';
import hr from '@douyinfe/semi-ui/locale/source/hr';
import hu_HU from '@douyinfe/semi-ui/locale/source/hu_HU';
import is from '@douyinfe/semi-ui/locale/source/is';
import jv_ID from '@douyinfe/semi-ui/locale/source/jv_ID';
import kk from '@douyinfe/semi-ui/locale/source/kk';
import km_KH from '@douyinfe/semi-ui/locale/source/km_KH';
import lt from '@douyinfe/semi-ui/locale/source/lt';
import lv from '@douyinfe/semi-ui/locale/source/lv';
import my_MM from '@douyinfe/semi-ui/locale/source/my_MM';
import nb from '@douyinfe/semi-ui/locale/source/nb';
import pt from '@douyinfe/semi-ui/locale/source/pt';
import sk from '@douyinfe/semi-ui/locale/source/sk';
import sl from '@douyinfe/semi-ui/locale/source/sl';
import sq from '@douyinfe/semi-ui/locale/source/sq';
import sw from '@douyinfe/semi-ui/locale/source/sw';
import uk_UA from '@douyinfe/semi-ui/locale/source/uk_UA';
import ur from '@douyinfe/semi-ui/locale/source/ur';
import uz from '@douyinfe/semi-ui/locale/source/uz';
import { SortableContainer, SortableElement, sortableHandle } from 'react-sortable-hoc';
import GraphemeSplitter from 'grapheme-splitter';
export * as SemiMarkdownComponents from "@douyinfe/semi-ui/markdownRender/components";
export * from '@douyinfe/semi-ui';
export * from '@douyinfe/semi-foundation/utils';
export * from '@douyinfe/semi-icons';
// export * from '@douyinfe/semi-icons-lab';
export * from '@douyinfe/semi-illustrations';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, posToDOMRect, ReactRenderer } from '@tiptap/react';
import { computePosition, flip, shift } from '@floating-ui/dom';
import Mention from '@tiptap/extension-mention';

export {
    Node, mergeAttributes,
    ReactNodeViewRenderer, NodeViewWrapper, posToDOMRect, ReactRenderer,
    computePosition, flip, shift, Mention
};


export {
    dateFns,
    DndProvider,
    DragSource,
    DropTarget,
    HTML5Backend,
    update,
    InfiniteScroll,
    ReactDOM,
    InfiniteLoader,
    AutoSizer,
    VList,
    classNames,
    GraphemeSplitter,
};

export { default as classnames } from 'classnames';

export * from 'react-resizable';

// Form Field Scope
const {
    Input,
    Select,
    DatePicker,
    Switch,
    Slider,
    CheckboxGroup,
    Checkbox,
    RadioGroup,
    Radio,
    TimePicker,
    InputNumber,
} = Form;

const FormInput = Input;
const FormSelect = Select;
const FormDatePicker = DatePicker;
const FormSwitch = Switch;
const FormSlider = Slider;
const FormCheckboxGroup = CheckboxGroup;
const FormCheckbox = Checkbox;
const FormRadioGroup = RadioGroup;
const FormRadio = Radio;
const FormTimePicker = TimePicker;
const FormInputNumber = InputNumber;

const { Option } = BasicSelect;

export { Option };

export {
    FormInput,
    FormSelect,
    FormDatePicker,
    FormSwitch,
    FormCheckboxGroup,
    FormSlider,
    FormCheckbox,
    FormRadioGroup,
    FormRadio,
    FormTimePicker,
    FormInputNumber,
};

export { SortableContainer, SortableElement, sortableHandle };

export {
    useState,
    useEffect,
    useContext,
    useReducer,
    useCallback,
    useMemo,
    useRef,
    useImperativeHandle,
    useLayoutEffect,
    useDebugValue,
    forwardRef
} from 'react';

export { debounce, throttle, range, get, filter, map, some };

export { zh_CN, en_GB, en_US, ko_KR, ja_JP, ar, vi_VN, ru_RU, id_ID, ms_MY, th_TH, tr_TR, pt_BR, zh_TW, nl_NL, pl_PL, sv_SE, es, de, it, fr, ro, az, bg, bn_IN, ca, cs_CZ, ceb_PH, da, el_GR, es_419, et, fa_IR, fil_PH, fi_FI, fr_CA, ga, he_IL, hi_IN, hr, hu_HU, is, jv_ID, kk, km_KH, lt, lv, my_MM, nb, pt, sk, sl, sq, sw, uk_UA, ur, uz };

export {
    useSortable,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
  
export { CSS as cssDndKit } from '@dnd-kit/utilities';
  
export {
    closestCenter,
    DragOverlay,
    DndContext,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    KeyboardSensor,
    TraversalOrder,
    PointerSensor
} from '@dnd-kit/core';

export { restrictToVerticalAxis } from '@dnd-kit/modifiers';


export {
    IconAccessibility, 
    IconAnchor,
    IconAutocomplete,
    IconAvatar,
    // IconBackTop, 
    IconBadge,
    IconBadgeStar, 
    IconBanner, 
    IconBreadcrumb,
    // IconButton,
    // IconCalendar,
    IconCard,
    IconCascader,
    IconCarousel,
    IconChangelog, 
    IconCheckbox,
    IconConfig,
    IconCollapse,
    IconCollapsible,
    IconColorPlatte,
    IconColorPlatteNew,
    IconDarkMode,
    IconDatePicker,
    IconDescriptions,
    IconDivider,
    IconDropdown,
    IconEmpty,
    IconFaq,
    IconForm,
    IconGettingStarted,
    IconGrid, 
    IconHeart,
    IconHighlight,
    // IconImage,
    IconInput,
    IconInputNumber,
    IconIntro,
    IconLayout,
    // IconList,
    IconLocaleProvider,
    IconModal,
    IconNavigation,
    IconNotification,
    IconOverflow,
    IconPagination,
    IconPopconfirm,
    IconPopover,
    IconProgress,
    // IconRadio,
    IconRating,
    IconScrollList,
    IconSelect,
    IconSideSheet,
    IconSkeleton,
    IconSlider,
    IconSpace,
    // IconSpin,
    IconSteps,
    IconSwitch,
    IconTable,
    IconToken,
    IconTabs,
    IconTag,
    IconTagInput, 
    IconTimePicker,
    IconTimeline,
    IconToast, 
    IconTooltip,
    IconTransfer,
    IconTree, 
    IconTreeSelect,
    IconTypography,
    // IconUpload,
    IconVersionTwo,
    IconWheelChair
} from '@douyinfe/semi-icons-lab';

export { VChart } from "@visactor/react-vchart";
export { initVChartSemiTheme } from '@visactor/vchart-semi-theme';
