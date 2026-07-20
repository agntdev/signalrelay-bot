import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { createProvider, getAdminIds } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("become_provider", async (ctx) => {
  ctx.session.step = "awaiting_provider_name";
  await ctx.reply("What display name should followers see?", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your provider name…" },
  });
});

composer.callbackQuery("menu:become_provider", async (ctx) => {
  ctx.session.step = "awaiting_provider_name";
  await ctx.answerCallbackQuery();
  await ctx.reply("What display name should followers see?", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your provider name…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step === "awaiting_provider_name") {
    const name = ctx.message.text.trim();
    if (name.length < 2) {
      await ctx.reply("Name too short — use at least 2 characters.");
      return;
    }
    ctx.session.provider_name = name;
    ctx.session.step = "awaiting_provider_description";
    await ctx.reply("Now describe what kind of signals you provide.", {
      reply_markup: { force_reply: true, input_field_placeholder: "Short description…" },
    });
    return;
  }

  if (ctx.session.step === "awaiting_provider_description") {
    const desc = ctx.message.text.trim();
    if (desc.length < 5) {
      await ctx.reply("Description too short — use at least 5 characters.");
      return;
    }
    ctx.session.provider_description = desc;
    const name = ctx.session.provider_name!;
    const description = ctx.session.provider_description;

    const provider = await createProvider({
      user_id: ctx.from!.id,
      display_name: name,
      description,
    });

    ctx.session.step = undefined;
    ctx.session.provider_name = undefined;
    ctx.session.provider_description = undefined;

    const adminIds = getAdminIds();
    for (const adminId of adminIds) {
      try {
        const kb = inlineKeyboard([
          [
            inlineButton("Approve", `admin:approve:${provider.provider_id}`),
            inlineButton("Reject", `admin:reject:${provider.provider_id}`),
          ],
        ]);
        await ctx.api.sendMessage(
          adminId,
          `New provider request:\n\nName: ${provider.display_name}\nDescription: ${provider.description}\nUser ID: ${ctx.from!.id}`,
          { reply_markup: kb },
        );
      } catch {
        // skip unreachable admins
      }
    }

    await ctx.reply(
      `Thanks, ${name}! Your provider request has been submitted. An admin will review it shortly.`,
      { reply_markup: backToMenu },
    );
    return;
  }

  return next();
});

export default composer;
