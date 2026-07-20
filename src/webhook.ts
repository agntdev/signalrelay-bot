import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getProviderByToken, createSignal, getFollowerIdsForProvider } from "./store.js";
import type { Bot } from "grammy";

/**
 * Start an HTTP server that accepts POST /webhook for automated signal
 * submission. Requires WEBHOOK_PORT env (default 3000). Runs alongside
 * the bot's long-polling — not an alternative to it.
 */
export function startWebhookServer(bot: Bot<any>): void {
  const port = parseInt(process.env.WEBHOOK_PORT ?? "3000", 10);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "POST" && req.url === "/webhook") {
      try {
        const body = await readBody(req);
        const { token, content, symbol, direction, size } = JSON.parse(body);

        if (!token || !content) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "token and content are required" }));
          return;
        }

        const provider = await getProviderByToken(token);
        if (!provider) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid token" }));
          return;
        }

        if (!provider.approved) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "provider not approved" }));
          return;
        }

        const signal = await createSignal({
          provider_id: provider.provider_id,
          content,
          symbol,
          direction,
          size,
        });

        const followerIds = await getFollowerIdsForProvider(provider.provider_id);
        let delivered = 0;
        for (const userId of followerIds) {
          try {
            const directionEmoji = signal.direction === "buy" ? "🟢 BUY" : signal.direction === "sell" ? "🔴 SELL" : "";
            const meta = [directionEmoji, signal.symbol, signal.size].filter(Boolean).join(" · ");
            const text = [
              `From ${provider.display_name}:`,
              "",
              signal.content,
              meta ? `\n${meta}` : "",
            ].join("\n");

            const kb = {
              inline_keyboard: [
                [
                  { text: "Reply", callback_data: `reply:${signal.signal_id}` },
                  { text: "Report", callback_data: `report:${signal.signal_id}` },
                ],
              ],
            };

            await bot.api.sendMessage(userId, text, { reply_markup: kb });
            delivered++;
          } catch {
            // 403 from blocked user — continue loop
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, signal_id: signal.signal_id, delivered }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal error" }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => {
    console.log(`[webhook] listening on port ${port}`);
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
