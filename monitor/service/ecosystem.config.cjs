module.exports = {
  apps: [
    {
      name: 'newapi-monitor-service',
      cwd: __dirname,
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
