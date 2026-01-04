function isTest() {
    return process.env.TEST_ENV === 'test';
}

module.exports = {
    isTest
};