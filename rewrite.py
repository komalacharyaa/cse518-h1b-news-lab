import time
import random
import os
import google.generativeai as genai
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

# ----------------------------
# Configure Gemini
# ----------------------------
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash")

df = pd.read_csv("raw_news.csv")

def rewrite_title_in_tone(title, tone):
    neutral_words = ["neutral", "update", "report"]
    if tone == "neutral":
        words = title.split()
        neutral_title = " ".join(
            word if word.lower() not in ["bad", "negative", "scary"]
            else random.choice(neutral_words)
            for word in words
        )
        return neutral_title
    elif tone == "alarming":
        # Add logic to rewrite the title in an alarming tone
        words = title.split()
        alarming_title = " ".join(
            word if word.lower() not in ["good", "positive", "calm"]
            else "ALARMING! " + word.upper()
            for word in words
        )
        return alarming_title
    else:
        raise ValueError("Invalid tone. Choose 'neutral' or 'alarming'.")

def generate_news_from_title(title):
    neutral_title = rewrite_title_in_tone(title, "neutral")
    alarming_title = rewrite_title_in_tone(title, "alarming")
    neutral_news = model.generate_content(neutral_title)
    alarming_news = model.generate_content(alarming_title)
    return neutral_title, neutral_news, alarming_title, alarming_news

# Create a new DataFrame to store the results
new_df = pd.DataFrame(columns=["neutral_title", "neutral_news", "alarming_title", "alarming_news"])

# Iterate over the rows of the original DataFrame
for index, row in df.iterrows():
    title = row["title"]
    neutral_title, neutral_news, alarming_title, alarming_news = generate_news_from_title(title)
    new_row = {
        "neutral_title": neutral_title,
        "neutral_news": neutral_news,
        "alarming_title": alarming_title,
        "alarming_news": alarming_news
    }
    new_df = new_df._append(new_row, ignore_index=True)

# Save the new DataFrame to a CSV file
new_df.to_csv("new_news.csv", index=False)