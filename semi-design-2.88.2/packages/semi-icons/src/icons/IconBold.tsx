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
                d="M6 3a1 1 0 0 1 1-1h5.5c3.23 0 6 2.5 6 5.75 0 1.49-.58 2.82-1.51 3.82a5.64 5.64 0 0 1 2.51 4.68c0 3.26-2.77 5.75-6 5.75H7a1 1 0 0 1-1-1V3Zm7 16c1.74 0 3-1.31 3-2.75s-1.26-2.75-3-2.75H9V19h4Zm-1-8.5c1.74 0 3-1.31 3-2.75S13.74 5 12 5H9v5.5h3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bold');
export default IconComponent;
