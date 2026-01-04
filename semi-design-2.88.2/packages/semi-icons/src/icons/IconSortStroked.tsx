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
                d="M6.61 14.04a1 1 0 0 1 .89-.54h9a1 1 0 0 1 .82 1.57l-4.5 6.5a1 1 0 0 1-1.64 0l-4.5-6.5a1 1 0 0 1-.07-1.03Zm2.8 1.46L12 19.24l2.6-3.74H9.4Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2a1 1 0 0 1 .82.43l4.5 6.5a1 1 0 0 1-.82 1.57h-9a1 1 0 0 1-.82-1.57l4.5-6.5A1 1 0 0 1 12 2ZM9.4 8.5h5.2L12 4.76 9.4 8.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'sort_stroked');
export default IconComponent;
