import feedparser, requests, pandas as pd
from bs4 import BeautifulSoup

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
        # Fetch article snippet (optional)
        try:
            html = requests.get(link, timeout=5).text
            soup = BeautifulSoup(html, "html.parser")
            paras = [p.get_text(" ", strip=True) for p in soup.find_all("p")[:3]]
            summary = " ".join(paras)
        except Exception:
            summary = ""
        records.append({"title": title, "summary": summary, "source_url": link})

df = pd.DataFrame(records).drop_duplicates(subset="title")
df.to_csv("raw_news.csv", index=False)
print("✅ Saved raw_news.csv with", len(df), "articles")
