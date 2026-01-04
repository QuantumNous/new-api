import type { AutoCompleteProps } from "../autoComplete";
import type { AvatarProps } from "../avatar";
import type { CascaderProps } from "../cascader";
import type { CollapseReactProps } from "../collapse";
import type { CollapsibleProps } from "../collapsible";
import type { DatePickerProps } from "../datePicker";
import type { DropdownProps } from "../dropdown";
import type { ModalReactProps } from "../modal";
import type { NavProps } from "../navigation";
import type { NoticeReactProps } from "../notification";
import type { OverflowListProps } from "../overflowList";
import type { PopconfirmProps } from "../popconfirm";
import type { PopoverProps } from "../popover";
import type { SelectProps } from "../select";
import type { SideSheetReactProps } from "../sideSheet";
import type { TabsProps } from "../tabs";
import type { TimePickerProps } from "../timePicker";
import type { ToastReactProps } from "../toast";
import type { TooltipProps } from "../tooltip";
import type { MarkdownRenderProps } from "../markdownRender";
import { SpinProps } from "../spin";

class SemiGlobal {

    config: {
        overrideDefaultProps?: {
            // "Anchor"?: Partial<AnchorProps>;
            "AutoComplete"?: Partial<AutoCompleteProps<any>>;
            "Avatar"?: Partial<AvatarProps>;
            "MarkdownRender"?: Partial<MarkdownRenderProps>;
            // BackTop?: Partial<BackTopProps>;
            // Badge?: Partial<BadgeProps>;
            // Banner?: Partial<BannerProps>;
            // Breadcrumb?: Partial<BreadcrumbProps>;
            // Button?: Partial<ButtonProps>;
            // Calendar?: Partial<CalendarProps>;
            // Card?: Partial<CardProps>;
            // Carousel?: Partial<CarouselProps>;
            Cascader?: Partial<CascaderProps>;
            // Checkbox?: Partial<CheckboxProps>;
            Collapse?: Partial<CollapseReactProps>;
            Collapsible?: Partial<CollapsibleProps>;
            DatePicker?: Partial<DatePickerProps>;
            // Descriptions?: Partial<DescriptionsProps>;
            // Divider?: Partial<DividerProps>;
            Dropdown?: Partial<DropdownProps>;
            // Empty?: Partial<EmptyProps>;
            // Form?: Partial<BaseFormProps>;
            // Row?: Partial<RowProps>;
            // Col?: Partial<ColProps>;
            // Highlight?: Partial<HighlightProps>;
            // Icon?: Partial<IconProps>;
            // Image?: Partial<ImageProps>;
            // Input?: Partial<InputProps>;
            // InputNumber?: Partial<InputNumberProps>;
            // Layout?: Partial<BasicLayoutProps>;
            // List?: Partial<ListProps<any>>;
            Modal?: Partial<ModalReactProps>;
            Navigation?: Partial<NavProps>;
            Notification?: Partial<NoticeReactProps>;
            OverflowList?: Partial<OverflowListProps>;
            // Pagination?: Partial<PaginationProps>;
            Popconfirm?: Partial<PopconfirmProps>;
            Popover?: Partial<PopoverProps>;
            // Progress?: Partial<ProgressProps>;
            // Radio?: Partial<RadioProps>;
            // Rating?: Partial<RatingProps>;
            // ScrollList?: Partial<ScrollListProps>;
            Select?: Partial<SelectProps>;
            SideSheet?: Partial<SideSheetReactProps>;
            // Skeleton?: Partial<SkeletonProps>;
            // Slider?: Partial<SliderProps>;
            // Space?: Partial<SpaceProps>;
            Spin?: Partial<SpinProps>;
            // Steps?: Partial<StepsProps>;
            // Switch?: Partial<SwitchProps>;
            // Table?: Partial<TableProps>;
            Tabs?: Partial<TabsProps>;
            // Tag?: Partial<TagProps>;
            // TagInput?: Partial<TagInputProps>;
            // Timeline?: Partial<TimelineProps>;
            TimePicker?: Partial<TimePickerProps>;
            Toast?: Partial<ToastReactProps>;
            Tooltip?: Partial<TooltipProps>
            // Transfer?: Partial<TransferProps>;
            // Tree?: Partial<TreeProps>;
            // TreeSelect?: Partial<TreeSelectProps>;
            // Typography?: Partial<BaseTypographyProps>;
            // Upload?: Partial<UploadProps>
        }
    }
    = {}
}

export default new SemiGlobal();
