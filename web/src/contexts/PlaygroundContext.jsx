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
