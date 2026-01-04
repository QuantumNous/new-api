const makeAnchorId = id => {
    if (typeof id === 'object') {
        return null;
    }
    if (!id) {
        return null;
    }
    return id
        .toLowerCase()
        .replace(/\//g, '')
        .replace(/\s/g, '-')
        .replace(/(\(|\))/g, 'aaa')
        .replace(/\./g, '-')
        .replace(/\&/g, '-')
        .replace(/(^[^\u4e00-\u9fa5^a-z%])/, 'n$1');

};

export { makeAnchorId };