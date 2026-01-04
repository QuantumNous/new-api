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
                d="M.83 7.66c-.24-.77.67-1.37 1.28-.85l1.86 1.6a3 3 0 0 0 4.68-1.04L11.1 2a1 1 0 0 1 1.82 0l2.44 5.37a3 3 0 0 0 4.68 1.03l1.86-1.59c.6-.52 1.52.08 1.28.85L19.44 19.6a2 2 0 0 1-1.91 1.4H6.47a2 2 0 0 1-1.9-1.4L.82 7.66Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'member');
export default IconComponent;
