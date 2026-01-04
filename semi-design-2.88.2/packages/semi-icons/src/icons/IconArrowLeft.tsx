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
                d="M23 12c0 .83-.67 1.5-1.5 1.5H6.12l6.44 6.44a1.5 1.5 0 0 1-2.12 2.12l-9-9a1.5 1.5 0 0 1 0-2.12l9-9a1.5 1.5 0 0 1 2.12 2.12L6.12 10.5H21.5c.83 0 1.5.67 1.5 1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'arrow_left');
export default IconComponent;
