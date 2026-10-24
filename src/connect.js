import { getAuthUrl, listAccounts } from "./api.js";

const action = process.argv[2];

if (action === "list") {
  const { data } = await listAccounts("tiktok");
  if (!data.length) {
    console.log("No TikTok accounts connected. Run: npm run connect");
    process.exit(0);
  }
  console.log("\nConnected TikTok accounts:\n");
  for (const account of data) {
    console.log(`  ID: ${account.id}`);
    console.log(`  Name: ${account.name || account.username || "N/A"}`);
    console.log(`  Platform: ${account.platform}`);
    console.log("");
  }
} else {
  const { url } = await getAuthUrl("tiktok");
  console.log("\nOpen this URL in your browser to connect your TikTok account:\n");
  console.log(url);
  console.log("\nAfter authorizing, run this to verify:");
  console.log("  npm run connect list\n");
}
