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
                d="M12 2a1 1 0 1 1 0 2H4v11.23l3.67-3.37.15-.12a2 2 0 0 1 2.5.08l3.2 2.74 2.16-2.15a2 2 0 0 1 2.61-.19L20 13.5V12a1 1 0 1 1 2 0v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h8ZM4 17.94V20h16v-4l-2.9-2.18-2.05 2.05 1.6 1.37a1 1 0 0 1-1.3 1.52l-6.33-5.42L4 17.94Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.72 2.92a3.99 3.99 0 0 1-1.8 1.8 4.28 4.28 0 0 1-.51.21.6.6 0 0 0 0 1.14 3.99 3.99 0 0 1 .5.2 3.99 3.99 0 0 1 1.81 1.81 4.4 4.4 0 0 1 .21.51.6.6 0 0 0 1.14 0 3.98 3.98 0 0 1 .2-.5 3.99 3.99 0 0 1 1.81-1.81 4.2 4.2 0 0 1 .51-.21.6.6 0 0 0 0-1.14 3.99 3.99 0 0 1-.5-.2 3.99 3.99 0 0 1-1.81-1.81 4.4 4.4 0 0 1-.21-.51.6.6 0 0 0-1.14 0 3.98 3.98 0 0 1-.2.5Zm.78 1.47c-.31.42-.69.8-1.11 1.11.42.31.8.69 1.11 1.11.31-.42.69-.8 1.11-1.11-.42-.31-.8-.69-1.11-1.11Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ai_image_level_1');
export default IconComponent;
