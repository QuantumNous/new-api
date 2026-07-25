// Last path segment, for displaying a workspace/root as its folder name. Splits on both
// separators: the sidecar reports paths in the OS's native form, so a Windows workspace
// ("C:\Users\X\proj") must not render as one giant segment.
export const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
