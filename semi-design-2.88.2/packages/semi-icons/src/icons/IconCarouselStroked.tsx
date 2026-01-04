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
                d="M1 6h2v12H1v2h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H1v2Zm6-1a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5Zm2 1v12h6V6H9Zm10-1a1 1 0 0 1 1-1h3v2h-2v12h2v2h-3a1 1 0 0 1-1-1V5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'carousel_stroked');
export default IconComponent;
