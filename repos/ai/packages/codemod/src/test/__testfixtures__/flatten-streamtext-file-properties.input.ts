// Test various usages of delta.file.mediaType and delta.file.data
import { streamText } from 'ai';

// Mock function for testing
function processFile(mediaType: string, data: any) {
  console.log('Processing file', mediaType, data);
}

function handleStreamDelta(delta: any) {
  // Should be transformed: delta.file.mediaType -> delta.mediaType
  if (delta.file.mediaType === 'application/pdf') {
    console.log('PDF file detected');
  }

  // Should be transformed: delta.file.data -> delta.data
  const fileData = delta.file.data;
  
  // Should be transformed in expressions
  const mediaTypeCheck = delta.file.mediaType || 'unknown';
  const hasData = !!delta.file.data;
  
  // Should be transformed in function calls
  processFile(delta.file.mediaType, delta.file.data);
  
  // Should be transformed in object properties
  const fileInfo = {
    type: delta.file.mediaType,
    content: delta.file.data,
    size: delta.file.data?.length
  };
  
  // Should be transformed in conditional expressions
  const result = delta.file.mediaType ? delta.file.data : null;
  
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
    mediaType: delta.file.mediaType,
    data: delta.file.data
  };
}