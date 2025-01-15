const path = require('path')

// normalize file/line numbers into command line args for specific editors
module.exports = function getArgumentsForPosition (
  editor,
  fileName,
  lineNumber,
  columnNumber = 1
) {
  const editorBasename = path.basename(editor).replace(/\.(exe|cmd|bat)$/i, '')
  switch (editorBasename) {
    case 'atom':
    case 'Atom':
    case 'Atom Beta':
    case 'subl':
    case 'sublime':
    case 'sublime_text':
    case 'wstorm':
    case 'charm':
      return [`${fileName}:${lineNumber}:${columnNumber}`]
    case 'notepad++':
      return ['-n' + lineNumber, '-c' + columnNumber, fileName]
    case 'vim':
    case 'mvim':
      return [`+call cursor(${lineNumber}, ${columnNumber})`, fileName]
    case 'joe':
    case 'gvim':
      return ['+' + `${lineNumber}`, fileName]
    case 'emacs':
    case 'emacsclient':
      return [`+${lineNumber}:${columnNumber}`, fileName]
    case 'rmate':
    case 'mate':
    case 'mine':
      return ['--line', lineNumber, fileName]
    case 'code':
    case 'Code':
    case 'code-insiders':
    case 'Code - Insiders':
    case 'codium':
    case 'vscodium':
    case 'VSCodium':
      return ['-r', '-g', `${fileName}:${lineNumber}:${columnNumber}`]
    case 'appcode':
    case 'clion':
    case 'clion64':
    case 'idea':
    case 'idea64':
    case 'phpstorm':
    case 'phpstorm64':
    case 'pycharm':
    case 'pycharm64':
    case 'rubymine':
    case 'rubymine64':
    case 'webstorm':
    case 'webstorm64':
    case 'goland':
    case 'goland64':
    case 'rider':
    case 'rider64':
      return ['--line', lineNumber, '--column', columnNumber, fileName]
  }

  if (process.env.LAUNCH_EDITOR) {
    return [fileName, lineNumber, columnNumber]
  }

  // For all others, drop the lineNumber until we have
  // a mapping above, since providing the lineNumber incorrectly
  // can result in errors or confusing behavior.
  return [fileName]
}
