import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, mainMenuKeyboard } from "../toolkit/index.js";

registerMainMenuItem({ label: "🔍 Browse", data: "menu:browse", order: 10 });
registerMainMenuItem({ label: "🔎 Search", data: "menu:search", order: 20 });
registerMainMenuItem({ label: "📡 My follows", data: "menu:following", order: 30 });
registerMainMenuItem({ label: "🚀 Become a provider", data: "menu:become_provider", order: 40 });
registerMainMenuItem({ label: "📣 Send signal", data: "menu:signal", order: 50 });
registerMainMenuItem({ label: "🛡 Admin", data: "menu:admin", order: 90 });

const WELCOME = "👋 Welcome! Tap a button below to get started.";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  ctx.session.step = undefined;
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  ctx.session.step = undefined;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
