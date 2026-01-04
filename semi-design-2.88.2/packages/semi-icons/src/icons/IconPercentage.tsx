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
                d="M21.56 2.44a1.5 1.5 0 0 1 0 2.12l-17 17a1.5 1.5 0 0 1-2.12-2.12l17-17a1.5 1.5 0 0 1 2.12 0ZM6.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM2 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Zm14 11a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm1.5-4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'percentage');
export default IconComponent;
