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
                d="M23 12c0 3.54-2.87 3.97-5.51 4.36-1.46.22-2.86.42-3.66 1.14-.84.76-.52 1.9-.22 2.94.38 1.36.72 2.56-1.61 2.56a11 11 0 1 1 11-11Zm-2.3-.69a2.06 2.06 0 1 1-4.12 0 2.06 2.06 0 0 1 4.13 0Zm-5.72-3.44a2.06 2.06 0 1 0 0-4.12 2.06 2.06 0 0 0 0 4.13Zm-4.36-2.06a2.06 2.06 0 1 1-4.12 0 2.06 2.06 0 0 1 4.13 0ZM4.9 13.38a2.06 2.06 0 1 0 0-4.13 2.06 2.06 0 0 0 0 4.13Z"
                fill="#0077FA"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'color-platte-new');
export default IconComponent;
