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
                d="M.21 12.46A3 3 0 0 0 0 13.58V19a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-5.42a3 3 0 0 0-.21-1.12l-3.29-8.2A2 2 0 0 0 18.65 3H5.35A2 2 0 0 0 3.5 4.26L.2 12.46ZM5.5 6h13l2.5 7h-5a1 1 0 0 0-1 1 3 3 0 1 1-6 0 1 1 0 0 0-1-1H3l2.5-7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'inbox');
export default IconComponent;
