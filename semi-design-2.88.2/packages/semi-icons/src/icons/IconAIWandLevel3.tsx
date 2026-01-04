import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getFillColor, getUuidShort } from '../utils';

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const id = getUuidShort({ prefix: 'semi-ai-wand-level-3' });
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
                d="M16.57 2.93a3.18 3.18 0 0 1 4.5 4.5L7.43 21.07a3.18 3.18 0 0 1-4.5-4.5L16.57 2.93Zm.74 11.52a.68.68 0 0 1 1.28 0 4.52 4.52 0 0 0 .24.57c.44.9 1.16 1.6 2.04 2.05a4.65 4.65 0 0 0 .58.24.68.68 0 0 1 0 1.28l-.5.2-.07.04a4.52 4.52 0 0 0-2.05 2.04 4.65 4.65 0 0 0-.24.58.68.68 0 0 1-1.28 0 4.54 4.54 0 0 0-.24-.57 4.52 4.52 0 0 0-2.05-2.05l-.08-.04a4.52 4.52 0 0 0-.5-.2.68.68 0 0 1 0-1.28 4.52 4.52 0 0 0 .58-.24 4.52 4.52 0 0 0 2.05-2.05 4.02 4.02 0 0 0 .24-.57ZM4.33 17.97a1.2 1.2 0 0 0 1.7 1.7L16.61 9.09l-1.7-1.7L4.33 17.97Zm13.62-1.28c-.36.48-.78.9-1.26 1.26.48.36.9.78 1.26 1.26.36-.48.78-.9 1.26-1.26-.48-.36-.9-.78-1.26-1.26ZM5.57 2.43a.5.5 0 0 1 .96 0 3.4 3.4 0 0 0 2.15 2.15.5.5 0 0 1 0 .96A3.4 3.4 0 0 0 6.53 7.7a.5.5 0 0 1-.96 0 3.4 3.4 0 0 0-2.15-2.15.5.5 0 0 1 0-.96 3.4 3.4 0 0 0 2.15-2.15Zm14.1 1.9a1.2 1.2 0 0 0-1.7 0L16.3 6l1.7 1.7 1.66-1.66a1.2 1.2 0 0 0 0-1.7Z"
                fill={`url(#${id})`}
            />
            <defs>
                <linearGradient
                    id={id}
                    x1={22}
                    y1={22}
                    x2={-0.370122}
                    y2={18.8542}
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
const IconComponent = convertIcon(SvgComponent, 'ai_wand_level_3');
export default IconComponent;
