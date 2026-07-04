require("dotenv").config();

const express = require("express");
const { Telegraf, Markup, session } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) throw new Error("Missing BOT_TOKEN");
if (!ADMIN_CHAT_ID) throw new Error("Missing ADMIN_CHAT_ID");

const bot = new Telegraf(BOT_TOKEN);
const app = express();

bot.use(session());

const serviceButtons = [
  ["Book Formatting", "KDP Publishing"],
  ["IngramSpark Publishing", "Book Promotion"],
  ["Amazon KDP Ads", "Other Service"]
];

const platformButtons = [
  ["Amazon KDP", "IngramSpark"],
  ["Both", "Not Sure Yet"]
];

const yesNoButtons = [["Yes", "No"]];

function beginQuote(ctx) {
  ctx.session = {
    step: "service",
    lead: {
      telegramName: ctx.from.first_name || "Unknown",
      telegramUsername: ctx.from.username ? `@${ctx.from.username}` : "No username",
      telegramId: ctx.from.id
    }
  };

  return ctx.reply(
    "Welcome to Publish My Book.\n\nI help authors with book formatting, KDP publishing, IngramSpark publishing, book promotion, and Amazon KDP ads.\n\nWhat service do you need?",
    Markup.keyboard(serviceButtons).resize()
  );
}

bot.start(beginQuote);
bot.command("quote", beginQuote);

bot.command("services", (ctx) => {
  ctx.reply(
    "Available services:\n\n• Book Formatting\n• Amazon KDP Publishing\n• IngramSpark Publishing\n• Book Promotion\n• Amazon KDP Ads\n\nSend /quote to get started."
  );
});

bot.command("cancel", (ctx) => {
  ctx.session = {};
  ctx.reply(
    "Your request has been cancelled. Send /start whenever you are ready.",
    Markup.removeKeyboard()
  );
});

bot.on("text", async (ctx) => {
  const answer = ctx.message.text.trim();

  if (!ctx.session || !ctx.session.step) {
    return ctx.reply("Send /start to begin your publishing request.");
  }

  const { lead, step } = ctx.session;

  if (step === "service") {
    if (!serviceButtons.flat().includes(answer)) {
      return ctx.reply("Choose a service using the buttons below.");
    }

    lead.service = answer;
    ctx.session.step = "bookTitle";

    return ctx.reply(
      "What is your book title?\n\nIf you have not chosen one yet, type: Not decided",
      Markup.removeKeyboard()
    );
  }

  if (step === "bookTitle") {
    lead.bookTitle = answer;
    ctx.session.step = "genre";

    return ctx.reply(
      "What is the book genre?\n\nExample: Romance, Children’s Book, Memoir, Business, Fiction."
    );
  }

  if (step === "genre") {
    lead.genre = answer;
    ctx.session.step = "wordCount";

    return ctx.reply(
      "What is the approximate word count?\n\nExample: 30,000 words."
    );
  }

  if (step === "wordCount") {
    lead.wordCount = answer;
    ctx.session.step = "platform";

    return ctx.reply(
      "Which publishing platform do you need?",
      Markup.keyboard(platformButtons).resize()
    );
  }

  if (step === "platform") {
    if (!platformButtons.flat().includes(answer)) {
      return ctx.reply("Choose a platform using the buttons.");
    }

    lead.platform = answer;
    ctx.session.step = "manuscriptReady";

    return ctx.reply(
      "Is your manuscript ready?",
      Markup.keyboard(yesNoButtons).resize()
    );
  }

  if (step === "manuscriptReady") {
    if (!yesNoButtons.flat().includes(answer)) {
      return ctx.reply("Choose Yes or No.");
    }

    lead.manuscriptReady = answer;
    ctx.session.step = "deadline";

    return ctx.reply(
      "What is your preferred deadline?\n\nExample: 7 days, August 20, or No fixed deadline.",
      Markup.removeKeyboard()
    );
  }

  if (step === "deadline") {
    lead.deadline = answer;
    ctx.session.step = "budget";

    return ctx.reply(
      "What is your estimated budget?\n\nExample: $50–$100."
    );
  }

  if (step === "budget") {
    lead.budget = answer;
    ctx.session.step = "email";

    return ctx.reply("What email address should I use to contact you?");
  }

  if (step === "email") {
    if (!answer.includes("@") || !answer.includes(".")) {
      return ctx.reply("Enter a valid email address. Example: author@email.com");
    }

    lead.email = answer;
    ctx.session.step = "notes";

    return ctx.reply(
      "Add any extra details, manuscript links, or special requirements.\n\nType None if you have nothing else to add."
    );
  }

  if (step === "notes") {
    lead.notes = answer;

    const adminLead = `
📚 NEW PUBLISHING LEAD

Service: ${lead.service}
Book Title: ${lead.bookTitle}
Genre: ${lead.genre}
Word Count: ${lead.wordCount}
Platform: ${lead.platform}
Manuscript Ready: ${lead.manuscriptReady}
Deadline: ${lead.deadline}
Budget: ${lead.budget}
Email: ${lead.email}
Notes: ${lead.notes}

Client Name: ${lead.telegramName}
Telegram Username: ${lead.telegramUsername}
Telegram ID: ${lead.telegramId}
`.trim();

    try {
      await ctx.telegram.sendMessage(ADMIN_CHAT_ID, adminLead);

      await ctx.reply(
        "Your request has been received successfully.\n\nI will review the details and contact you soon.",
        Markup.removeKeyboard()
      );

      ctx.session = {};
    } catch (error) {
      console.error(error);
      await ctx.reply(
        "There was a problem sending your request. Please send /start and try again."
      );
    }
  }
});

app.get("/", (req, res) => {
  res.send("Publish My Book Bot is live.");
});

app.get("/health", (req, res) => {
  res.json({ status: "online" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

bot.launch()
  .then(() => console.log("Publish My Book Bot started"))
  .catch((error) => console.error("Bot error:", error));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
