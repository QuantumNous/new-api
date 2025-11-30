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

import React, { createContext, useContext } from 'react';

/**
 * Context for Playground component to share image handling functionality
 */
const PlaygroundContext = createContext(null);

/**
 * Hook to access Playground context
 * @returns {Object} Context value with onPasteImage, imageUrls, and imageEnabled
 */
export const usePlayground = () => {
  const context = useContext(PlaygroundContext);
  if (!context) {
    return {
      onPasteImage: () => {
        console.warn('PlaygroundContext not provided');
      },
      imageUrls: [],
      imageEnabled: false,
    };
  }
  return context;
};

/**
 * Provider component for Playground context
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {Object} props.value - Context value to provide
 * @returns {JSX.Element} Provider component
 */
export const PlaygroundProvider = ({ children, value }) => {
  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  );
};

export default PlaygroundContext;
