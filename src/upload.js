import { uploadFile } from "./api.js";

const filePaths = process.argv.slice(2);
if (!filePaths.length) {
  console.log("Usage: node src/upload.js <file1> <file2> ...");
  console.log("Example: node src/upload.js ./content/slide1.jpg ./content/slide2.jpg");
  process.exit(1);
}

console.log(`Uploading ${filePaths.length} file(s)...\n`);

for (const filePath of filePaths) {
  try {
    const url = await uploadFile(filePath);
    console.log(`  ${filePath} → ${url}`);
  } catch (err) {
    console.error(`  ${filePath} → FAILED: ${err.message}`);
  }
}

console.log("\nCopy the URLs above into your content queue (content/queue.json)");
