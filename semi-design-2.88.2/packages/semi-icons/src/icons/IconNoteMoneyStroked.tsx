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
                d="M1 5.5c0-1.1.9-2 2-2h18a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-13Zm20 0H3v13h18v-13ZM8.8 7.3a1 1 0 0 1 1.4 0L12 9.08l1.8-1.8a1 1 0 1 1 1.4 1.42L13.92 10H15a1 1 0 1 1 0 2h-2v1h2a1 1 0 1 1 0 2h-2v1a1 1 0 1 1-2 0v-1H9a1 1 0 1 1 0-2h2v-1H9a1 1 0 1 1 0-2h1.09l-1.3-1.3a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'note_money_stroked');
export default IconComponent;
