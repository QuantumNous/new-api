import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import {
    noop,
    isString,
    isArray,
    isNull,
    isUndefined,
    isFunction
} from 'lodash';
import { cssClasses, strings } from '@douyinfe/semi-foundation/tagInput/constants';
import '@douyinfe/semi-foundation/tagInput/tagInput.scss';
import TagInputFoundation, { TagInputAdapter, OnSortEndProps } from '@douyinfe/semi-foundation/tagInput/foundation';
import { ArrayElement } from '../_base/base';
import { isSemiIcon } from '../_utils';
import BaseComponent from '../_base/baseComponent';
import Tag from '../tag';
import Input from '../input';
import Popover, { PopoverProps } from '../popover';
import Paragraph from '../typography/paragraph';
import { IconClear, IconHandle } from '@douyinfe/semi-icons';
import { ShowTooltip } from '../typography';
import { RenderItemProps, Sortable } from '../_sortable';

const prefixCls = cssClasses.PREFIX;

export type Size = ArrayElement<typeof strings.SIZE_SET>;
export type RestTagsPopoverProps = PopoverProps;
type ValidateStatus = "default" | "error" | "warning";

function SortContainer(props) {
    return <div className={`${prefixCls}-sortable-list`} {...props}></div>;
}

export interface TagInputProps {
    className?: string;
    clearIcon?: React.ReactNode;
    defaultValue?: string[];
    disabled?: boolean;
    inputValue?: string;
    maxLength?: number;
    max?: number;
    maxTagCount?: number;
    showRestTagsPopover?: boolean;
    restTagsPopoverProps?: RestTagsPopoverProps;
    showContentTooltip?: boolean | ShowTooltip;
    allowDuplicates?: boolean;
    addOnBlur?: boolean;
    draggable?: boolean;
    expandRestTagsOnClick?: boolean;
    onAdd?: (addedValue: string[]) => void;
    onBlur?: (e: React.MouseEvent<HTMLInputElement>) => void;
    onChange?: (value: string[]) => void;
    onExceed?: ((value: string[]) => void);
    onFocus?: (e: React.MouseEvent<HTMLInputElement>) => void;
    onInputChange?: (value: string, e: React.MouseEvent<HTMLInputElement>) => void;
    onInputExceed?: ((value: string) => void);
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onRemove?: (removedValue: string, idx: number) => void;
    placeholder?: string;
    insetLabel?: React.ReactNode;
    insetLabelId?: string;
    prefix?: React.ReactNode;
    renderTagItem?: (value: string, index: number, onClose: () => void) => React.ReactNode;
    separator?: string | string[] | null;
    showClear?: boolean;
    size?: Size;
    style?: React.CSSProperties;
    suffix?: React.ReactNode;
    validateStatus?: ValidateStatus;
    value?: string[];
    autoFocus?: boolean;
    'aria-label'?: string;
    preventScroll?: boolean
}

export interface TagInputState {
    tagsArray?: string[];
    inputValue?: string;
    focusing?: boolean;
    hovering?: boolean;
    active?: boolean;
    // entering: Used to identify whether the user is in a new composition session（eg，Input Chinese）
    entering?: boolean
}

class TagInput extends BaseComponent<TagInputProps, TagInputState> {
    static propTypes = {
        children: PropTypes.node,
        clearIcon: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        allowDuplicates: PropTypes.bool,
        max: PropTypes.number,
        maxTagCount: PropTypes.number,
        maxLength: PropTypes.number,
        showRestTagsPopover: PropTypes.bool,
        restTagsPopoverProps: PropTypes.object,
        showContentTooltip: PropTypes.oneOfType([
            PropTypes.shape({
                type: PropTypes.string,
                opts: PropTypes.object,
            }),
            PropTypes.bool,
        ]),
        defaultValue: PropTypes.array,
        value: PropTypes.array,
        inputValue: PropTypes.string,
        placeholder: PropTypes.string,
        separator: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        showClear: PropTypes.bool,
        addOnBlur: PropTypes.bool,
        draggable: PropTypes.bool,
        expandRestTagsOnClick: PropTypes.bool,
        autoFocus: PropTypes.bool,
        renderTagItem: PropTypes.func,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onChange: PropTypes.func,
        onInputChange: PropTypes.func,
        onExceed: PropTypes.func,
        onInputExceed: PropTypes.func,
        onAdd: PropTypes.func,
        onRemove: PropTypes.func,
        onKeyDown: PropTypes.func,
        size: PropTypes.oneOf(strings.SIZE_SET),
        validateStatus: PropTypes.oneOf(strings.STATUS),
        prefix: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        suffix: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        'aria-label': PropTypes.string,
        preventScroll: PropTypes.bool,
    };

    static defaultProps = {
        showClear: false,
        addOnBlur: false,
        allowDuplicates: true,
        showRestTagsPopover: true,
        autoFocus: false,
        draggable: false,
        expandRestTagsOnClick: true,
        showContentTooltip: true,
        separator: ',',
        size: 'default' as const,
        validateStatus: 'default' as const,
        onBlur: noop,
        onFocus: noop,
        onChange: noop,
        onInputChange: noop,
        onExceed: noop,
        onInputExceed: noop,
        onAdd: noop,
        onRemove: noop,
        onKeyDown: noop,
    };

    inputRef: React.RefObject<HTMLInputElement>;
    tagInputRef: React.RefObject<HTMLDivElement>;
    foundation: TagInputFoundation;
    clickOutsideHandler: any;

    constructor(props: TagInputProps) {
        super(props);
        this.foundation = new TagInputFoundation(this.adapter);
        this.state = {
            tagsArray: props.defaultValue || [],
            inputValue: '',
            focusing: false,
            hovering: false,
            active: false,
            entering: false,
        };
        this.inputRef = React.createRef();
        this.tagInputRef = React.createRef();
        this.clickOutsideHandler = null;
    }

    static getDerivedStateFromProps(nextProps: TagInputProps, prevState: TagInputState) {
        const { value, inputValue } = nextProps;
        const { tagsArray: prevTagsArray } = prevState;
        let tagsArray: string[];
        if (isArray(value)) {
            tagsArray = value;
        } else if ('value' in nextProps && !value) {
            tagsArray = [];
        } else {
            tagsArray = prevTagsArray;
        }
        return {
            tagsArray,
            inputValue: isString(inputValue) ? inputValue : prevState.inputValue
        };
    }

    get adapter(): TagInputAdapter {
        return {
            ...super.adapter,
            setInputValue: (inputValue: string) => {
                this.setState({ inputValue });
            },
            setTagsArray: (tagsArray: string[]) => {
                this.setState({ tagsArray });
            },
            setFocusing: (focusing: boolean) => {
                this.setState({ focusing });
            },
            toggleFocusing: (isFocus: boolean) => {
                const { preventScroll } = this.props;
                const input = this.inputRef && this.inputRef.current;
                if (isFocus) {
                    input && input.focus({ preventScroll });
                } else {
                    input && input.blur();
                }
                this.setState({ focusing: isFocus });
            },
            setHovering: (hovering: boolean) => {
                this.setState({ hovering });
            },
            setActive: (active: boolean) => {
                this.setState({ active });
            },
            setEntering: (entering: boolean) => {
                this.setState({ entering });
            },
            getClickOutsideHandler: () => {
                return this.clickOutsideHandler;
            },
            notifyBlur: (e: React.MouseEvent<HTMLInputElement>) => {
                this.props.onBlur(e);
            },
            notifyFocus: (e: React.MouseEvent<HTMLInputElement>) => {
                this.props.onFocus(e);
            },
            notifyInputChange: (v: string, e: React.MouseEvent<HTMLInputElement>) => {
                this.props.onInputChange(v, e);
            },
            notifyTagChange: (v: string[]) => {
                this.props.onChange(v);
            },
            notifyTagAdd: (v: string[]) => {
                this.props.onAdd(v);
            },
            notifyTagRemove: (v: string, idx: number) => {
                this.props.onRemove(v, idx);
            },
            notifyKeyDown: e => {
                this.props.onKeyDown(e);
            },
            registerClickOutsideHandler: cb => {
                const clickOutsideHandler = (e: Event) => {
                    const tagInputDom = this.tagInputRef && this.tagInputRef.current;
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];
                    if (tagInputDom && !tagInputDom.contains(target) && !path.includes(tagInputDom)) {
                        cb(e);
                    }
                };
                this.clickOutsideHandler = clickOutsideHandler;
                document.addEventListener('click', clickOutsideHandler, false);
            },
            unregisterClickOutsideHandler: () => {
                document.removeEventListener('click', this.clickOutsideHandler, false);
                this.clickOutsideHandler = null;
            },
        };
    }

    componentDidMount() {
        const { disabled, autoFocus, preventScroll } = this.props;
        if (!disabled && autoFocus) {
            this.inputRef.current.focus({ preventScroll });
            this.foundation.handleClick();
        }
        this.foundation.init();
    }

    handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.foundation.handleInputChange(e);
    };

    handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        this.foundation.handleKeyDown(e);
    };

    handleInputFocus = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleInputFocus(e);
    };

    handleInputBlur = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleInputBlur(e);
    };

    handleClearBtn = (e: React.MouseEvent<HTMLDivElement>) => {
        this.foundation.handleClearBtn(e);
    };

    /* istanbul ignore next */
    handleClearEnterPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        this.foundation.handleClearEnterPress(e);
    };

    handleTagClose = (idx: number) => {
        this.foundation.handleTagClose(idx);
    };

    handleInputMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        this.foundation.handleInputMouseLeave();
    };

    handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        this.foundation.handleClick(e);
    };

    handleInputMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        this.foundation.handleInputMouseEnter();
    };

    handleClickPrefixOrSuffix = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handleClickPrefixOrSuffix(e);
    };

    handlePreventMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
        this.foundation.handlePreventMouseDown(e);
    };


    renderClearBtn() {
        const { hovering, tagsArray, inputValue } = this.state;
        const { showClear, disabled, clearIcon } = this.props;
        const clearCls = cls(`${prefixCls}-clearBtn`, {
            [`${prefixCls}-clearBtn-invisible`]: !hovering || (inputValue === '' && tagsArray.length === 0) || disabled,
        });
        if (showClear) {
            return (
                <div
                    role="button"
                    tabIndex={0}
                    aria-label="Clear TagInput value"
                    className={clearCls}
                    onClick={e => this.handleClearBtn(e)}
                    onKeyPress={e => this.handleClearEnterPress(e)}
                >
                    { clearIcon ? clearIcon : <IconClear />}
                </div>
            );
        }
        return null;
    }

    renderPrefix() {
        const { prefix, insetLabel, insetLabelId } = this.props;
        const labelNode = prefix || insetLabel;
        if (isNull(labelNode) || isUndefined(labelNode)) {
            return null;
        }
        const prefixWrapperCls = cls(`${prefixCls}-prefix`, {
            [`${prefixCls}-inset-label`]: insetLabel,
            [`${prefixCls}-prefix-text`]: labelNode && isString(labelNode),
            [`${prefixCls}-prefix-icon`]: isSemiIcon(labelNode),
        });
        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
            <div
                className={prefixWrapperCls}
                onMouseDown={this.handlePreventMouseDown}
                onClick={this.handleClickPrefixOrSuffix}
                id={insetLabelId} x-semi-prop="prefix"
            >
                {labelNode}
            </div>
        );
    }

    renderSuffix() {
        const { suffix } = this.props;
        if (isNull(suffix) || isUndefined(suffix)) {
            return null;
        }
        const suffixWrapperCls = cls(`${prefixCls}-suffix`, {
            [`${prefixCls}-suffix-text`]: suffix && isString(suffix),
            [`${prefixCls}-suffix-icon`]: isSemiIcon(suffix),
        });
        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
            <div
                className={suffixWrapperCls}
                onMouseDown={this.handlePreventMouseDown}
                onClick={this.handleClickPrefixOrSuffix}
                x-semi-prop="suffix"
            >
                {suffix}
            </div>
        );
    }

    getAllTags = () => {
        const { tagsArray } = this.state;
        return tagsArray.map((value, index) => this.renderTag(value, index));
    }

    renderTag = (value: any, index: number, sortableHandle?: any) => {
        const {
            size,
            disabled,
            renderTagItem,
            showContentTooltip,
            draggable,
        } = this.props;
        const { active } = this.state;
        const showIconHandler = active && draggable;
        const tagCls = cls(`${prefixCls}-wrapper-tag`, {
            [`${prefixCls}-wrapper-tag-size-${size}`]: size,
            [`${prefixCls}-wrapper-tag-icon`]: showIconHandler,
        });
        const typoCls = cls(`${prefixCls}-wrapper-typo`, {
            [`${prefixCls}-wrapper-typo-disabled`]: disabled,
        });
        const itemWrapperCls = cls({
            [`${prefixCls}-drag-item`]: showIconHandler,
            [`${prefixCls}-wrapper-tag-icon`]: showIconHandler,
        });
        const DragHandle = sortableHandle && sortableHandle(() => <IconHandle className={`${prefixCls}-drag-handler`}></IconHandle>);
        const elementKey = showIconHandler ? value : `${index}${value}`;
        const onClose = () => {
            !disabled && this.handleTagClose(index);
        };
        if (isFunction(renderTagItem)) {
            if (showIconHandler && sortableHandle) {
                return (
                    <div className={itemWrapperCls} key={elementKey}>
                        <DragHandle />
                        {renderTagItem(value, index, onClose)}
                    </div>
                );
            } else {
                return renderTagItem(value, index, onClose);
            }
        } else {
            return (
                <Tag
                    className={tagCls}
                    color="white"
                    size={size === 'small' ? 'small' : 'large'}
                    type="light"
                    onClose={onClose}
                    closable={!disabled}
                    key={elementKey}
                    visible
                    aria-label={`${!disabled ? 'Closable ' : ''}Tag: ${value}`}
                >
                    {showIconHandler && sortableHandle ? <DragHandle /> : null}
                    <Paragraph
                        className={typoCls}
                        ellipsis={{ showTooltip: showContentTooltip, rows: 1 }}
                    >
                        {value}
                    </Paragraph>
                </Tag>
            );
        }
    }

    renderSortTag = (props: RenderItemProps) => {
        const { id: item, sortableHandle } = props;
        const { tagsArray } = this.state;
        const index = tagsArray.indexOf(item as string);
        return this.renderTag(item, index, sortableHandle);
    }

    onSortEnd = (callbackProps: OnSortEndProps) => {
        this.foundation.handleSortEnd(callbackProps);
    }

    renderTags() {
        const {
            disabled,
            maxTagCount,
            showRestTagsPopover,
            restTagsPopoverProps = {},
            draggable,
            expandRestTagsOnClick,
        } = this.props;
        const { tagsArray, active } = this.state;
        const restTagsCls = cls(`${prefixCls}-wrapper-n`, {
            [`${prefixCls}-wrapper-n-disabled`]: disabled,
        });
        const allTags = this.getAllTags();
        let restTags: Array<React.ReactNode> = [];
        let tags: Array<React.ReactNode> = [...allTags];
        if (( !active || !expandRestTagsOnClick) && maxTagCount && maxTagCount < allTags.length) {
            tags = allTags.slice(0, maxTagCount);
            restTags = allTags.slice(maxTagCount);
        }

        const restTagsContent = (
            <span className={restTagsCls}>+{tagsArray.length - maxTagCount}</span>
        );

        const sortableListItems = allTags.map((item, index) => ({
            item: item,
            key: tagsArray[index],
        }));

        if (active && draggable && sortableListItems.length > 0) {
            return <Sortable 
                items={tagsArray} 
                onSortEnd={this.onSortEnd} 
                renderItem={this.renderSortTag} 
                container={SortContainer}
                prefix={prefixCls}
                transition={null}
                dragOverlayCls={`${prefixCls}-right-item-drag-item-move`}
            />;
        }
        return (
            <>
                {tags}
                {
                    restTags.length > 0 &&
                    (
                        showRestTagsPopover ?
                            (
                                <Popover
                                    content={restTags}
                                    showArrow
                                    trigger="hover"
                                    position="top"
                                    autoAdjustOverflow
                                    {...restTagsPopoverProps}
                                >
                                    {restTagsContent}
                                </Popover>
                            ) : restTagsContent
                    )
                }
            </>
        );
    }

    blur() {
        this.inputRef.current.blur();
        // unregister clickOutside event
        this.foundation.clickOutsideCallBack();
    }

    focus() {
        const { preventScroll, disabled } = this.props;
        this.inputRef.current.focus({ preventScroll });
        if (!disabled) {
            // register clickOutside event
            this.foundation.handleClick();
        }
    }

    handleInputCompositionStart = (e) => {
        this.foundation.handleInputCompositionStart(e);
    }

    handleInputCompositionEnd = (e) => {
        this.foundation.handleInputCompositionEnd(e);
    }

    render() {
        const {
            size,
            style,
            className,
            disabled,
            placeholder,
            validateStatus,
            prefix,
            insetLabel,
            suffix,
            ...rest
        } = this.props;

        const {
            focusing,
            hovering,
            tagsArray,
            inputValue,
            active,
        } = this.state;

        const tagInputCls = cls(prefixCls, className, {
            [`${prefixCls}-focus`]: focusing || active,
            [`${prefixCls}-disabled`]: disabled,
            [`${prefixCls}-hover`]: hovering && !disabled,
            [`${prefixCls}-error`]: validateStatus === 'error',
            [`${prefixCls}-warning`]: validateStatus === 'warning',
            [`${prefixCls}-small`]: size === 'small',
            [`${prefixCls}-large`]: size === 'large',
            [`${prefixCls}-with-prefix`]: !!prefix || !!insetLabel,
            [`${prefixCls}-with-suffix`]: !!suffix,
        });

        const inputCls = cls(`${prefixCls}-wrapper-input`, `${prefixCls}-wrapper-input-${size}`);

        const wrapperCls = cls(`${prefixCls}-wrapper`);

        return (
            // eslint-disable-next-line
            <div
                ref={this.tagInputRef}
                style={style}
                className={tagInputCls}
                aria-disabled={disabled}
                aria-label={this.props['aria-label']}
                aria-invalid={validateStatus === 'error'}
                onMouseEnter={e => {
                    this.handleInputMouseEnter(e);
                }}
                onMouseLeave={e => {
                    this.handleInputMouseLeave(e);
                }}
                onClick={e => {
                    this.handleClick(e);
                }}
                {...this.getDataAttr(rest)}
            >
                {this.renderPrefix()}
                <div className={wrapperCls}>
                    {this.renderTags()}
                    <Input
                        aria-label='input value'
                        ref={this.inputRef as any}
                        className={inputCls}
                        disabled={disabled}
                        value={inputValue}
                        size={size}
                        placeholder={tagsArray.length === 0 ? placeholder : ''}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            this.handleKeyDown(e);
                        }}
                        onChange={(v: string, e: React.ChangeEvent<HTMLInputElement>) => {
                            this.handleInputChange(e);
                        }}
                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                            this.handleInputBlur(e as any);
                        }}
                        onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                            this.handleInputFocus(e as any);
                        }}
                        onCompositionStart={this.handleInputCompositionStart}
                        onCompositionEnd={this.handleInputCompositionEnd}
                    />
                </div>
                {this.renderClearBtn()}
                {this.renderSuffix()}
            </div>
        );
    }
}

export default TagInput;
export { ValidateStatus };
