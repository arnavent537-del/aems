module.exports = {
  apps: [{
    name: 'aems',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // Auto-restart if the app crashes
    autorestart: true,
    // Watch for file changes (disabled in production)
    watch: false,
    // Log files
    error_file: './logs/aems-error.log',
    out_file: './logs/aems-out.log',
    // Time format in logs
    time: true,
  }]
};
