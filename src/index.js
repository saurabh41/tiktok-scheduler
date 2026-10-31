import cron from "node-cron";
import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPost, uploadFile } from "./api.js";
import { schedule } from "./schedule.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || "/data";
const POSTS_DIR = join(DATA_DIR, "posts");
const QUEUE_PATH = join(DATA_DIR, "queue.json");
const PORT = process.env.PORT || 3000;

mkdirSync(POSTS_DIR, { recursive: true });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadQueue() {
  if (!existsSync(QUEUE_PATH)) return [];
  return JSON.parse(readFileSync(QUEUE_PATH, "utf-8"));
}

function saveQueue(queue) {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

function rebuildQueue() {
  if (!existsSync(POSTS_DIR)) return [];

  const existing = loadQueue();
  const postedFolders = new Set(
    existing.filter((p) => p.posted).map((p) => p.folder)
  );

  const folders = readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const queue = [];
  for (const folder of folders) {
    const postDir = join(POSTS_DIR, folder);
    const captionPath = join(postDir, "caption.txt");
    if (!existsSync(captionPath)) continue;

    const caption = readFileSync(captionPath, "utf-8").trim();
    const slides = readdirSync(postDir)
      .filter((f) => /^slide\d+\.\w+$/.test(f))
      .sort();
    if (!slides.length) continue;

    queue.push({
      folder,
      caption,
      slides,
      posted: postedFolders.has(folder),
      postedAt: existing.find((p) => p.folder === folder)?.postedAt || null,
    });
  }

  saveQueue(queue);
  return queue;
}

async function publishNext(accountId, accountName) {
  const queue = loadQueue();
  const post = queue.find((p) => !p.posted);
  if (!post) {
    log(
      `No unposted content for ${accountName}. Upload more posts to /data/posts/`
    );
    return { error: "No unposted content in queue" };
  }

  log(`Publishing to ${accountName}: "${post.caption.slice(0, 50)}..."`);
  log(`Uploading ${post.slides.length} slides from ${post.folder}...`);

  const mediaUrls = [];
  for (const slide of post.slides) {
    const filePath = join(POSTS_DIR, post.folder, slide);
    try {
      const url = await uploadFile(filePath);
      mediaUrls.push(url);
      log(`  ${slide} → uploaded`);
    } catch (err) {
      log(`  ${slide} → FAILED: ${err.message}`);
    }
  }

  if (!mediaUrls.length) {
    log(`All uploads failed for ${post.folder}`);
    return { error: "All image uploads failed" };
  }

  try {
    const response = await createPost({
      caption: post.caption,
      mediaUrls,
      accountIds: [accountId],
      tiktokOptions: { privacy_status: "PUBLIC_TO_EVERYONE" },
    });

    post.posted = true;
    post.postedAt = new Date().toISOString();
    saveQueue(queue);
    log(`Success: posted ${post.folder}`);
    return { success: true, folder: post.folder, response };
  } catch (err) {
    log(`Error posting to ${accountName}: ${err.message}`);
    return { error: err.message };
  }
}

// --- HTTP server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") {
    const queue = loadQueue();
    const remaining = queue.filter((p) => !p.posted).length;
    const posted = queue.filter((p) => p.posted).length;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "running",
        accounts: schedule.map((a) => a.name),
        queue: { total: queue.length, remaining, posted },
      })
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/trigger") {
    const accountId =
      url.searchParams.get("account") || schedule[0]?.accountId;
    const account =
      schedule.find((a) => a.accountId === accountId) || schedule[0];
    if (!account) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No accounts configured" }));
      return;
    }

    log(`Manual trigger for ${account.name}`);
    const result = await publishNext(account.accountId, account.name);
    res.writeHead(result.error ? 500 : 200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "GET" && url.pathname === "/queue") {
    const queue = loadQueue();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(queue, null, 2));
    return;
  }

  if (req.method === "GET" && url.pathname === "/rebuild") {
    const queue = rebuildQueue();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        rebuilt: true,
        total: queue.length,
        remaining: queue.filter((p) => !p.posted).length,
      })
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/reset") {
    const { rmSync } = await import("node:fs");
    rmSync(POSTS_DIR, { recursive: true, force: true });
    mkdirSync(POSTS_DIR, { recursive: true });
    saveQueue([]);
    log("Reset: all posts and queue cleared");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reset: true }));
    return;
  }

  // POST /upload — receive a post folder (multipart: caption + slides)
  if (req.method === "POST" && url.pathname === "/upload") {
    const folder = url.searchParams.get("folder");
    if (!folder) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "?folder= is required" }));
      return;
    }

    const postDir = join(POSTS_DIR, folder);
    mkdirSync(postDir, { recursive: true });

    const filename = url.searchParams.get("filename");
    if (!filename) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "?filename= is required" }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const filePath = join(postDir, filename);
    writeFileSync(filePath, buffer);
    log(`Received: ${folder}/${filename} (${buffer.length} bytes)`);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, folder, filename, size: buffer.length }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not found",
      routes: [
        "GET /            — status",
        "GET /trigger      — post next item now",
        "GET /queue        — view queue",
        "GET /rebuild      — rebuild queue from /data/posts",
        "POST /upload?folder=X&filename=Y — upload a file",
      ],
    })
  );
});

server.listen(PORT, () => log(`HTTP server on port ${PORT}`));

// --- Startup: rebuild queue from /data/posts ---
log("TikTok Scheduler started");
const queue = rebuildQueue();
const remaining = queue.filter((p) => !p.posted).length;
log(`Queue: ${remaining} of ${queue.length} post(s) remaining`);
log(`${schedule.length} account(s) loaded`);

// --- Cron jobs ---
for (const account of schedule) {
  for (const slot of account.posts) {
    const [hour, minute] = slot.time.split(":");
    const cronExpr = `${minute} ${hour} * * *`;

    cron.schedule(
      cronExpr,
      () => publishNext(account.accountId, account.name),
      { timezone: "UTC" }
    );

    log(`  Cron registered: ${slot.time} UTC → ${account.name}`);
  }
}

log("Waiting for scheduled times...");
