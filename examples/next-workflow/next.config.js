const { withWorkflow } = require('workflow/next');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ajv', '@vercel/oidc'],
};

module.exports = withWorkflow(nextConfig);
