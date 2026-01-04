import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getUuidShort, getFillColor } from '../utils';

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const id = getUuidShort({ prefix: 'semi-ai-bell-level-3' });
    const arr = getFillColor(fill, 4);
    const [stop1, stop2, stop3, stop4] = arr;
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
                d="M20 20a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2h16ZM12 3.5a1 1 0 0 1 0 2 5 5 0 0 0-5 5v6h10V14a1 1 0 1 1 2 0v3.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a7 7 0 0 1 7-7Zm5.35-.03a.68.68 0 0 1 1.3 0c.06.17.12.34.2.5l.04.08c.44.9 1.17 1.62 2.06 2.06l.08.04c.16.08.33.14.5.2a.68.68 0 0 1 0 1.3c-.17.06-.34.12-.5.2l-.08.04a4.56 4.56 0 0 0-2.06 2.06l-.04.08c-.08.16-.14.33-.2.5a.68.68 0 0 1-1.3 0 4.56 4.56 0 0 0-.2-.5l-.04-.08a4.56 4.56 0 0 0-2.06-2.06l-.08-.04a4.58 4.58 0 0 0-.5-.2.68.68 0 0 1 0-1.3c.17-.06.34-.12.5-.2l.08-.04a4.56 4.56 0 0 0 2.06-2.06l.04-.08c.08-.16.14-.33.2-.5ZM18 5.73c-.36.48-.79.91-1.27 1.27.48.36.91.79 1.27 1.27.36-.48.79-.91 1.27-1.27A6.2 6.2 0 0 1 18 5.73Zm-16.95.45a1 1 0 0 1 1.17-.66l.1.03 1.5.5.1.04a1 1 0 0 1-.64 1.89l-.1-.03-1.5-.5-.1-.04a1 1 0 0 1-.53-1.23ZM2.8 2.8a1 1 0 0 1 1.34-.07l.08.07 1.5 1.5.07.08a1 1 0 0 1-1.41 1.4l-.08-.06-1.5-1.5-.07-.08A1 1 0 0 1 2.8 2.8Zm3.4-1.74a1 1 0 0 1 1.22.54l.04.1.5 1.5.03.1a1 1 0 0 1-1.9.62l-.03-.1-.5-1.5-.03-.1a1 1 0 0 1 .66-1.16Z"
                fill={`url(#${id})`}
            />
            <defs>
                <linearGradient
                    id={id}
                    x1={21.9997}
                    y1={21.9998}
                    x2={-1.48859}
                    y2={18.6968}
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
const IconComponent = convertIcon(SvgComponent, 'ai_bell_level_3');
export default IconComponent;
