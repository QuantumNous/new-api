module.exports = (file, api) => {
  const j = api.jscodeshift
  const root = j(file.source)

  const appRoots = root.find(j.CallExpression, (node) => {
    if (j.Identifier.check(node.callee) && node.callee.name === 'createApp') {
      return true
    }

    if (
      j.MemberExpression.check(node.callee) &&
      j.Identifier.check(node.callee.object) &&
      node.callee.object.name === 'Vue' &&
      j.Identifier.check(node.callee.property) &&
      node.callee.property.name === 'createApp'
    ) {
      return true
    }
  })

  appRoots.replaceWith(({ node: createAppCall }) => {
    return j.callExpression(
      j.memberExpression(createAppCall, j.identifier('use')),
      [j.identifier('store')]
    )
  })

  return root.toSource()
}
