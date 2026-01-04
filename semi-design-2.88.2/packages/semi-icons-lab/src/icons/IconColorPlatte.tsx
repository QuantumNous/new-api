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
                d="M12 2a10 10 0 0 0 0 20 1.66 1.66 0 0 0 1.23-2.78 1.66 1.66 0 0 1 1.25-2.77h1.96A5.56 5.56 0 0 0 22 10.88C22 5.98 17.52 2 12 2Z"
                fill="#DDE3E8"
                stroke="#DDE3E8"
                strokeWidth={1.5}
            />
            <circle cx={6} cy={12} r={2} fill="#F82C2C" />
            <circle cx={10.5} cy={7} r={2} fill="#4CC3FA" />
            <circle cx={17} cy={9} r={2} fill="#3BCE4A" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'color-platte');
export default IconComponent;
