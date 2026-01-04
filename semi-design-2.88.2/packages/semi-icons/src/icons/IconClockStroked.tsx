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
                d="M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22Zm0 2a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a1 1 0 0 1 1 1v5.59l4.36 4.36a1 1 0 0 1-1.41 1.41l-4.6-4.6-.02-.02A1 1 0 0 1 11 12V6a1 1 0 0 1 1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'clock_stroked');
export default IconComponent;
