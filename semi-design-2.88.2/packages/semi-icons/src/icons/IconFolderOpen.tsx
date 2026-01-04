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
                d="M2 5a3 3 0 0 1 3-3h3.3a2 2 0 0 1 1.25.44l1.13.9a3 3 0 0 0 1.87.66H18c2 0 3 2 3 4H7.53A2 2 0 0 0 5.6 9.48L2.57 20.76C2.21 20.26 2 19.66 2 19V5Zm20.17 5H9.5a2 2 0 0 0-1.92 1.44l-2.7 9.28A1 1 0 0 0 5.82 22H18.5a2 2 0 0 0 1.92-1.44l2.7-9.28a1 1 0 0 0-.95-1.28Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'folder_open');
export default IconComponent;
