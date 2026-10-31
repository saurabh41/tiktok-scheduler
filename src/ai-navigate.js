const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-20250514";

const sessions = new Map();

const SYSTEM_PROMPT = `You are an AI agent controlling an iPhone via iOS Voice Control. Your goal is to publish the first available draft post on TikTok.

You receive a screenshot of the current iPhone screen. Respond with the SINGLE next Voice Control command to execute.

## TikTok Draft Publishing Flow:
1. If on the main feed → tap Profile tab (bottom right corner)
2. If on Profile → find and tap "Drafts" (usually above your videos grid)
3. If viewing drafts → tap the first draft thumbnail
4. If editing a draft → tap "Next" button (top right or bottom)
5. If on the post settings screen → tap "Post" button
6. If post is published → you're done

## Voice Control Commands:
- "show grid" — overlays a numbered grid (1-12 or 1-6) on screen
- "[number]" — when grid is visible, zooms into that grid cell showing a sub-grid
- "tap" — taps the center of the currently highlighted/zoomed grid area
- "show numbers" — shows numbers on interactive/tappable elements
- "tap [number]" — taps the element with that number label
- "scroll down" / "scroll up" — scrolls the page
- "go back" — navigates back
- "tap [text]" — taps an element whose label matches the text

## Strategy:
- First assess which screen you're on
- If you can see a clearly labeled button (like "Post", "Next", "Profile"), try "tap [label]" first
- If "tap [label]" didn't work (previous command was the same), use "show grid" then navigate via grid numbers
- When grid is showing: identify which numbered cell contains your target, say that number
- After zooming into a cell: if target is clearly in center, say "tap". If not, say another grid number to zoom further
- Never repeat the same command more than twice — switch strategy

## Response:
Respond with ONLY the Voice Control command. No explanation, no quotes, no punctuation.
Special responses:
DONE — when the post has been published successfully (you see a success message or the post in the feed)
ERROR: [reason] — when stuck or unrecoverable`;

export async function getNextCommand(screenshotBase64, sessionId) {
  if (!ANTHROPIC_API_KEY) {
    return { command: "ERROR: ANTHROPIC_API_KEY not set on server" };
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], startedAt: Date.now() });
  }

  const session = sessions.get(sessionId);

  const messages = [];

  for (const turn of session.history.slice(-6)) {
    messages.push({
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: turn.screenshot },
        },
        { type: "text", text: "Current screen. What is the next Voice Control command?" },
      ],
    });
    messages.push({
      role: "assistant",
      content: [{ type: "text", text: turn.command }],
    });
  }

  messages.push({
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: screenshotBase64 },
      },
      {
        type: "text",
        text: `Current screen (step ${session.history.length + 1}). Previous commands: [${session.history.map((t) => t.command).join(", ")}]. What is the next Voice Control command?`,
      },
    ],
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 50,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Anthropic API error: ${res.status} ${errText}`);
      return { command: `ERROR: API ${res.status}` };
    }

    const data = await res.json();
    const command = data.content[0]?.text?.trim() || "ERROR: empty response";

    session.history.push({
      screenshot: screenshotBase64.slice(0, 100),
      command,
    });

    if (command.startsWith("DONE") || command.startsWith("ERROR") || session.history.length > 25) {
      sessions.delete(sessionId);
    }

    return { command, step: session.history.length };
  } catch (err) {
    console.error(`AI navigate error: ${err.message}`);
    return { command: `ERROR: ${err.message}` };
  }
}

export function clearSession(sessionId) {
  sessions.delete(sessionId);
}
