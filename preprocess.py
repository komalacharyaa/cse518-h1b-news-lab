import pandas as pd
df = pd.read_csv("raw_news.csv")

# Combine title + summary for rewriting input
df["text"] = df["title"] + ". " + df["summary"]
df["text"] = df["text"].str.replace("\\s+", " ", regex=True).str.strip()

# Remove very short or duplicate lines
# df = df[df["text"].str.len() > 10000].drop_duplicates("text")

df.to_csv("raw_news.csv", index=False)
print("✅ Cleaned raw_news.csv ready for rewrite_tones.py")
