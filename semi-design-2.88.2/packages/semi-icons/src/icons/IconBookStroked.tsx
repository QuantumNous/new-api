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
                d="M5 5c0-1.1.9-2 2-2h12v14H6a3 3 0 0 0-1 .17V5ZM3 20V5a4 4 0 0 1 4-4h12a2 2 0 0 1 2 2v19a1 1 0 0 1-1 1H6a3 3 0 0 1-3-3Zm2 0a1 1 0 0 1 1-1h13v2H6a1 1 0 0 1-1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'book_stroked');
export default IconComponent;
