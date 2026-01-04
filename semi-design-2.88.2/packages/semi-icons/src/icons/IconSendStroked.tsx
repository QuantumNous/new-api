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
                d="m9.47 13.12-4.11-2.74 13.1-4.92-5.22 13.05-2.38-3.97.09-.08 3.5-3.5a1 1 0 0 0-1.42-1.42l-3.5 3.5a1 1 0 0 0-.06.08ZM2.83 9.19l17.05-6.4a1 1 0 0 1 1.28 1.31l-6.81 17.03a1 1 0 0 1-1.79.14L9 15.32a1 1 0 0 0-.3-.32l-6.07-4.04a1 1 0 0 1 .2-1.77Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'send_stroked');
export default IconComponent;
