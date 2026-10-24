import cron from "node-cron";
import { createPost } from "./api.js";
import { schedule } from "./schedule.js";

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

log("TikTok Scheduler started");
log(`Loaded ${schedule.length} account(s)`);

for (const account of schedule) {
  for (const post of account.posts) {
    const [hour, minute] = post.time.split(":");
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(cronExpr, async () => {
      log(`Posting to ${account.accountId} (scheduled ${post.time} UTC)`);
      try {
        const result = await createPost({
          caption: post.caption,
          mediaUrls: post.mediaUrls,
          accountIds: [account.accountId],
          tiktokOptions: {
            privacy_status: "PUBLIC_TO_EVERYONE",
          },
        });
        log(`Success: ${JSON.stringify(result)}`);
      } catch (err) {
        log(`Error: ${err.message}`);
      }
    }, { timezone: "UTC" });

    log(`  Scheduled: ${post.time} UTC → "${post.caption.slice(0, 40)}..."`);
  }
}

log("All cron jobs registered. Waiting for scheduled times...");
