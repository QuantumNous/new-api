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
                d="M.83 7.66c-.24-.77.68-1.37 1.29-.85l1.85 1.6a3 3 0 0 0 4.68-1.04L11.1 2a1 1 0 0 1 1.82 0l2.44 5.37a3 3 0 0 0 4.68 1.03l1.85-1.59c.61-.52 1.53.08 1.29.85L19.44 20.6a2 2 0 0 1-1.91 1.4H6.47a2 2 0 0 1-1.9-1.4L.82 7.66Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'crown');
export default IconComponent;
