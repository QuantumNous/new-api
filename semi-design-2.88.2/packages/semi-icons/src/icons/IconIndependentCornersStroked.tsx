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
                d="M15 2a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0V3a1 1 0 0 0-1-1h-6ZM9 22a1 1 0 1 0 0-2H4v-5a1 1 0 1 0-2 0v6a1 1 0 0 0 1 1h6ZM3 10a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H4v5a1 1 0 0 1-1 1Zm19 5a1 1 0 1 0-2 0v5h-5a1 1 0 1 0 0 2h6a1 1 0 0 0 1-1v-6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'independent_corners_stroked');
export default IconComponent;
