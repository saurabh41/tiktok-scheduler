# TikTok Scheduler

Automated TikTok posting via [Post for Me](https://postforme.dev) API. Runs as a worker process with cron-based scheduling. Designed for Railway deployment.

## Setup

```bash
npm install
export PFM_API_KEY="your_api_key"
```

## Connect TikTok Account

```bash
npm run connect          # Get OAuth URL
npm run connect list     # List connected accounts
```

## Configure Schedule

Edit `src/schedule.js` with your account IDs, posting times (UTC), captions, and media URLs.

## Test

```bash
npm run post             # Send a test post immediately
```

## Deploy to Railway

1. Connect this repo to Railway
2. Set `PFM_API_KEY` in Railway environment variables
3. Railway runs it as a worker process (no web server)
4. Cron jobs fire at configured UTC times
