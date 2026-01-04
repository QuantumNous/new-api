/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { Component } from 'react';
import {
    IconFile,
    IconFolder,
    IconBranch,
    IconCode,
    IconGit,
    IconChevronRight
} from '@douyinfe/semi-icons';

const TestAction: Record<string, any> = {
    'Files & Folders': [
        {
            icon: <IconFile />,
            key: '1-1',
            type: 'file',
            name: 'TagInput.scss',
            path: 'package/semi-founctaion/TagInput.scss',
        },
        {
            icon: <IconFolder />,
            key: '1-2',
            type: 'folder',
            name: 'package',
            path: '/package',
        },
        {
            icon: <IconFolder />,
            key: '1-3',
            type: 'folder',
            name: 'semi-ui',
            path: '/package/semi-ui',
        },
    ],
    Git: [
        {
            icon: <IconBranch />,
            key: '2-1',
            type: 'branch',
            name: 'fix/tag',
        },
        {
            icon: <IconCode />,
            key: '2-2',
            type: 'code',
            name: 'v2.86.0',
            path: '/package',
        },
        {
            icon: <IconGit />,
            key: '2-3',
            type: 'git',
            name: 'chore: publish',
        },
    ],
};

const FirstLevel = Object.keys(TestAction);

export { TestAction, FirstLevel };

class MentionList extends Component<any, any> {
    constructor(props: any) {
        super(props);
        this.state = {
            selectedIndex: 0,
            level: 1,
            options: FirstLevel,
            filterOptions: FirstLevel,
        };
        props.command({ allowHotKeySend: false });
    }

    componentWillUnmount(): void {
        this.props.command({ allowHotKeySend: true });
    }

    upHandler = () => {
        const { selectedIndex, filterOptions } = this.state;
        this.setState({
            selectedIndex: (selectedIndex + filterOptions.length - 1) % filterOptions.length,
        });
    };

    downHandler = () => {
        const { selectedIndex, filterOptions } = this.state;
        this.setState({
            selectedIndex: (selectedIndex + 1) % filterOptions.length,
        });
    };

    enterHandler = () => {
        const { selectedIndex, level } = this.state;
        if (level === 1) {
            this.setState({
                level: 2,
                options: TestAction[FirstLevel[selectedIndex]],
                selectedIndex: 0,
            });
        } else {
            this.selectItem(selectedIndex);
        }
    };

    selectItem = (id: any) => {
        const { options } = this.state;
        const item = options[id];
        if (item) {
            this.props.command({ item });
        }
    };

    componentDidUpdate(prevProps: any, prevState: any) {
        if (prevProps.items !== this.props.items) {
            this.setState({ selectedIndex: 0 });
        }
        if ( prevState.options !== this.state.options ||
        prevProps.query !== this.props.query
        ) {
        // 手动做的 filter
            let filter = [];
            if (this.props.query?.length) {
                filter = (this.state.options ?? []).filter((item: any) => {
                    let name;
                    if (typeof item === 'string') {
                        name = item;
                    } else {
                        // 移除无用的 @ts-expect-error
                        name = item.name;
                    }
                    return name.toLowerCase().includes(this.props.query.toLowerCase());
                });
            } else {
                filter = this.state.options ?? [];
            }
            this.setState({ filterOptions: filter, selectedIndex: 0 });
        }
    }

    componentDidMount() {
        if (this.props.innerRef) {
            this.props.innerRef.current = {
                onKeyDown: this.onKeyDown,
            };
        }
    }

    onKeyDown = ({ event, exitCb }: any) => {
        if (event.key === 'ArrowUp') {
            this.upHandler();
            return true;
        }
        if (event.key === 'ArrowDown') {
            this.downHandler();
            return true;
        }
        if (event.key === 'Enter') {
            this.enterHandler();
            return true;
        }
        if (event.key === 'Escape') {
            if (this.state.level === 1) {
                exitCb?.();
                return true;
            } else if (this.state.level === 2) {
                this.setState({ level: 1, options: FirstLevel });
                return true;
            }
        }
        return false;
    };

    // 明确参数类型
    renderItem = (item: {
        icon?: React.ReactNode;
        name: string;
        path?: string
    }) => {
        return (
            <div className="level2Item">
                {item.icon}
                <span className="name">{item.name}</span>
                <span className="path">{item.path}</span>
            </div>
        );
    }

    render() {
        const { level, filterOptions, selectedIndex } = this.state;
        return (
            <div className="dropdown-menu" style={{ width: level === 1 ? 200 : 300 }}>
                {filterOptions.length ? (filterOptions.map(
                    (
                        item: | string | { icon?: React.ReactNode; name: string; path?: string },
                        index: number,
                    ) => (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                        <div
                            key={index}
                            className={ index === selectedIndex ? 'is-selected optionItem' : 'optionItem '}
                            onClick={() => {
                                if (level === 1) {
                                    if (typeof item === 'string') {
                                        this.setState({ level: 2, options: TestAction[item] });
                                        this.props.editor.commands.focus();
                                    }
                                } else {
                                    if (typeof item !== 'string') {
                                        this.selectItem(index);
                                    }
                                }
                            }}
                            onMouseEnter={() => {
                                this.setState({ selectedIndex: index });
                            }}
                        >
                            {typeof item === 'string' ? <span>{item}</span> : this.renderItem(item)}
                            {level === 1 && <IconChevronRight className='option-item-arrow'/>}
                        </div>
                    ),
                )) : <div className="item">No result</div>}
            </div>
        );
    }
}

export default MentionList;
