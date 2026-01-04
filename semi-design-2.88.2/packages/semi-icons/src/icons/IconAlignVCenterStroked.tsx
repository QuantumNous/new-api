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
                d="M18 3a1 1 0 0 1 1 1v7h2a1 1 0 1 1 0 2h-2v7a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-7h-2v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4H3a1 1 0 1 1 0-2h2V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4h2V4a1 1 0 0 1 1-1h4Zm-1 2h-2v14h2V5ZM7 8h2v8H7V8Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_v_center_stroked');
export default IconComponent;
