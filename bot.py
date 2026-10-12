import os
import json
import time
import hashlib
import logging
import requests
import feedparser
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from telegram import Bot
from telegram.constants import ParseMode

TOKEN = os.environ["توکن_ربات_تلگرام"]
CHANNEL = os.environ.get("CHANNEL_ID", "@YOUR_CHANNEL_USERNAME")

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN)

RSS_URL = (
    "https://news.google.com/rss/search?"
    "q=فوتبال+ایران+OR+پرسپولیس+OR+استقلال&hl=fa&gl=IR&ceid=IR:fa"
)

SEEN_FILE = "seen.json"

def load_seen():
    try:
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except Exception:
        return set()

def save_seen(seen):
    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(list(seen)[-500:], f, ensure_ascii=False)

def make_card(title):
    image = Image.new("RGB", (1000, 560), (20, 30, 45))
    draw = ImageDraw.Draw(image)
    draw.rectangle((25, 25, 975, 535), outline=(240, 180, 50), width=5)
    draw.text((500, 100), "GOL NEWS", fill=(255, 190, 50), anchor="mm")
    draw.text((500, 280), title[:100], fill="white", anchor="mm", align="center")
    draw.text((500, 470), "اخبار فوتبال ایران", fill=(220, 220, 220), anchor="mm")
    output = BytesIO()
    image.save(output, format="JPEG")
    output.seek(0)
    return output

def main():
    seen = load_seen()
    while True:
        try:
            feed = feedparser.parse(RSS_URL)
            for entry in reversed(feed.entries[:20]):
                url = entry.get("link", "")
                title = entry.get("title", "").strip()
                if not url or not title:
                    continue

                item_id = hashlib.sha256(url.encode()).hexdigest()
                if item_id in seen:
                    continue

                caption = (
                    f"⚽ <b>گل نیوز | GOL NEWS</b>\n\n"
                    f"📰 {title}\n\n"
                    f"🔗 <a href=\"{url}\">مشاهده منبع خبر</a>\n"
                    f"🇮🇷 اخبار فوتبال ایران"
                )

                try:
                    response = requests.get(url, timeout=10, headers={
                        "User-Agent": "Mozilla/5.0"
                    })
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(response.text, "html.parser")
                    tag = soup.find("meta", property="og:image")
                    image_url = tag.get("content") if tag else None

                    if image_url:
                        photo = requests.get(image_url, timeout=15)
                        photo.raise_for_status()
                        bot.send_photo(
                            chat_id=CHANNEL,
                            photo=BytesIO(photo.content),
                            caption=caption,
                            parse_mode=ParseMode.HTML
                        )
                    else:
                        bot.send_photo(
                            chat_id=CHANNEL,
                            photo=make_card(title),
                            caption=caption,
                            parse_mode=ParseMode.HTML
                        )
                except Exception:
                    logging.exception("News post failed")
                    continue

                seen.add(item_id)
                save_seen(seen)
                time.sleep(3)

        except Exception:
            logging.exception("RSS check failed")

        time.sleep(1800)

if __name__ == "__main__":
    main()
