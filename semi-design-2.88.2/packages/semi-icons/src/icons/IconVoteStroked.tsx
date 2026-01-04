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
                d="M5 4.5C5 3.67 5.67 3 6.5 3h11c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-11A1.5 1.5 0 0 1 5 15.5v-11ZM7 5v10h10V5H7ZM5 19.5c0-.28.22-.5.5-.5h13c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-1ZM2 14a1 1 0 0 0-1 1v5.5c0 .28.22.5.5.5h1a.5.5 0 0 0 .5-.5V16h.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H2Zm19 2h-.5a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5H22a1 1 0 0 1 1 1v5.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V16Zm-5.3-7.3a1 1 0 0 0-1.4-1.4L11 10.58l-1.3-1.3a1 1 0 0 0-1.4 1.42l2 2a1 1 0 0 0 1.4 0l4-4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'vote_stroked');
export default IconComponent;
