import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getAllProviders, getFollower } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("browse", async (ctx) => {
  const providers = await getAllProviders();
  const approved = providers.filter((p) => p.approved);
  if (approved.length === 0) {
    await ctx.reply("No providers available yet. Check back soon!", {
      reply_markup: backToMenu,
    });
    return;
  }
  const rows = approved.map((p) => [
    inlineButton(p.display_name, `browse:pick:${p.provider_id}`),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.reply("Pick a provider to view their profile:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery("menu:browse", async (ctx) => {
  await ctx.answerCallbackQuery();
  const providers = await getAllProviders();
  const approved = providers.filter((p) => p.approved);
  if (approved.length === 0) {
    await ctx.editMessageText("No providers available yet. Check back soon!", {
      reply_markup: backToMenu,
    });
    return;
  }
  const rows = approved.map((p) => [
    inlineButton(p.display_name, `browse:pick:${p.provider_id}`),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.editMessageText("Pick a provider to view their profile:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^browse:pick:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const providerId = ctx.match![1];
  const { getProvider } = await import("../store.js");
  const provider = await getProvider(providerId);
  if (!provider || !provider.approved) {
    await ctx.editMessageText("Provider not found.", { reply_markup: backToMenu });
    return;
  }
  const following = await getFollower(ctx.from!.id);
  const isFollowing = following?.followed_providers.includes(providerId) ?? false;
  const action = isFollowing
    ? inlineButton("Unfollow", `unfollow:${providerId}`)
    : inlineButton("Follow", `follow:${providerId}`);
  const kb = inlineKeyboard([
    [action],
    [inlineButton("⬅️ Back to browse", "menu:browse")],
  ]);
  await ctx.editMessageText(
    `${provider.display_name}\n\n${provider.description}`,
    { reply_markup: kb },
  );
});

export default composer;
