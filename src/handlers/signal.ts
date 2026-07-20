import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  createSignal,
  getFollowerIdsForProvider,
} from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery("menu:signal", async (ctx) => {
  await ctx.answerCallbackQuery();
  const provider = await getProviderByUserId(ctx.from!.id);
  if (!provider) {
    await ctx.editMessageText("You're not a provider yet. Tap 🚀 Become a provider to apply.", {
      reply_markup: backToMenu,
    });
    return;
  }
  if (!provider.approved) {
    await ctx.editMessageText("Your provider request is still pending admin approval.", {
      reply_markup: backToMenu,
    });
    return;
  }
  ctx.session.step = "awaiting_signal_content";
  await ctx.reply("What's the signal? Type your alert message.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Signal message…" },
  });
});

composer.command("signal", async (ctx) => {
  const provider = await getProviderByUserId(ctx.from!.id);
  if (!provider) {
    await ctx.reply("You're not a provider yet. Tap 🚀 Become a provider to apply.", {
      reply_markup: backToMenu,
    });
    return;
  }
  if (!provider.approved) {
    await ctx.reply("Your provider request is still pending admin approval.", {
      reply_markup: backToMenu,
    });
    return;
  }
  ctx.session.step = "awaiting_signal_content";
  await ctx.reply("What's the signal? Type your alert message.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Signal message…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  if (!step) return next();

  if (step === "awaiting_signal_content") {
    const content = ctx.message.text.trim();
    if (content.length === 0) {
      await ctx.reply("Signal can't be empty. Try again.");
      return;
    }
    ctx.session.signal_content = content;
    ctx.session.step = "awaiting_signal_symbol";
    await ctx.reply("Optional: what symbol/asset? (or type /skip to skip)", {
      reply_markup: { force_reply: true, input_field_placeholder: "e.g. BTC, AAPL…" },
    });
    return;
  }

  if (step === "awaiting_signal_symbol") {
    const text = ctx.message.text.trim();
    if (text !== "/skip") {
      ctx.session.signal_symbol = text || undefined;
    }
    ctx.session.step = "awaiting_signal_direction";
    await ctx.reply("Direction? (or /skip to skip)", {
      reply_markup: inlineKeyboard([
        [inlineButton("🟢 Buy", "signal:dir:buy"), inlineButton("🔴 Sell", "signal:dir:sell")],
        [inlineButton("Skip", "signal:dir:skip")],
      ]),
    });
    return;
  }

  if (step === "awaiting_signal_size") {
    const text = ctx.message.text.trim();
    if (text !== "/skip") {
      ctx.session.signal_size = text || undefined;
    }
    await sendSignal(ctx);
    return;
  }

  return next();
});

composer.callbackQuery(/^signal:dir:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const dir = ctx.match![1];
  if (dir !== "skip") {
    ctx.session.signal_direction = dir as "buy" | "sell";
  }
  ctx.session.step = "awaiting_signal_size";
  await ctx.reply("Position size? (or type /skip to skip)", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 0.5 BTC, $1000…" },
  });
});

composer.callbackQuery(/^signal:skip$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const step = ctx.session.step;
  if (step === "awaiting_signal_direction") {
    ctx.session.step = "awaiting_signal_size";
    await ctx.reply("Position size? (or type /skip to skip)", {
      reply_markup: { force_reply: true, input_field_placeholder: "e.g. 0.5 BTC, $1000…" },
    });
  }
});

async function sendSignal(ctx: Ctx) {
  const provider = await getProviderByUserId(ctx.from!.id);
  if (!provider) {
    await ctx.reply("Something went wrong.", { reply_markup: backToMenu });
    return;
  }

  const signal = await createSignal({
    provider_id: provider.provider_id,
    content: ctx.session.signal_content!,
    symbol: ctx.session.signal_symbol,
    direction: ctx.session.signal_direction,
    size: ctx.session.signal_size,
  });

  ctx.session.step = undefined;
  ctx.session.signal_content = undefined;
  ctx.session.signal_symbol = undefined;
  ctx.session.signal_direction = undefined;
  ctx.session.signal_size = undefined;

  const followerIds = await getFollowerIdsForProvider(provider.provider_id);
  let delivered = 0;
  for (const userId of followerIds) {
    try {
      await sendSignalCard(ctx, userId, signal, provider.display_name);
      delivered++;
    } catch {
      // 403 from blocked user — continue loop
    }
  }

  await ctx.reply(
    `Signal sent to ${delivered} follower${delivered !== 1 ? "s" : ""}.`,
    { reply_markup: backToMenu },
  );
}

async function sendSignalCard(
  ctx: Ctx,
  chatId: number,
  signal: Awaited<ReturnType<typeof createSignal>>,
  providerName: string,
) {
  const directionEmoji = signal.direction === "buy" ? "🟢 BUY" : signal.direction === "sell" ? "🔴 SELL" : "";
  const meta = [directionEmoji, signal.symbol, signal.size].filter(Boolean).join(" · ");

  const text = [
    `From ${providerName}:`,
    "",
    signal.content,
    meta ? `\n${meta}` : "",
  ].join("\n");

  const kb = inlineKeyboard([
    [
      inlineButton("Reply", `reply:${signal.signal_id}`),
      inlineButton("Report", `report:${signal.signal_id}`),
    ],
  ]);

  await ctx.api.sendMessage(chatId, text, { reply_markup: kb });
}

async function getProviderByUserId(userId: number) {
  const { getAllProviders } = await import("../store.js");
  const providers = await getAllProviders();
  return providers.find((p) => p.user_id === userId) ?? null;
}

export default composer;
