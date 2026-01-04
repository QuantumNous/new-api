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
                d="m4 17.9.94-.74a2.97 2.97 0 0 1 1.85-.63H20V5H4v12.9ZM21 3H3a1 1 0 0 0-1 1v15.95a1 1 0 0 0 1.62.79l2.55-2a1 1 0 0 1 .62-.21H21a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1ZM8 8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Zm-1 5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'comment_stroked');
export default IconComponent;
