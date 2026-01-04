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
                d="m22.15 12.06-9.8 9.8a.5.5 0 0 1-.7 0l-9.8-9.8a.5.5 0 0 1 .36-.85H8v-9a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v9h5.8a.5.5 0 0 1 .35.85Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'filled_arrow_down');
export default IconComponent;
