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
                d="M3 3.5a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2h18a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2H3Zm0 2h18v13H3v-13Zm5 3V15h.5c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5H6V9h-.5a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5h2c.28 0 .5.22.5.5v1Zm2-.25c0-.69.56-1.25 1.25-1.25h6.5c.69 0 1.25.56 1.25 1.25v3.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-3.5ZM12 9v2h5V9h-5Zm-1.5 6a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h8a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-8Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ranking_card_stroked');
export default IconComponent;
