import feedparser
import pandas as pd

feeds = [
    "https://www.uscis.gov/newsroom/news-releases/rss.xml",
    "https://news.google.com/rss/search?q=H1B+visa"
]

records = []
for url in feeds:
    feed = feedparser.parse(url)
    for entry in feed.entries[:20]:
        title = entry.title
        link = entry.link
        records.append({"title": title, "link": link})

df = pd.DataFrame(records).drop_duplicates(subset="title")
df.to_csv("raw_news.csv", index=False)
print("✅ Saved raw_news.csv with", len(df), "articles")