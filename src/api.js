const BASE_URL = "https://api.postforme.dev/v1";

function headers() {
  const key = process.env.PFM_API_KEY;
  if (!key) throw new Error("PFM_API_KEY environment variable is not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export async function getAuthUrl(platform = "tiktok") {
  const res = await fetch(`${BASE_URL}/social-accounts/auth-url`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ platform }),
  });
  if (!res.ok) throw new Error(`Auth URL failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listAccounts(platform = "tiktok") {
  const res = await fetch(
    `${BASE_URL}/social-accounts?platform=${platform}`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`List accounts failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createPost({ caption, mediaUrls, accountIds, scheduledAt, tiktokOptions }) {
  const body = {
    caption,
    social_accounts: accountIds,
    media: mediaUrls.map((url) => ({ url })),
  };

  if (scheduledAt) body.scheduled_at = scheduledAt;

  if (tiktokOptions) body.tiktok = tiktokOptions;

  const res = await fetch(`${BASE_URL}/social-posts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create post failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listPosts() {
  const res = await fetch(`${BASE_URL}/social-posts`, { headers: headers() });
  if (!res.ok) throw new Error(`List posts failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getUploadUrl(filename, contentType) {
  const res = await fetch(`${BASE_URL}/media/create-upload-url`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) throw new Error(`Upload URL failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function uploadFile(filePath) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const ext = path.default.extname(filePath).toLowerCase();
  const contentType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".webp": "image/webp" }[ext] || "application/octet-stream";
  const filename = path.default.basename(filePath);

  const { upload_url, media_url } = await getUploadUrl(filename, contentType);

  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBuffer,
  });
  if (!uploadRes.ok) throw new Error(`File upload failed: ${uploadRes.status}`);

  return media_url;
}
