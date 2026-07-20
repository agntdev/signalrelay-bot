import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getProvider, unfollow, removeFollowerIndex } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery(/^unfollow:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const providerId = ctx.match![1];
  const provider = await getProvider(providerId);

  if (!provider) {
    await ctx.editMessageText("Provider not found.", { reply_markup: backToMenu });
    return;
  }

  await unfollow(ctx.from!.id, providerId);
  await removeFollowerIndex(ctx.from!.id, providerId);

  await ctx.editMessageText(`Unfollowed ${provider.display_name}. You won't receive their alerts.`, {
    reply_markup: backToMenu,
  });
});

export default composer;
