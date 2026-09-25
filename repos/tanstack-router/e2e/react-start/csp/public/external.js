// This script sets a window global when loaded
// Using a global avoids race conditions with React and DOM ownership issues
window.__EXTERNAL_SCRIPT_LOADED__ = true
