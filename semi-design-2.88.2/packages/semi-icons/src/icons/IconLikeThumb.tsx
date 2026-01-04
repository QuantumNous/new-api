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
                d="m8.06 9.39 3.71-6.96c.13-.24.42-.33.64-.18.58.41 1.42 1.2 1.42 2.13 0 .5-.13 1.4-.27 2.33a23.55 23.55 0 0 0-.31 2.79h7.58c.45 0 1.17.45 1.17 1.5 0 .9-1 5.09-1.7 8.04l-.3 1.3c0 .22-.27.66-1.33.66H8.5a.5.5 0 0 1-.5-.5V9.63a.5.5 0 0 1 .06-.24ZM3.5 9.5a.5.5 0 0 0-.5.5v10.5c0 .28.22.5.5.5h2a.5.5 0 0 0 .5-.5V10a.5.5 0 0 0-.5-.5h-2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'like_thumb');
export default IconComponent;
