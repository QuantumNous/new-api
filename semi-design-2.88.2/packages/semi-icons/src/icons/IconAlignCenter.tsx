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
                d="M3.5 3a1.5 1.5 0 1 0 0 3h17a1.5 1.5 0 0 0 0-3h-17Zm3 5a1.5 1.5 0 1 0 0 3h11a1.5 1.5 0 0 0 0-3h-11ZM2 14.5c0-.83.67-1.5 1.5-1.5h17a1.5 1.5 0 0 1 0 3h-17A1.5 1.5 0 0 1 2 14.5ZM6.5 18a1.5 1.5 0 0 0 0 3h11a1.5 1.5 0 0 0 0-3h-11Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_center');
export default IconComponent;
