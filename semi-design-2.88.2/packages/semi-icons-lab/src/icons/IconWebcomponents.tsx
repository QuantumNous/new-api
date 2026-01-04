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
            <rect x={2} y={2} width={20} height={20} rx={5} fill="#41B3FF" />
            <rect x={7} y={5.5} width={10} height={3} rx={1.5} fill="#E9E7E7" />
            <rect x={7} y={10.5} width={10} height={3} rx={1.5} fill="#483D3D" />
            <rect x={7} y={15.5} width={10} height={3} rx={1.5} fill="#E9E7E7" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'webcomponents');
export default IconComponent;
