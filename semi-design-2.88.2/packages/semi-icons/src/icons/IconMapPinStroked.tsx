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
                d="M19 10a8.6 8.6 0 0 1-.94 3.47 20.67 20.67 0 0 1-2.39 3.83c-.93 1.2-1.9 2.21-2.71 2.9-.4.34-.72.57-.96.7a7.07 7.07 0 0 1-.96-.7c-.81-.69-1.78-1.7-2.71-2.9a20.67 20.67 0 0 1-2.4-3.83A8.6 8.6 0 0 1 5 10c0-2.26.74-3.97 1.88-5.12C8.03 3.74 9.74 3 12 3c2.26 0 3.97.74 5.12 1.88C18.26 6.03 19 7.74 19 10Zm2 0c0 5.42-7 13-9 13s-9-7.58-9-13 3.58-9 9-9 9 3.58 9 9Zm-9 3a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm2-4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'map_pin_stroked');
export default IconComponent;
