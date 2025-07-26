/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Icon } from '@douyinfe/semi-ui';

const CustomPassIcon = ({ size = 14 }) => {
  function CustomIcon() {
    return (
      <svg
        t="1753345320564"
        className="icon"
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        p-id="4557"
        width={size}
        height={size}
      >
        <path
          d="M510.21425 0C228.575984 0 0 228.575984 0 510.21425s228.575984 510.21425 510.21425 510.21425 510.21425-228.575984 510.21425-510.21425S791.852516 0 510.21425 0zM747.463876 615.8286l-120.410563 123.471848c-9.183857 9.694071-23.98007 9.694071-33.67414 0.510215l-0.510214-0.510215c-4.591928-4.591928-6.632785-10.714499-7.143-16.83707v-103.063278h-301.026407c-13.265571 0-23.98007-10.714499-23.98007-24.490284 0-13.265571 10.714499-24.490284 23.98007-24.490284h446.437468c4.081714-0.510214 8.673642-0.510214 12.755357 1.530642 9.694071 3.061286 17.347285 11.734928 17.347284 22.959642-1.020429 9.183857-6.122571 16.83707-13.775785 20.918784z m-11.224713-158.166418H289.801694c-4.081714 0.510214-8.673642 0.510214-12.755356-1.530642-9.694071-3.061286-17.347285-11.734928-17.347285-22.959642 0-9.183857 5.102143-16.83707 12.755357-20.918784L393.375187 289.29148c9.183857-9.694071 23.98007-9.694071 33.67414-0.510214l0.510215 0.510214c4.591928 4.591928 6.632785 10.714499 7.142999 16.83707v103.063279h301.026408c13.265571 0 23.98007 10.714499 23.980069 24.490284 0.510214 13.265571-10.204285 23.98007-23.469855 23.980069z"
          p-id="4558"
          fill="#07ac36"
        />
      </svg>
    );
  }

  return <Icon svg={<CustomIcon />} />;
};

export default CustomPassIcon;