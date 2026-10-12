const TelegramBot = require("node-telegram-bot-api");
const Parser = require("rss-parser");
const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL = process.env.CHANNEL_ID;

if (!TOKEN || !CHANNEL) {
  console.error("BOT_TOKEN or CHANNEL_ID is missing!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: false });
const parser = new Parser();

const FEEDS = [
  "https://news.google.com/rss/search?q=%D9%81%D9%88%D8%AA%D8%A8%D8%A7%D9%84+%D8%A7%DB%8C%D8%B1%D8%A7%D9%86&hl=fa&gl=IR&ceid=IR:fa",
  "https://news.google.com/rss/search?q=%D9%BE%D8%B1%D8%B3%D9%BE%D9%88%D9%84%DB%8C%D8%B3+OR+%D8%A7%D8%B3%D8%AA%D9%82%D9%84%D8%A7%D9%84&hl=fa&gl=IR&ceid=IR:fa"
];

const posted = new Set();
const MAX_POSTED_IDS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHTML(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getImage(articleUrl) {
  try {
    const response = await axios.get(articleUrl, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
      maxRedirects: 5
    });

    const html = response.data;
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (match && match[1]) return match[1];
  } catch (error) {
    console.log("Image unavailable");
  }

  return null;
}

async function publishArticle(article) {
  const title = article.title?.trim();
  const url = article.link;

  if (!title || !url) return;

  const caption =
    `⚽ <b>گل نیوز | GOL NEWS</b>\n\n` +
    `📰 ${escapeHTML(title)}\n\n` +
    `🔗 <a href="${escapeHTML(url)}">مشاهده منبع خبر</a>\n` +
    `🇮🇷 اخبار فوتبال ایران`;

  const imageUrl = await getImage(url);

  if (imageUrl) {
    try {
      await bot.sendPhoto(CHANNEL, imageUrl, {
        caption,
        parse_mode: "HTML"
      });
      return;
    } catch (error) {
      console.log("Could not send article image");
    }
  }

  await bot.sendMessage(CHANNEL, caption, {
    parse_mode: "HTML",
    disable_web_page_preview: false
  });
}

async function checkNews() {
  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);

      for (const article of [...feed.items].reverse().slice(-10)) {
        const id = article.guid || article.link || article.title;

        if (!id || posted.has(id)) continue;

        try {
          await publishArticle(article);
          posted.add(id);

          if (posted.size > MAX_POSTED_IDS) {
            const first = posted.values().next().value;
            posted.delete(first);
          }

          console.log("Published:", article.title);
          await sleep(3000);
        } catch (error) {
          console.error("Publishing failed:", error.message);
        }
      }
    } catch (error) {
      console.error("RSS error:", error.message);
    }
  }
}

async function start() {
  console.log("GOL NEWS bot started!");
  await checkNews();

  setInterval(() => {
    checkNews().catch(console.error);
  }, 30 * 60 * 1000);
}

start().catch(console.error);
