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
                d="M10 5V4h4v1h-4ZM8 5V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2h4a1 1 0 1 1 0 2h-1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7H4a1 1 0 0 1 0-2h4Zm7 2H7v13h10V7h-2ZM9 9.5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v7a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-7Zm4 0c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v7a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'delete_stroked');
export default IconComponent;
