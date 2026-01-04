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
                d="M6 8c0 3.3 2.7 6 6 6s6-2.7 6-6-2.7-6-6-6-6 2.7-6 6Zm2 0c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4ZM2.12 20.56C2.35 20.05 4.65 15 12 15c0 0 1 0 1 1s-1 1-1 1c-6.2 0-8 4.2-8 4.4-.2.5-.8.7-1.3.5-.6-.2-.8-.8-.6-1.3l.02-.04ZM14 17.5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 2.5a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm2.5-2.5c0-.28.22-.5.5-.5h4c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-1Zm.5 2.5a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h4a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_list_stroked');
export default IconComponent;
