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
                d="M21.43 4.14a1.57 1.57 0 1 0 0-3.14 1.57 1.57 0 0 0 0 3.14ZM11.2 23a10.21 10.21 0 1 0 0-20.43 10.21 10.21 0 0 0 0 20.43Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'qingyan');
export default IconComponent;
