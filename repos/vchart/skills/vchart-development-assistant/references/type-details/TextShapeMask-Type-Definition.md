```typescript
interface TextShapeMask {
  /** Specifies shape cloud generation based on text outline */
  type: 'text';
  /** Text content for the outline */
  text: string;
  /** Whether to create hollow shape, filling only background area */
  hollow?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Fill color */
  fill?: string;
  /** Font family for text outline */
  fontFamily?: string;
  /** Font weight for text outline */
  fontWeight?: string | number;
  /** Font style for text outline */
  fontStyle?: string;
  /** Font variant for text outline */
  fontVariant?: string;
}
```
