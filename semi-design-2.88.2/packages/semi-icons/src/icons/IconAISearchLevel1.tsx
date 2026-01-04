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
                d="M10 2a1 1 0 1 1 0 2 6 6 0 1 0 6 6 1 1 0 0 1 2 0 8 8 0 0 1-1.68 4.9l5.39 5.4a1 1 0 1 1-1.42 1.4l-5.39-5.38A8 8 0 1 1 10 2Zm4.93-.6a.6.6 0 0 1 1.14 0c.05.16.1.3.17.45l.04.07a3.99 3.99 0 0 0 1.8 1.8l.07.04a4 4 0 0 0 .44.17.6.6 0 0 1 0 1.14 4 4 0 0 0-.44.17l-.07.04a4 4 0 0 0-1.8 1.8 4.5 4.5 0 0 0-.21.51.6.6 0 0 1-1.14 0 4 4 0 0 0-.2-.5 4 4 0 0 0-1.81-1.81l-.07-.04a4 4 0 0 0-.44-.17.6.6 0 0 1 0-1.14 4 4 0 0 0 .44-.17l.07-.04a4 4 0 0 0 1.8-1.8l.04-.07.17-.44Zm.57 2c-.31.41-.69.79-1.1 1.1.41.31.79.69 1.1 1.1.31-.41.69-.79 1.1-1.1-.41-.31-.79-.69-1.1-1.1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ai_search_level_1');
export default IconComponent;
