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
                d="M2.5 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Zm9-11a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm2.2 7.7a1 1 0 0 0-1.4-1.4l-3.9 3.88a1 1 0 0 0 0 1.42l3.9 3.89a1 1 0 0 0 1.4-1.42l-3.17-3.18L13.7 8.7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'left_circle_stroked');
export default IconComponent;
