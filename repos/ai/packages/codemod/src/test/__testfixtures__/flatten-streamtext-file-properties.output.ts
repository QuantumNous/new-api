// Test various usages of delta.file.mediaType and delta.file.data
import { streamText } from 'ai';

// Mock function for testing
function processFile(mediaType: string, data: any) {
  console.log('Processing file', mediaType, data);
}

function handleStreamDelta(delta: any) {
  // Should be transformed: delta.file.mediaType -> delta.mediaType
  if (delta.mediaType === 'application/pdf') {
    console.log('PDF file detected');
  }

  // Should be transformed: delta.file.data -> delta.data
  const fileData = delta.data;
  
  // Should be transformed in expressions
  const mediaTypeCheck = delta.mediaType || 'unknown';
  const hasData = !!delta.data;
  
  // Should be transformed in function calls
  processFile(delta.mediaType, delta.data);
  
  // Should be transformed in object properties
  const fileInfo = {
    type: delta.mediaType,
    content: delta.data,
    size: delta.data?.length
  };
  
  // Should be transformed in conditional expressions
  const result = delta.mediaType ? delta.data : null;
  
  // Should NOT be transformed - different object name
  const response = { file: { mediaType: 'test' } };
  if (response.file.mediaType) {
    console.log('This should not change');
  }
  
  // Should NOT be transformed - different property names
  if (delta.file.filename) {
    console.log('This should not change');
  }
  
  // Should NOT be transformed - not the right pattern
  if (delta.metadata) {
    console.log('This should not change');
  }
}

// Additional patterns that should be transformed
function anotherHandler(delta: any) {
  return {
    mediaType: delta.mediaType,
    data: delta.data
  };
}