import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M23 12a11 11 0 0 1-11.72 10.98c-1.4-.1-2.28-1.4-2.56-2.79a5.77 5.77 0 0 0-4.91-4.91c-1.39-.28-2.7-1.15-2.79-2.56L1 12a11 11 0 0 1 22 0Zm-6.58.93c.56-.6.57-1.5 0-2.09-.6-.63-1.45-1.43-2.48-2.11-.96-.63-2-.97-2.83-1.15-.95-.2-1.82.4-2.04 1.35-.18.82-.36 1.89-.36 2.96 0 1 .16 2 .33 2.81a1.8 1.8 0 0 0 2.2 1.4c.85-.2 1.86-.54 2.7-1.06.95-.59 1.85-1.44 2.48-2.1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'xigua_logo');
export default IconComponent;
