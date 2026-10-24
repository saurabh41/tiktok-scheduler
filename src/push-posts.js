import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const RAILWAY_URL = process.argv[2];
const POSTS_DIR = process.argv[3];

if (!RAILWAY_URL || !POSTS_DIR) {
  console.log(
    "Usage: node src/push-posts.js https://your-app.up.railway.app /path/to/posts"
  );
  process.exit(1);
}

const folders = readdirSync(POSTS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

console.log(`Pushing ${folders.length} post(s) to ${RAILWAY_URL}\n`);

for (const folder of folders) {
  const postDir = join(POSTS_DIR, folder);
  const files = readdirSync(postDir).filter(
    (f) => /^slide\d+\.\w+$/.test(f) || f === "caption.txt"
  );

  console.log(`[${folder}] ${files.length} files`);

  for (const file of files) {
    const filePath = join(postDir, file);
    const body = readFileSync(filePath);

    const url = `${RAILWAY_URL}/upload?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(file)}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/octet-stream" },
      });

      if (!res.ok) {
        console.log(`  ${file} → FAILED (${res.status})`);
      } else {
        console.log(`  ${file} → ok`);
      }
    } catch (err) {
      console.log(`  ${file} → ERROR: ${err.message}`);
    }
  }
}

console.log("\nDone! Now hit /rebuild on your Railway URL to update the queue.");
