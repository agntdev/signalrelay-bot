import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getSignal, createReport, getProvider, getAdminIds } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery(/^report:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const signalId = ctx.match![1];
  const signal = await getSignal(signalId);
  if (!signal) {
    await ctx.editMessageText("Signal not found.", { reply_markup: backToMenu });
    return;
  }

  const report = await createReport({
    signal_id: signalId,
    user_id: ctx.from!.id,
  });

  const provider = await getProvider(signal.provider_id);
  const providerName = provider?.display_name ?? "Unknown";

  const adminIds = getAdminIds();
  for (const adminId of adminIds) {
    try {
      await ctx.api.sendMessage(
        adminId,
        `Report #${report.report_id} filed against signal from ${providerName}:\n\n"${signal.content}"\n\nReported by user: ${ctx.from!.id}`,
      );
    } catch {
      // skip unreachable admins
    }
  }

  await ctx.editMessageText("Report submitted. Our team will review it.", {
    reply_markup: backToMenu,
  });
});

export default composer;
