import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getProvider, follow, addFollowerIndex, isFollowing } from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery(/^follow:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const providerId = ctx.match![1];
  const provider = await getProvider(providerId);

  if (!provider) {
    await ctx.editMessageText("Provider not found.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  if (!provider.approved) {
    await ctx.editMessageText("This provider is not approved yet.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const alreadyFollowing = await isFollowing(ctx.from!.id, providerId);
  if (alreadyFollowing) {
    await ctx.editMessageText(`You're already following ${provider.display_name}.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("Unfollow", `unfollow:${providerId}`)],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  await follow(ctx.from!.id, providerId);
  await addFollowerIndex(ctx.from!.id, providerId);

  await ctx.editMessageText(`Now following ${provider.display_name}. You'll receive their alerts.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
