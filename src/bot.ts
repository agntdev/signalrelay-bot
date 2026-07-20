import { Composer } from "grammy";
import { readdirSync } from "node:fs";
import { createBot, type BotContext } from "./toolkit/index.js";

export interface Session {
  step?: string;
  provider_name?: string;
  provider_description?: string;
  signal_content?: string;
  signal_symbol?: string;
  signal_direction?: "buy" | "sell";
  signal_size?: string;
}

export type Ctx = BotContext<Session>;

export async function buildBot(token: string) {
  const bot = createBot<Session>(token, {
    initial: () => ({}),
  });

  const dir = new URL("./handlers/", import.meta.url);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (f) =>
        (f.endsWith(".js") || f.endsWith(".ts")) &&
        !f.endsWith(".d.ts") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    files = [];
  }
  for (const file of files.sort()) {
    const mod = (await import(new URL(file, dir).href)) as { default?: Composer<Ctx> };
    if (!mod.default) {
      throw new Error(`handler ${file} must default-export a grammY Composer`);
    }
    bot.use(mod.default);
  }

  bot.on("message", (ctx) => ctx.reply("Sorry, I didn't understand that. Try /help."));

  return bot;
}
