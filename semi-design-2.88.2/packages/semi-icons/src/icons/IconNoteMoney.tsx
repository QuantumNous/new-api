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
                d="M21 3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h18Zm-5.8 4.3a1 1 0 0 0-1.4 0L12 9.08l-1.8-1.8a1 1 0 1 0-1.4 1.42L10.08 10H9a1 1 0 1 0 0 2h2v1H9a1 1 0 1 0 0 2h2v1a1 1 0 0 0 2 0v-1h2a1 1 0 0 0 0-2h-2v-1h2a1 1 0 0 0 0-2h-1.09l1.3-1.3a1 1 0 0 0 0-1.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'note_money');
export default IconComponent;
