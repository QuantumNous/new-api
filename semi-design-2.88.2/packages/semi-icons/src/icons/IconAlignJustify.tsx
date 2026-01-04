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
                d="M3.36 3C2.61 3 2 3.67 2 4.5S2.61 6 3.36 6h17.28C21.39 6 22 5.33 22 4.5S21.39 3 20.64 3H3.36Zm0 5C2.61 8 2 8.67 2 9.5S2.61 11 3.36 11h17.28c.75 0 1.36-.67 1.36-1.5S21.39 8 20.64 8H3.36ZM2 14.5c0-.83.61-1.5 1.36-1.5h17.28c.75 0 1.36.67 1.36 1.5s-.61 1.5-1.36 1.5H3.36C2.61 16 2 15.33 2 14.5ZM3.36 18C2.61 18 2 18.67 2 19.5S2.61 21 3.36 21h17.28c.75 0 1.36-.67 1.36-1.5s-.61-1.5-1.36-1.5H3.36Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_justify');
export default IconComponent;
