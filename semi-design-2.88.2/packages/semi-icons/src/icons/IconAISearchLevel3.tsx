import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getFillColor, getUuidShort } from '../utils';

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const id = getUuidShort({ prefix: 'semi-ai-search-level-3' });
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
                d="M10 2a1 1 0 1 1 0 2 6 6 0 1 0 6 6 1 1 0 0 1 2 0 8 8 0 0 1-1.68 4.9l5.39 5.4a1 1 0 1 1-1.42 1.4l-5.39-5.38A8 8 0 1 1 10 2Zm4.93-.6a.6.6 0 0 1 1.14 0c.05.16.1.3.17.45l.04.07a3.99 3.99 0 0 0 1.8 1.8l.07.04a4 4 0 0 0 .44.17.6.6 0 0 1 0 1.14 4 4 0 0 0-.44.17l-.07.04a4 4 0 0 0-1.8 1.8 3.8 3.8 0 0 0-.21.51.6.6 0 0 1-1.14 0 4 4 0 0 0-.17-.44l-.04-.07a3.95 3.95 0 0 0-2.31-2.01.6.6 0 0 1 0-1.14 4 4 0 0 0 .5-.2 4 4 0 0 0 1.81-1.81l.04-.07a4 4 0 0 0 .17-.44Zm.57 2c-.31.41-.69.79-1.1 1.1.41.31.79.69 1.1 1.1.31-.41.69-.79 1.11-1.1-.42-.31-.8-.69-1.11-1.1Z"
                fill={`url(#${id})`}
            />
            <defs>
                <linearGradient
                    id={id}
                    x1={22.0001}
                    y1={21.9998}
                    x2={-0.410523}
                    y2={18.9983}
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
const IconComponent = convertIcon(SvgComponent, 'ai_search_level_3');
export default IconComponent;
