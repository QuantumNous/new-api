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
            <rect x={2} y={2} width={20} height={20} rx={3} fill="#4CC3FA" />
            <path
                d="M8.33 8.27h-1.5l-2.18 1.4v1.45l2.04-1.3h.05V17h1.59V8.27Zm2.7 8.82c.5 0 .93-.41.94-.93a.95.95 0 0 0-.94-.93.93.93 0 1 0 0 1.87Zm5.4.08c2.1 0 3.36-1.66 3.36-4.53 0-2.84-1.27-4.49-3.36-4.49-2.1 0-3.36 1.64-3.37 4.5 0 2.85 1.26 4.52 3.37 4.52Zm0-1.34c-1.09 0-1.77-1.09-1.77-3.19 0-2.07.68-3.17 1.77-3.17 1.08 0 1.76 1.1 1.77 3.17 0 2.1-.68 3.2-1.77 3.2Z"
                fill="white"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'version-one');
export default IconComponent;
