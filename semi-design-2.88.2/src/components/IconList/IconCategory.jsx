import React, { useEffect, useState } from 'react';
import cls from 'classnames';
import { Typography, Collapsible } from '@douyinfe/semi-ui';
import { IconChevronDown } from '@douyinfe/semi-icons';
import SemiIcon from './Icon';
import './index.scss';

const { Title } = Typography;

const IconCategory = props => {
    const { groups, pkgType, className } = props;
    const [categorySet, $categorySet] = useState(new Set());
    useEffect(() => {
        $categorySet(new Set(Array.from(Array(groups.length), (g, i) => i)));
    }, [groups]);

    const handleToggle = (i) => {
        $categorySet((c)=>{
            if (c.has(i)) {
                c.delete(i);
            } else {
                c.add(i);
            }
            return new Set(Array.from(c));
        });
    };
    return groups.map((g, i) => (
        <article key={i} className={`semi-icons-category ${className}`} >
            <Title heading={5}>
                <span id={g[0]} className="semi-icons-title" onClick={() => handleToggle(i)}>
                    {g[0]}&nbsp;&nbsp;
                    <IconChevronDown
                        className={cls({
                            ['semi-icons-title-closed']: !categorySet.has(i),
                            ['semi-icons-title']: true,
                        })}
                    />
                </span>
            </Title>
            <Collapsible
                key={Math.random()}
                isOpen={categorySet.has(i)}
                style={{
                    position: 'relative',
                }}
            >
                <ul className={"semi-icons-content"}>
                    {g[1].map(icon => (
                        <SemiIcon key={icon.name} name={icon.name} pkgType={pkgType} />
                    ))}
                </ul>
            </Collapsible>
        </article>
    ));
};

export default IconCategory;
