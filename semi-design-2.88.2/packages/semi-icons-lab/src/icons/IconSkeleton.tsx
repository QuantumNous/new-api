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
            <rect x={2} y={11} width={21} height={3} fill="#DDE3E8" />
            <rect x={2} y={15} width={21} height={3} fill="#DDE3E8" />
            <rect x={11} y={2} width={12} height={3} fill="#AAB2BF" />
            <rect x={11} y={6} width={9} height={3} fill="#AAB2BF" />
            <rect x={2} y={19} width={11} height={3} fill="#DDE3E8" />
            <rect x={2} y={2} width={7} height={7} fill="#6A6F7F" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'skeleton');
export default IconComponent;
