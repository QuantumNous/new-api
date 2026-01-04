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
                d="M4 2a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4Zm9 2h7v7h-2a1 1 0 1 0 0 2h2v7h-7v-2a1 1 0 1 0-2 0v2H4v-7h2a1 1 0 1 0 0-2H4V4h7v2a1 1 0 1 0 2 0V4ZM9 8a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H9Zm1 6v-4h4v4h-4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'margin_stroked');
export default IconComponent;
