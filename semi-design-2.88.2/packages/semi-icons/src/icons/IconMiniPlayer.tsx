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
                d="M15.5 22a1.5 1.5 0 0 1-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5h-5Z"
                fill="currentColor"
            />
            <path
                d="M5.5 22A3.5 3.5 0 0 1 2 18.5v-13A3.5 3.5 0 0 1 5.5 2h13A3.5 3.5 0 0 1 22 5.5v4.25a1.5 1.5 0 0 1-3 0V5.5a.5.5 0 0 0-.5-.5h-13a.5.5 0 0 0-.5.5v13c0 .28.22.5.5.5h4.25a1.5 1.5 0 0 1 0 3H5.5Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.52 7.19a1 1 0 0 0 0 1.41l2.95 2.95h-.83a1 1 0 1 0 0 2h3.24a1 1 0 0 0 1-1V9.31a1 1 0 1 0-2 0v.83L8.93 7.19a1 1 0 0 0-1.41 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'mini_player');
export default IconComponent;
