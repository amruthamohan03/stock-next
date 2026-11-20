/**
 * PM2 config for serving the production build.
 *
 *   npm run build                       # build first — `next start` serves .next
 *   pm2 start ecosystem.config.cjs      # then start (or `pm2 restart stock-next`)
 *   pm2 save                            # remember it across reboots
 *
 * The script is Next's own Node entry point, not `pnpm`/`npm`: on Windows those
 * are .cmd batch files, which PM2 cannot run ("SyntaxError … @ECHO off").
 * Never run `npm run dev` in this folder while PM2 is serving it — both write
 * to .next (see CLAUDE.md).
 */
module.exports = {
  apps: [
    {
      name: "stock-next",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: "production" },
    },
  ],
};
