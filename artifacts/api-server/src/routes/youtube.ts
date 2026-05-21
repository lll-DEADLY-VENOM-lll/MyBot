import { Router } from "express";
import { spawn } from "child_process";
import { logger } from "../lib/logger";
import type { IncomingMessage } from "http";
import https from "https";
import http from "http";

const router = Router();

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const INNERTUBE_URL_SEARCH = "https://www.youtube.com/youtubei/v1/search";

const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB",
    clientVersion: "2.20240101.00.00",
    hl: "hi",
    gl: "IN",
  },
};

interface VideoItem {
  id: string;
  title: string;
  thumb: string;
  duration: string;
  views: string;
  channel: string;
}

// ─── Stream URL Cache (5 min TTL) ───────────────────────────────────────────
interface CacheEntry {
  title: string;
  stream: string;
  thumb: string;
  source: string;
  expiresAt: number;
}

const streamCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes (URLs expire ~6 min)

function getCached(videoId: string): CacheEntry | null {
  const entry = streamCache.get(videoId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    streamCache.delete(videoId);
    return null;
  }
  return entry;
}

function setCache(videoId: string, entry: Omit<CacheEntry, "expiresAt">) {
  streamCache.set(videoId, { ...entry, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── InnerTube Search ────────────────────────────────────────────────────────
function extractVideosFromSearchResponse(data: Record<string, unknown>, maxResults: number): VideoItem[] {
  const contents =
    ((((data?.["contents"] as Record<string, unknown>)
      ?.["twoColumnSearchResultsRenderer"] as Record<string, unknown>)
      ?.["primaryContents"] as Record<string, unknown>)
      ?.["sectionListRenderer"] as { contents?: unknown[] })
      ?.["contents"] ?? [];

  const results: VideoItem[] = [];
  for (const section of contents) {
    const items: unknown[] =
      ((section as Record<string, unknown>)?.["itemSectionRenderer"] as Record<string, unknown>)
        ?.["contents"] as unknown[] ?? [];
    for (const item of items) {
      const vr = (item as Record<string, unknown>)?.["videoRenderer"] as Record<string, unknown> | undefined;
      if (!vr) continue;
      const vidId = vr["videoId"] as string;
      if (!vidId) continue;
      const title = ((vr["title"] as Record<string, unknown>)?.["runs"] as Array<{ text?: string }>)?.[0]?.text ?? "Unknown";
      const duration = (vr["lengthText"] as Record<string, unknown>)?.["simpleText"] as string ?? "";
      const views = (vr["viewCountText"] as Record<string, unknown>)?.["simpleText"] as string ?? "";
      const channel = ((vr["longBylineText"] as Record<string, unknown>)?.["runs"] as Array<{ text?: string }>)?.[0]?.text ?? "";
      results.push({ id: vidId, title, thumb: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`, duration, views, channel });
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }
  return results;
}

async function innertubeSearch(query: string): Promise<Record<string, unknown>> {
  const resp = await fetch(INNERTUBE_URL_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": randomUA(),
      "Accept-Language": "hi-IN,hi;q=0.9,en;q=0.8",
    },
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, query }),
  });
  return resp.json() as Promise<Record<string, unknown>>;
}

async function ytSearchInnertube(query: string, maxResults = 20): Promise<VideoItem[]> {
  try {
    const data = await innertubeSearch(query);
    return extractVideosFromSearchResponse(data, maxResults);
  } catch (err) {
    logger.error({ err }, "Search InnerTube failed");
    return [];
  }
}

const TRENDING_QUERIES = [
  "viral trending india 2025",
  "new bollywood songs 2025",
  "trending videos india today",
  "popular hindi songs 2025",
];

async function ytTrending(maxResults = 24): Promise<VideoItem[]> {
  const seen = new Set<string>();
  const results: VideoItem[] = [];
  const allSettled = await Promise.allSettled(TRENDING_QUERIES.map((q) => innertubeSearch(q)));
  for (const settled of allSettled) {
    if (settled.status !== "fulfilled") continue;
    const items = extractVideosFromSearchResponse(settled.value, maxResults);
    for (const item of items) {
      if (!seen.has(item.id) && results.length < maxResults) {
        seen.add(item.id);
        results.push(item);
      }
    }
    if (results.length >= maxResults) break;
  }
  return results;
}

// ─── yt-dlp stream extraction ────────────────────────────────────────────────
function runYtdlp(videoId: string, extraArgs: string[]): Promise<{ title: string; stream: string }> {
  return new Promise((resolve, reject) => {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ua = randomUA();
    const args = [
      "--no-playlist",
      "--get-url", "--get-title",
      "--no-warnings",
      "--no-check-certificate",
      "--extractor-retries", "3",
      "--user-agent", ua,
      "--add-header", `Accept-Language:hi-IN,hi;q=0.9,en;q=0.8`,
      "--add-header", `Referer:https://www.youtube.com/`,
      "--sleep-interval", "1",
      ...extraArgs,
      ytUrl,
    ];

    const proc = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("yt-dlp timeout (50s)"));
    }, 50000);

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim().split("\n").pop()?.slice(0, 400) || "yt-dlp failed"));
        return;
      }
      const lines = stdout.trim().split("\n").filter(Boolean);
      if (lines.length < 2) {
        reject(new Error(`Unexpected yt-dlp output (${lines.length} lines)`));
        return;
      }
      resolve({ title: lines[0].trim(), stream: lines[lines.length - 1].trim() });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function getStreamUrl(videoId: string): Promise<CacheEntry | { error: string }> {
  const cached = getCached(videoId);
  if (cached) {
    logger.info({ videoId }, "Stream cache hit");
    return cached;
  }

  const thumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

  const strategies: Array<{ name: string; args: string[] }> = [
    { name: "ios", args: ["--extractor-args", "youtube:player_client=ios", "--format", "bestaudio/best"] },
    { name: "web_creator", args: ["--extractor-args", "youtube:player_client=web_creator", "--format", "bestaudio/best"] },
    { name: "android", args: ["--extractor-args", "youtube:player_client=android", "--format", "bestaudio/best"] },
    { name: "web", args: ["--extractor-args", "youtube:player_client=web", "--format", "bestaudio/best"] },
    { name: "default", args: ["--format", "bestaudio/best"] },
  ];

  for (const { name, args } of strategies) {
    try {
      const result = await runYtdlp(videoId, args);
      const entry = { ...result, thumb, source: `yt-dlp-${name}` };
      setCache(videoId, entry);
      logger.info({ videoId, strategy: name }, "yt-dlp success");
      return { ...entry, expiresAt: Date.now() + CACHE_TTL_MS };
    } catch (err) {
      logger.warn({ videoId, strategy: name, err }, "yt-dlp strategy failed");
    }
  }

  return { error: `Saari strategies fail ho gayi. Video restricted ho sakta hai: ${videoId}` };
}

// ─── Proxy fetch helper ───────────────────────────────────────────────────────
function fetchUrl(url: string, headers: Record<string, string>): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, headers).then(resolve).catch(reject);
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Upstream timeout")); });
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get("/yt/search", async (req, res) => {
  const q = req.query["q"] as string;
  const max = parseInt((req.query["max"] as string) ?? "20", 10);
  if (!q) { res.status(400).json({ error: "q parameter required" }); return; }
  try {
    const results = await ytSearchInnertube(q, Math.min(max, 40));
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/yt/trending", async (req, res) => {
  try {
    const results = await ytTrending(24);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Trending fetch failed");
    res.status(500).json({ error: "Trending fetch failed" });
  }
});

router.get("/yt/stream", async (req, res) => {
  const id = req.query["id"] as string;
  if (!id) { res.status(400).json({ error: "id parameter required" }); return; }
  try {
    const data = await getStreamUrl(id);
    if ("error" in data) {
      res.status(502).json(data);
      return;
    }
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Stream fetch failed");
    res.status(502).json({ error: "Stream fetch failed" });
  }
});

// ─── Download proxy: streams audio through our server ────────────────────────
router.get("/yt/download", async (req, res) => {
  const id = req.query["id"] as string;
  if (!id) { res.status(400).json({ error: "id parameter required" }); return; }

  try {
    const data = await getStreamUrl(id);
    if ("error" in data) {
      res.status(502).json(data);
      return;
    }

    const { stream, title } = data;
    const safeTitle = (title ?? id).replace(/[^a-zA-Z0-9\s\-_().]/g, "").trim().slice(0, 100) || id;

    const proxyHeaders: Record<string, string> = {
      "User-Agent": randomUA(),
      "Referer": "https://www.youtube.com/",
      "Origin": "https://www.youtube.com",
      "Accept": "*/*",
      "Accept-Language": "hi-IN,hi;q=0.9,en;q=0.8",
    };

    const rangeHeader = req.headers["range"];
    if (rangeHeader) proxyHeaders["Range"] = rangeHeader;

    const upstream = await fetchUrl(stream, proxyHeaders);
    const statusCode = rangeHeader && upstream.statusCode === 206 ? 206 : 200;

    res.status(statusCode);

    // Forward content headers
    if (upstream.headers["content-type"]) res.setHeader("Content-Type", upstream.headers["content-type"]);
    if (upstream.headers["content-length"]) res.setHeader("Content-Length", upstream.headers["content-length"]);
    if (upstream.headers["content-range"]) res.setHeader("Content-Range", upstream.headers["content-range"]);
    if (upstream.headers["accept-ranges"]) res.setHeader("Accept-Ranges", upstream.headers["accept-ranges"]);

    const ext = (upstream.headers["content-type"] ?? "").includes("webm") ? "webm" : "m4a";
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.${ext}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");

    upstream.pipe(res);

    upstream.on("error", (err) => {
      logger.error({ err, id }, "Upstream pipe error");
      if (!res.headersSent) res.status(502).json({ error: "Upstream error" });
    });

    req.on("close", () => upstream.destroy());
  } catch (err) {
    req.log.error({ err }, "Download proxy failed");
    if (!res.headersSent) res.status(502).json({ error: "Download failed" });
  }
});

export default router;
