import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getFillColor, getUuidShort } from '../utils';

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const id = getUuidShort({ prefix: 'semi-ai-image-level-3' });
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
                d="M12 2a1 1 0 1 1 0 2H4v11.23l3.67-3.37.15-.12a2 2 0 0 1 2.5.08l3.2 2.74 2.16-2.15a2 2 0 0 1 2.61-.19L20 13.5V12a1 1 0 1 1 2 0v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h8ZM4 17.94V20h16v-4l-2.9-2.18-2.05 2.05 1.6 1.37a1 1 0 0 1-1.3 1.52l-6.33-5.42L4 17.94ZM17.93 2.4a.6.6 0 0 1 1.14 0c.05.15.1.3.17.44l.04.07a3.99 3.99 0 0 0 1.8 1.8l.07.04a4 4 0 0 0 .44.17.6.6 0 0 1 0 1.14 4 4 0 0 0-.44.17l-.07.04a3.99 3.99 0 0 0-1.8 1.8l-.04.07a4 4 0 0 0-.17.44.6.6 0 0 1-1.14 0 4 4 0 0 0-.17-.44l-.04-.07a3.99 3.99 0 0 0-1.8-1.8l-.07-.04a4 4 0 0 0-.44-.17.6.6 0 0 1 0-1.14 4 4 0 0 0 .44-.17l.07-.04a3.99 3.99 0 0 0 1.8-1.8l.04-.07a4 4 0 0 0 .17-.44Zm.57 1.98c-.31.42-.69.8-1.1 1.11.41.31.79.69 1.1 1.1.31-.41.69-.79 1.1-1.1-.41-.31-.79-.69-1.1-1.1Z"
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
const IconComponent = convertIcon(SvgComponent, 'ai_image_level_3');
export default IconComponent;
