import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getUuidShort, getFillColor } from '../utils';

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const id = getUuidShort({ prefix: 'semi-ai-file-level-3' });
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
                d="M19 1a2 2 0 0 1 2 2v10a1 1 0 1 1-2 0V3H5v18h7a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V3c0-1.1.9-2 2-2h14Zm-1.07 15.4a.6.6 0 0 1 1.14 0c.05.16.1.3.17.45l.04.07a3.99 3.99 0 0 0 1.8 1.8l.07.04a4 4 0 0 0 .44.17.6.6 0 0 1 0 1.14 4 4 0 0 0-.44.17l-.07.04a3.99 3.99 0 0 0-1.8 1.8l-.04.07a4 4 0 0 0-.17.44.6.6 0 0 1-1.14 0 4 4 0 0 0-.17-.44l-.04-.07a3.99 3.99 0 0 0-1.8-1.8l-.07-.04a4 4 0 0 0-.44-.17.6.6 0 0 1 0-1.14 4 4 0 0 0 .44-.17l.07-.04a3.99 3.99 0 0 0 1.8-1.8l.04-.07a4 4 0 0 0 .17-.44Zm.57 2c-.31.41-.69.79-1.1 1.1.41.31.79.69 1.1 1.1.31-.41.69-.79 1.1-1.1-.41-.31-.79-.69-1.1-1.1Zm-4.4-8.1a.43.43 0 0 1 .8 0 2.85 2.85 0 0 0 .57.98l.05.05.15.15.05.05a2.85 2.85 0 0 0 .99.56c.39.13.39.69 0 .82a2.85 2.85 0 0 0-.99.56l-.05.05-.15.15-.05.05a2.85 2.85 0 0 0-.56.99.43.43 0 0 1-.82 0 2.85 2.85 0 0 0-.56-.99l-.05-.05-.15-.15-.05-.05a2.85 2.85 0 0 0-.99-.56.43.43 0 0 1 0-.82 2.85 2.85 0 0 0 .99-.56l.05-.05.15-.15.05-.05a2.85 2.85 0 0 0 .56-.99Zm-4.6 1.2a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h1.5ZM16 6a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2h8Z"
                fill={`url(#${id})`}
            />
            <defs>
                <linearGradient
                    id={id}
                    x1={21.9999}
                    y1={23}
                    x2={0.643144}
                    y2={20.4063}
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
const IconComponent = convertIcon(SvgComponent, 'ai_file_level_3');
export default IconComponent;
