module.exports = {
    git: {
        tagName: 'v${version}',
        commitMessage: 'release: v${version}',
        requireCleanWorkingDir: false,
        requireBranch: 'main',
    },
    hooks: {
        "before:init": ["git pull origin main", "npm run all-check"]
    },
    npm: {
        publish: false,
    },
    prompt: {
        ghRelease: false,
        glRelease: false,
        publish: false,
    },
    plugins: {
        './conventional-changelog.js': {
            preset: 'angular',
            infile: 'CHANGELOG.md',
        },
    },
}
