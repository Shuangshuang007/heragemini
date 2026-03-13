module.exports = {
  apps: [
    {
      name: 'career-switch-api',
      script: './career_api_server.js',
      instances: 1,
      exec_mode: 'fork',
      cwd: '/opt/career-switch-api',
      error_file: './logs/career-err.log',
      out_file: './logs/career-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '1G',
      restart_delay: 3000
    }
  ]
};
