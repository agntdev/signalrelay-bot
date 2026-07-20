import { buildBot } from "./bot.js";
import { setDefaultCommands } from "./toolkit/index.js";
import { startWebhookServer } from "./webhook.js";

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN is required");
    process.exit(1);
  }
  const bot = await buildBot(token);
  await setDefaultCommands(bot);

  // Start webhook server if WEBHOOK_PORT is set
  if (process.env.WEBHOOK_PORT) {
    startWebhookServer(bot);
  }

  bot.start();
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
