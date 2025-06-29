module.exports = {
  apps: [{
    name: 'webwhiteboard-backend',
    script: 'dist/index.js',
    cwd: '/home/ec2-user/WEBwhiteboard/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: '.env',
    log_file: '/home/ec2-user/WEBwhiteboard/backend/logs/combined.log',
    out_file: '/home/ec2-user/WEBwhiteboard/backend/logs/out.log',
    error_file: '/home/ec2-user/WEBwhiteboard/backend/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
}; 