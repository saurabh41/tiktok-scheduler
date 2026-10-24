import cron from "node-cron";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPost } from "./api.js";
import { schedule } from "./schedule.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUEUE_PATH = join(__dirname, "..", "content", "queue.json");
const PORT = process.env.PORT || 3000;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadQueue() {
  const raw = readFileSync(QUEUE_PATH, "utf-8");
  return JSON.parse(raw);
}

function saveQueue(queue) {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

function getNextPost() {
  const queue = loadQueue();
  const next = queue.find((p) => !p.posted);
  return next ? { post: next, queue } : null;
}

function markPosted(queue, post) {
  post.posted = true;
  post.postedAt = new Date().toISOString();
  saveQueue(queue);
}

async function publishNext(accountId, accountName) {
  const result = getNextPost();
  if (!result) {
    log(`No unposted content in queue for ${accountName}. Add more to content/queue.json`);
    return { error: "No unposted content in queue" };
  }

  const { post, queue } = result;
  log(`Publishing to ${accountName}: "${post.caption.slice(0, 50)}..."`);

  try {
    const response = await createPost({
      caption: post.caption,
      mediaUrls: post.mediaUrls,
      accountIds: [accountId],
      tiktokOptions: {
        privacy_status: "PUBLIC_TO_EVERYONE",
      },
    });
    markPosted(queue, post);
    log(`Success: ${JSON.stringify(response)}`);
    return { success: true, caption: post.caption, response };
  } catch (err) {
    log(`Error posting to ${accountName}: ${err.message}`);
    return { error: err.message };
  }
}

// --- HTTP server for manual triggers ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/") {
    const queue = loadQueue();
    const remaining = queue.filter((p) => !p.posted).length;
    const posted = queue.filter((p) => p.posted).length;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "running",
      accounts: schedule.map((a) => a.name),
      queue: { total: queue.length, remaining, posted },
    }));
    return;
  }

  if (url.pathname === "/trigger") {
    const accountId = url.searchParams.get("account") || schedule[0]?.accountId;
    const account = schedule.find((a) => a.accountId === accountId) || schedule[0];
    if (!account) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No accounts configured" }));
      return;
    }

    log(`Manual trigger for ${account.name}`);
    const result = await publishNext(account.accountId, account.name);
    res.writeHead(result.error ? 500 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (url.pathname === "/queue") {
    const queue = loadQueue();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(queue, null, 2));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found", routes: ["/", "/trigger", "/queue"] }));
});

server.listen(PORT, () => log(`HTTP server on port ${PORT}`));

// --- Cron scheduler ---
log("TikTok Scheduler started");
log(`Queue: ${QUEUE_PATH}`);

const queue = loadQueue();
const remaining = queue.filter((p) => !p.posted).length;
log(`${remaining} post(s) remaining in queue`);
log(`${schedule.length} account(s) loaded`);

for (const account of schedule) {
  for (const slot of account.posts) {
    const [hour, minute] = slot.time.split(":");
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(cronExpr, () => publishNext(account.accountId, account.name), {
      timezone: "UTC",
    });

    log(`  Cron registered: ${slot.time} UTC → ${account.name}`);
  }
}

log("Waiting for scheduled times...");
