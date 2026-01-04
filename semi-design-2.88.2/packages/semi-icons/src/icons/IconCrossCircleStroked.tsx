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
                d="M23 12a11 11 0 1 1-22 0 11 11 0 0 1 22 0Zm-11 9a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.11 8.11a1 1 0 0 1 1.42 0L12 10.6l2.47-2.48a1 1 0 1 1 1.42 1.42L13.4 12l2.48 2.47a1 1 0 0 1-1.42 1.42L12 13.4 9.53 15.9a1 1 0 0 1-1.42-1.42L10.6 12 8.1 9.53a1 1 0 0 1 0-1.42Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'cross_circle_stroked');
export default IconComponent;
