const isBrowser = function () {
    return typeof window !== 'undefined';
};

export default isBrowser;