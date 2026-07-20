import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getAllProviders } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("search", async (ctx) => {
  ctx.session.step = "awaiting_search_query";
  await ctx.reply("What provider are you looking for? Type a name or keyword.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type to search…" },
  });
});

composer.callbackQuery("menu:search", async (ctx) => {
  ctx.session.step = "awaiting_search_query";
  await ctx.answerCallbackQuery();
  await ctx.reply("What provider are you looking for? Type a name or keyword.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type to search…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_search_query") return next();
  const query = ctx.message.text.trim().toLowerCase();
  ctx.session.step = undefined;

  if (query.length < 2) {
    await ctx.reply("Type at least 2 characters to search.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const providers = await getAllProviders();
  const approved = providers.filter((p) => p.approved);
  const matches = approved.filter(
    (p) =>
      p.display_name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query),
  );

  if (matches.length === 0) {
    await ctx.reply(`No providers found for "${query}". Try a different keyword.`, {
      reply_markup: backToMenu,
    });
    return;
  }

  const rows = matches.map((p) => [
    inlineButton(p.display_name, `browse:pick:${p.provider_id}`),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.reply(`Results for "${query}":`, { reply_markup: inlineKeyboard(rows) });
});

export default composer;
