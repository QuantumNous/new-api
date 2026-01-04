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
                d="M11.94 22.94a1.5 1.5 0 0 1-1.5-1.5V10.06l-4.38 4.38a1.5 1.5 0 1 1-2.12-2.12l6.94-6.94a1.5 1.5 0 0 1 2.12 0l7.06 7.06a1.5 1.5 0 0 1-2.12 2.12l-4.5-4.5v11.38c0 .83-.67 1.5-1.5 1.5Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18.44.94a1.5 1.5 0 1 1 0 3h-13a1.5 1.5 0 1 1 0-3h13Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'back_top');
export default IconComponent;
