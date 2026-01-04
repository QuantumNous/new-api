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
            <g clipPath="url(#clip0_1_3028)">
                <rect
                    x={3.051}
                    y={2.888}
                    width={16}
                    height={21}
                    rx={2}
                    transform="rotate(-6 3.05081 2.88827)"
                    fill="#FF7D95"
                />
                <rect
                    x={5.249}
                    y={4.668}
                    width={12}
                    height={17}
                    rx={1}
                    transform="rotate(-6 5.2489 4.66825)"
                    fill="white"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12.3.91 13.9.74a1 1 0 0 1 1.1.9l.3 2.98-7.95.83-.31-2.98a1 1 0 0 1 .89-1.1l1.58-.16a1.5 1.5 0 0 1 2.8-.3Z"
                    fill="#AAB2BF"
                />
                <rect x={7.656} y={8.437} width={8} height={2} transform="rotate(-6 7.65607 8.43729)" fill="#DDE3E8" />
                <rect x={8.074} y={12.415} width={8} height={2} transform="rotate(-6 8.07417 12.4154)" fill="#DDE3E8" />
                <rect
                    x={8.492}
                    y={16.393}
                    width={3.35025}
                    height={2}
                    transform="rotate(-6 8.49229 16.3935)"
                    fill="#DDE3E8"
                />
                <path
                    d="m20.03 9.95-4.92 4.96c-.1.09-.17.2-.21.31l-.86 2.13c-.16.39.23.77.61.62l2.16-.86a.96.96 0 0 0 .32-.2l4.92-4.97-2.02-2Z"
                    fill="#6A6F7F"
                />
                <path
                    d="m22.05 11.94.67-.67a.93.93 0 0 0 0-1.33l-.67-.66a.96.96 0 0 0-1.35 0l-.67.67 2.02 2Z"
                    fill="#6A6F7F"
                />
            </g>
            <defs>
                <clipPath id="clip0_1_3028">
                    <rect width={24} height={24} fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'form');
export default IconComponent;
