import React, { MouseEvent, useCallback } from 'react';
import { Dropdown, Button } from '../../index';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { Locale } from '../../locale/interface';
import LocaleConsumer from '../../locale/localeConsumer';
import { DropdownProps } from '../../dropdown';

export interface McpOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    [key: string]: any
}

export interface McpProps extends DropdownProps {
    options: McpOption[];
    num?: number;
    onConfigureButtonClick: () => void
}

// because there may be grouping or nested dropdown forms.
const Mcp = React.memo((props: McpProps) => {
    const { className, style, options = [], num = 0, children, onConfigureButtonClick, ...rest } = props;

    const onClick = useCallback((e: MouseEvent) => {
        // Prevent accidental closing of dropdown when clicking Button
        e.stopPropagation();
    }, []);

    return (<Dropdown
        style={style}
        className={cls({
            [className]: className,
            [`${cssClasses.PREFIX}-footer-configure-mcp`]: true,
        })}
        {...rest}
        render={<LocaleConsumer componentName="AIChatInput">
            {(locale: Locale['AIChatInput']) => (<>
                <div className={`${cssClasses.PREFIX}-footer-configure-mcp-header`}>
                    <span className={`${cssClasses.PREFIX}-footer-configure-mcp-header-title`} >
                        {locale.selected.replace('${count}', String(options.length ?? num))}
                    </span>
                    <Button
                        theme='outline'
                        className={`${cssClasses.PREFIX}-footer-configure-mcp-header-config`}
                        onClick={onConfigureButtonClick}
                    >
                        {locale.configure}
                    </Button>
                </div>
                {children ? children : <>
                    <Dropdown.Menu>
                        {options.map((item: any) => (
                            <Dropdown.Item key={item.value} icon={item.icon}>{item.label}</Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </>}
            </>)}
        </LocaleConsumer>}
    >
        <Button
            theme='outline'
            type='tertiary'
            className={`${cssClasses.PREFIX}-footer-configure-mcp-trigger`}
            onClick={onClick}
        >
            MCP · {options.length ?? num}
        </Button>
    </Dropdown>);
});

export default Mcp;