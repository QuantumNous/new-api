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
import { FileQuestion, Inbox, ServerCrash, ShieldAlert } from 'lucide-react';

const Illustration = ({ icon: Icon, title = 'Empty state' }) => (
  <div className='flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500'>
    <div className='rounded-full border border-slate-200 p-4 dark:border-slate-700'>
      <Icon size={32} />
    </div>
    <span className='text-sm'>{title}</span>
  </div>
);

export const IllustrationNoContent = (props) => (
  <Illustration icon={Inbox} title='No content' {...props} />
);

export const IllustrationNoContentDark = IllustrationNoContent;
export const IllustrationNoResult = IllustrationNoContent;
export const IllustrationNoResultDark = IllustrationNoContent;

export const IllustrationNotFound = (props) => (
  <Illustration icon={FileQuestion} title='Not found' {...props} />
);

export const IllustrationNotFoundDark = IllustrationNotFound;

export const IllustrationConstruction = (props) => (
  <Illustration icon={ServerCrash} title='Under construction' {...props} />
);

export const IllustrationConstructionDark = IllustrationConstruction;

export const IllustrationNoPermission = (props) => (
  <Illustration icon={ShieldAlert} title='No permission' {...props} />
);

export const IllustrationNoAccess = IllustrationNoPermission;
export const IllustrationNoAccessDark = IllustrationNoPermission;
export const IllustrationFailure = IllustrationConstruction;
export const IllustrationFailureDark = IllustrationConstruction;
