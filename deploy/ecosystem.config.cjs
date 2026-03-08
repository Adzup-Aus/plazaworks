// PM2 ecosystem file for Plaza Works
// Usage: pm2 start deploy/ecosystem.config.cjs
// Logs go to <app-dir>/logs/pm2/ (no root required)

const path = require("path");
const appDir = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "plazaworks",
      cwd: appDir,
      script: "dist/index.cjs",
      interpreter: "node",
      interpreter_args: "-r dotenv/config",
      instances: 1,
      exec_mode: "fork",
      // Load .env from app dir so env is correct when PM2 starts the process
      env: {
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: path.join(appDir, ".env"),
      },
      max_memory_restart: "500M",
      error_file: path.join(appDir, "logs/pm2/plazaworks-error.log"),
      out_file: path.join(appDir, "logs/pm2/plazaworks-out.log"),
    },
  ],
};
