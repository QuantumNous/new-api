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
                d="M19 1.5a1 1 0 0 1 1 1v5h-5a1 1 0 1 1 0-2h1.6A8 8 0 0 0 5.82 17.05c.34.44.35 1.07-.04 1.46-.4.39-1.03.39-1.38-.04A10 10 0 0 1 18 4.04V2.5a1 1 0 0 1 1-1ZM8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4.5-3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM21 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'rotation_stroked');
export default IconComponent;
