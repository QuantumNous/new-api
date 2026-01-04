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
                d="m14 2 6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h8Z"
                fill="#4CC3FA"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12.7 9.3a1 1 0 0 0-1.4 0l-3 3a1 1 0 1 0 1.4 1.4l1.3-1.29V17a1 1 0 1 0 2 0v-4.59l1.3 1.3a1 1 0 0 0 1.4-1.42l-3-3Z"
                fill="white"
            />
            <path fillRule="evenodd" clipRule="evenodd" d="m20 8-6-6v4c0 1.1.9 2 2 2h4Z" fill="#324350" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'upload');
export default IconComponent;
