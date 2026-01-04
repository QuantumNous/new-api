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
                d="M12 4C5 4 1 10 1 12s4 8 11 8 11-6 11-8-4-8-11-8Zm5 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'eye_opened');
export default IconComponent;
