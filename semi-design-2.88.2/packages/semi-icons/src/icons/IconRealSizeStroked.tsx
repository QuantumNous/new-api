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
                d="M1 6c0-1.1.9-2 2-2h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6Zm20 0H3v12h18V6ZM5 9a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-5H6a1 1 0 0 1-1-1Zm11-1a1 1 0 1 0 0 2h.5v5a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1H16Zm-3 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'real_size_stroked');
export default IconComponent;
