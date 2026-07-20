import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getSignal, getProvider } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery(/^reply:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const signalId = ctx.match![1];
  const signal = await getSignal(signalId);
  if (!signal) {
    await ctx.editMessageText("Signal not found.", { reply_markup: backToMenu });
    return;
  }
  const provider = await getProvider(signal.provider_id);
  if (!provider) {
    await ctx.editMessageText("Provider not found.", { reply_markup: backToMenu });
    return;
  }

  ctx.session.step = `awaiting_reply:${signalId}`;
  await ctx.reply(`Type your message to ${provider.display_name}:`, {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your message…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  if (!step || !step.startsWith("awaiting_reply:")) return next();

  const signalId = step.split(":")[1];
  const messageText = ctx.message.text.trim();
  ctx.session.step = undefined;

  if (messageText.length === 0) {
    await ctx.reply("Message can't be empty. Try again.", { reply_markup: backToMenu });
    return;
  }

  const signal = await getSignal(signalId);
  if (!signal) {
    await ctx.reply("Signal not found.", { reply_markup: backToMenu });
    return;
  }

  const provider = await getProvider(signal.provider_id);
  if (!provider) {
    await ctx.reply("Provider not found.", { reply_markup: backToMenu });
    return;
  }

  try {
    await ctx.api.sendMessage(
      provider.user_id,
      `Anonymous message from a follower:\n\n${messageText}`,
    );
  } catch {
    // Provider may have blocked the bot — don't abort
  }

  await ctx.reply("Message sent!", { reply_markup: backToMenu });
});

export default composer;
