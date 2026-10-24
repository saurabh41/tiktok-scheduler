import { createPost, listAccounts } from "./api.js";

const { data } = await listAccounts("tiktok");
if (!data.length) {
  console.error("No TikTok accounts connected. Run: npm run connect");
  process.exit(1);
}

const accountId = data[0].id;
console.log(`Posting to account: ${data[0].name || data[0].username || accountId}`);

const result = await createPost({
  caption: "Test post from tiktok-scheduler #test",
  mediaUrls: ["https://picsum.photos/id/237/1080/1080"],
  accountIds: [accountId],
  tiktokOptions: {
    privacy_status: "PUBLIC_TO_EVERYONE",
  },
});

console.log("\nPost created:", JSON.stringify(result, null, 2));
