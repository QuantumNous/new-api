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
                d="M4 3a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4Zm0 2h16v2H4V5Zm0 4v10h16V9H4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'modal_stroked');
export default IconComponent;
