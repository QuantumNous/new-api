import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getUuidShort, getFillColor } from '../utils';

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const id = getUuidShort({ prefix: 'semi-ai-edit-level-3' });
    const [stop1, stop2, stop3, stop4] = getFillColor(fill, 4);
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...rest}
        >
            <path
                d="M16.28 5.04a2 2 0 0 1 2.83 0l2.15 2.14a2 2 0 0 1 0 2.84L11.24 20.04c-.7.7-1.6 1.18-2.56 1.37l-2.97.6a1.2 1.2 0 0 1-1.42-1.42l.6-2.97c.19-.97.67-1.86 1.37-2.56L16.28 5.04Zm-8.6 11.43a3 3 0 0 0-.83 1.54l-.36 1.8 1.8-.37c.58-.11 1.11-.4 1.53-.82l7.3-7.29-2.16-2.15-7.29 7.3ZM5.56 2.5a.69.69 0 0 1 1.3 0c.06.17.12.34.2.5l.04.08c.44.9 1.17 1.62 2.07 2.07l.08.04.5.2c.62.2.62 1.09 0 1.3-.17.06-.34.12-.5.2l-.08.04A4.57 4.57 0 0 0 7.1 9l-.04.08c-.08.16-.14.33-.2.5a.69.69 0 0 1-1.3 0 4.57 4.57 0 0 0-.2-.5L5.33 9a4.57 4.57 0 0 0-2.07-2.07l-.08-.04a4.58 4.58 0 0 0-.5-.2.69.69 0 0 1 0-1.3l.5-.2.08-.04a4.57 4.57 0 0 0 2.07-2.07L5.37 3l.2-.5Zm10.81 5.27 2.15 2.14 1.31-1.3-2.15-2.15-1.3 1.3Zm-10.16-3c-.36.48-.8.9-1.27 1.27.48.36.9.79 1.27 1.27.36-.48.79-.91 1.27-1.27a6.23 6.23 0 0 1-1.27-1.27Z"
                fill={`url(#${id})`}
            />
            <defs>
                <linearGradient
                    id={id}
                    x1={21.8469}
                    y1={22.0288}
                    x2={-0.135689}
                    y2={18.9934}
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor={stop1} />
                    <stop offset={0.3} stopColor={stop2} />
                    <stop offset={0.6} stopColor={stop3} />
                    <stop offset={1} stopColor={stop4} />
                </linearGradient>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ai_edit_level_3');
export default IconComponent;
