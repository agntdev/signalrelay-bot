import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getFollower, getProvider } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("following", async (ctx) => {
  const following = await getFollower(ctx.from!.id);
  if (!following || following.followed_providers.length === 0) {
    await ctx.reply(
      "You're not following any providers yet. Tap 🔍 Browse to find one.",
      { reply_markup: backToMenu },
    );
    return;
  }
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const pid of following.followed_providers) {
    const p = await getProvider(pid);
    if (p) rows.push([inlineButton(p.display_name, `browse:pick:${pid}`)]);
  }
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.reply("Providers you follow:", { reply_markup: inlineKeyboard(rows) });
});

composer.callbackQuery("menu:following", async (ctx) => {
  await ctx.answerCallbackQuery();
  const following = await getFollower(ctx.from!.id);
  if (!following || following.followed_providers.length === 0) {
    await ctx.editMessageText(
      "You're not following any providers yet. Tap 🔍 Browse to find one.",
      { reply_markup: backToMenu },
    );
    return;
  }
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const pid of following.followed_providers) {
    const p = await getProvider(pid);
    if (p) rows.push([inlineButton(p.display_name, `browse:pick:${pid}`)]);
  }
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.editMessageText("Providers you follow:", { reply_markup: inlineKeyboard(rows) });
});

export default composer;
