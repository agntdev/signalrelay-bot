import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getAdminIds,
  getAllProviders,
  saveProvider,
  logAdminAction,
  getAllReports,
  getSignal,
  getProvider,
} from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function isAdmin(userId: number): boolean {
  return getAdminIds().includes(userId);
}

composer.callbackQuery("menu:admin", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from!.id)) {
    await ctx.editMessageText("You don't have admin access.", { reply_markup: backToMenu });
    return;
  }
  const kb = inlineKeyboard([
    [inlineButton("Pending providers", "admin:pending")],
    [inlineButton("View reports", "admin:reports")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
  await ctx.editMessageText("Admin panel:", { reply_markup: kb });
});

composer.callbackQuery("admin:pending", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from!.id)) {
    await ctx.editMessageText("Access denied.", { reply_markup: backToMenu });
    return;
  }
  const providers = await getAllProviders();
  const pending = providers.filter((p) => !p.approved);
  if (pending.length === 0) {
    await ctx.editMessageText("No pending provider requests.", { reply_markup: backToMenu });
    return;
  }
  const rows = pending.map((p) => [
    inlineButton(p.display_name, `admin:view:${p.provider_id}`),
  ]);
  rows.push([inlineButton("⬅️ Back", "menu:admin")]);
  await ctx.editMessageText(`${pending.length} pending request(s):`, {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^admin:view:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from!.id)) return;
  const providerId = ctx.match![1];
  const { getProvider } = await import("../store.js");
  const p = await getProvider(providerId);
  if (!p) {
    await ctx.editMessageText("Provider not found.", { reply_markup: backToMenu });
    return;
  }
  const kb = inlineKeyboard([
    [
      inlineButton("Approve", `admin:approve:${providerId}`),
      inlineButton("Reject", `admin:reject:${providerId}`),
    ],
    [inlineButton("⬅️ Back", "admin:pending")],
  ]);
  await ctx.editMessageText(
    `Name: ${p.display_name}\nDescription: ${p.description}\nUser: ${p.user_id}\nApproved: ${p.approved ? "Yes" : "No"}`,
    { reply_markup: kb },
  );
});

composer.callbackQuery(/^admin:approve:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from!.id)) return;
  const providerId = ctx.match![1];
  const { getProvider } = await import("../store.js");
  const p = await getProvider(providerId);
  if (!p) {
    await ctx.editMessageText("Provider not found.", { reply_markup: backToMenu });
    return;
  }
  p.approved = true;
  await saveProvider(p);
  await logAdminAction({ action_type: "approve", provider_id: providerId });
  try {
    await ctx.api.sendMessage(
      p.user_id,
      `Your provider "${p.display_name}" has been approved! You can now send signals.`,
    );
  } catch {
    // unreachable user
  }
  await ctx.editMessageText(`Approved: ${p.display_name}`, { reply_markup: backToMenu });
});

composer.callbackQuery(/^admin:reject:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from!.id)) return;
  const providerId = ctx.match![1];
  const { getProvider } = await import("../store.js");
  const p = await getProvider(providerId);
  if (!p) {
    await ctx.editMessageText("Provider not found.", { reply_markup: backToMenu });
    return;
  }
  await logAdminAction({ action_type: "reject", provider_id: providerId });
  try {
    await ctx.api.sendMessage(
      p.user_id,
      `Your provider request "${p.display_name}" was not approved at this time.`,
    );
  } catch {
    // unreachable user
  }
  await ctx.editMessageText(`Rejected: ${p.display_name}`, { reply_markup: backToMenu });
});

composer.callbackQuery("admin:reports", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx.from!.id)) {
    await ctx.editMessageText("Access denied.", { reply_markup: backToMenu });
    return;
  }
  const reports = await getAllReports();
  if (reports.length === 0) {
    await ctx.editMessageText("No reports filed.", { reply_markup: backToMenu });
    return;
  }
  const latest = reports.slice(-5).reverse();
  const lines: string[] = [];
  for (const r of latest) {
    const signal = await getSignal(r.signal_id);
    const provider = signal ? await getProvider(signal.provider_id) : null;
    const providerName = provider?.display_name ?? "Unknown";
    lines.push(`• Report #${r.report_id}\n  Signal from ${providerName}\n  Reported by: ${r.user_id}`);
  }
  const kb = inlineKeyboard([[inlineButton("⬅️ Back", "menu:admin")]]);
  await ctx.editMessageText(lines.join("\n\n"), { reply_markup: kb });
});

export default composer;
