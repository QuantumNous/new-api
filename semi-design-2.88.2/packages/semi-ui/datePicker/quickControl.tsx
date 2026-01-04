/* eslint-disable jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/datePicker/constants';
import Button from '../button/index';
import Typography from '../typography/index';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import { PresetsType, PresetType } from '@douyinfe/semi-foundation/datePicker/foundation';
import { DateInputFoundationProps } from '@douyinfe/semi-foundation/datePicker/inputFoundation';

const prefixCls = cssClasses.PREFIX;
const { Text } = Typography;

export interface QuickControlProps {
    presets: PresetsType;
    presetPosition: typeof strings.PRESET_POSITION_SET[number];
    onPresetClick: (preset: PresetType, e: React.MouseEvent) => void;
    type: string;
    insetInput: DateInputFoundationProps['insetInput'];
    locale: any
}

class QuickControl extends PureComponent<QuickControlProps> {
    static propTypes = {
        presets: PropTypes.array,
        presetPosition: PropTypes.oneOf(strings.PRESET_POSITION_SET),
        onPresetClick: PropTypes.func,
        type: PropTypes.string,
        insetInput: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
        locale: PropTypes.object,
    };

    static defaultProps = {
        presets: [] as PresetsType,
        presetPosition: 'bottom',
        onPresetClick: noop,
    };

    render() {
        const { presets, onPresetClick, type, presetPosition, insetInput, locale } = this.props;
        const isTypeRange = type === 'dateRange' || type === 'dateTimeRange';
        const isPanelTopAndBottom = presetPosition === 'top' || presetPosition === 'bottom';
        const isMonth = type === 'month';
        const isTopAndBottomRange = isPanelTopAndBottom && isTypeRange;
        const isTopAndBottomMonth = isPanelTopAndBottom && isMonth;

        const wrapperCls = classNames(`${prefixCls}-quick-control`, {
            [`${prefixCls}-quick-control-${type}`]: type,
            [`${prefixCls}-quick-control-${presetPosition}`]: true,
        });
        const headerCls = classNames({
            [`${prefixCls}-quick-control-header`]: true,
        });
        const contentWrapperCls = classNames({
            [`${prefixCls}-quick-control-${presetPosition}-content-wrapper`]: true,
        });
        const contentCls = classNames({
            [`${prefixCls}-quick-control-${presetPosition}-content`]: !isTopAndBottomRange && !isTopAndBottomMonth,
            [`${prefixCls}-quick-control-${presetPosition}-range-content`]: isTopAndBottomRange,
            [`${prefixCls}-quick-control-${presetPosition}-month-content`]: isTopAndBottomMonth,
        });
        const itemCls = classNames({
            [`${prefixCls}-quick-control-${presetPosition}-content-item`]: !isTopAndBottomRange && !isTopAndBottomMonth,
            [`${prefixCls}-quick-control-${presetPosition}-range-content-item`]: isTopAndBottomRange,
            [`${prefixCls}-quick-control-${presetPosition}-month-content-item`]: isTopAndBottomMonth,
        });
        const ellipsisCls = classNames({
            [`${prefixCls}-quick-control-${presetPosition}-content-item-ellipsis`]: !isTopAndBottomRange && !isTopAndBottomMonth,
            [`${prefixCls}-quick-control-${presetPosition}-range-content-item-ellipsis`]: isTopAndBottomRange,
            [`${prefixCls}-quick-control-${presetPosition}-month-content-item-ellipsis`]: isTopAndBottomMonth,
        });


        if (!presets.length) {
            return null;
        }
        return (
            <div className={wrapperCls} x-insetinput={insetInput ? "true" : "false"}>
                {!isPanelTopAndBottom && <div className={headerCls}>{locale.presets}</div>}
                <div className={contentWrapperCls}>
                    <div className={contentCls}>
                        {presets.map((item, index) => {
                            const _item: PresetType = typeof item === 'function' ? item() : item;
                            return (
                                <Button size="small" type="primary" onClick={e => onPresetClick(_item, e)} key={index}>
                                    <div className={itemCls}>
                                        <Text
                                            ellipsis={{ showTooltip: true }}
                                            className={ellipsisCls}
                                        >
                                            {_item.text}
                                        </Text>
                                    </div>
                                </Button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
}
export default QuickControl;
