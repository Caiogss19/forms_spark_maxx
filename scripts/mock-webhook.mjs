#!/usr/bin/env node
// Mock n8n webhook for local testing. Modes via the path:
//   /ok       → 200 always
//   /fail     → 500 always (force retry exhaustion)
//   /flaky/N  → fails first N requests, then 200
//   /slow     → sleeps 12s then 200 (triggers client timeout)

import http from "node:http";

const PORT = Number(process.env.MOCK_WEBHOOK_PORT ?? 4567);
const flakyCounters = new Map();

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  console.log(`[mock] ${req.method} ${req.url} body=${body.slice(0, 200)}…`);

  const url = req.url ?? "/";
  if (url === "/ok") return send(res, 200, { ok: true });
  if (url === "/fail") return send(res, 500, { error: "boom" });
  if (url.startsWith("/flaky/")) {
    const n = Number(url.split("/")[2] ?? "1");
    const counter = (flakyCounters.get(url) ?? 0) + 1;
    flakyCounters.set(url, counter);
    if (counter <= n) return send(res, 500, { tries: counter });
    return send(res, 200, { ok: true, tries: counter });
  }
  if (url === "/slow") {
    await new Promise((r) => setTimeout(r, 12_000));
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: "unknown_route" });
});

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

server.listen(PORT, () => {
  console.log(`mock webhook on http://localhost:${PORT}`);
});
