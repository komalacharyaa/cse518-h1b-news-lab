from openai import OpenAI
import pandas as pd
import os
from dotenv import load_dotenv
import random

load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=openai_key)

# Input: CSV with real or simulated headlines and summaries
df = pd.read_csv("raw_news.csv")

def rewrite(text, tone):
    prompt = f"""
    Rewrite the following H1B policy news update in a {tone} tone.
    Keep facts accurate, use short sentences, and retain meaning.
    Text: "{text}"
    """
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )

    return response.choices[0].message.content.strip()

def generate_neutral_news_title(title):
    # Your logic to generate a neutral version of the news title goes here
    # For example, you can replace negative words with neutral words or remove any emotional language
    # Here's a simple example:
    neutral_words = ["neutral", "news", "update"]
    words = title.split()
    neutral_title = " ".join([word if word not in ["bad", "negative", "scary"] else random.choice(neutral_words) for word in words])
    return neutral_title

def generate_alarming_news_title(title):
    # Your logic to generate a neutral version of the news title goes here
    # For example, you can replace negative words with neutral words or remove any emotional language
    # Here's a simple example:
    alarming_words = ["bad", "negative", "scary"]
    words = title.split()
    alarming_title = " ".join([word if word not in ["bad", "negative", "scary"] else random.choice(alarming_words) for word in words])
    return alarming_title

df["neutral_title"] = df["title"]
df["alarming_title"] = df["title"]
df["neutral_version"] = ""
df["alarming_version"] = ""

for index, row in df.iterrows():
    title = row["title"]
    neutral_title = generate_neutral_news_title(title)
    alarming_title = generate_alarming_news_title(title)
    neutral_version = rewrite(title, "neutral")
    alarming_version = rewrite(title, "alarming, dramatic, emotional")
    df.at[index, "neutral_title"] = neutral_title
    df.at[index, "alarming_title"] = alarming_title
    df.at[index, "neutral_version"] = neutral_version
    df.at[index, "alarming_version"] = alarming_version

df = df[["neutral_title", "alarming_title", "neutral_version", "alarming_version", "link"]]

df.to_csv("rewritten_news.csv", index=False)
print("Saved rewritten variants!")