import os
from typing import Dict, List, Optional
import openai
from textblob import TextBlob
import spacy
from transformers import pipeline
from .models import ProcessedData, Analytics
from django.utils import timezone
import numpy as np
from datetime import datetime, timedelta

# Initialize NLP models
nlp = spacy.load("en_core_web_sm")
sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

def analyze_sentiment(text: str) -> Dict:
    """
    Perform detailed sentiment analysis using multiple models
    """
    # TextBlob sentiment
    blob = TextBlob(text)
    textblob_sentiment = blob.sentiment
    
    # Transformers sentiment
    transformer_sentiment = sentiment_analyzer(text)[0]
    
    # Combine results
    return {
        "textblob": {
            "polarity": textblob_sentiment.polarity,
            "subjectivity": textblob_sentiment.subjectivity
        },
        "transformer": {
            "label": transformer_sentiment["label"],
            "score": transformer_sentiment["score"]
        },
        "overall_score": (textblob_sentiment.polarity + transformer_sentiment["score"]) / 2
    }

def extract_entities(text: str) -> List[Dict]:
    """
    Extract named entities from text using spaCy
    """
    doc = nlp(text)
    entities = []
    
    for ent in doc.ents:
        entities.append({
            "text": ent.text,
            "label": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char
        })
    
    return entities

def generate_llm_insights(text: str) -> Dict:
    """
    Generate insights using OpenAI's GPT model
    """
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a news analysis expert. Analyze the following news article and provide key insights."},
                {"role": "user", "content": text}
            ],
            max_tokens=500
        )
        
        return {
            "summary": response.choices[0].message.content,
            "generated_at": timezone.now().isoformat()
        }
    except Exception as e:
        print(f"Error generating LLM insights: {str(e)}")
        return None

def process_article(article: ProcessedData) -> None:
    """
    Process a single article with all analytics
    """
    # Combine text for analysis
    text = f"{article.title} {article.description} {article.content}"
    
    # Perform sentiment analysis
    sentiment_results = analyze_sentiment(text)
    article.sentiment_score = sentiment_results["overall_score"]
    article.sentiment_details = sentiment_results
    
    # Extract entities
    article.entities = extract_entities(text)
    
    # Generate LLM insights
    llm_results = generate_llm_insights(text)
    if llm_results:
        article.llm_summary = llm_results["summary"]
        article.llm_insights = llm_results
    
    article.save()

def aggregate_analytics(country: str, date: Optional[datetime] = None) -> None:
    """
    Aggregate analytics for a specific country and date
    """
    if date is None:
        date = timezone.now().date()
    
    # Get articles for the specified country and date
    articles = ProcessedData.objects.filter(
        country=country,
        published_date__date=date
    )
    
    if not articles.exists():
        return
    
    # Calculate sentiment trends
    sentiment_scores = [a.sentiment_score for a in articles if a.sentiment_score is not None]
    sentiment_trend = {
        "mean": np.mean(sentiment_scores) if sentiment_scores else 0,
        "std": np.std(sentiment_scores) if sentiment_scores else 0,
        "count": len(sentiment_scores)
    }
    
    # Aggregate entities
    all_entities = []
    for article in articles:
        if article.entities:
            all_entities.extend(article.entities)
    
    entity_frequency = {}
    for entity in all_entities:
        key = f"{entity['text']}_{entity['label']}"
        entity_frequency[key] = entity_frequency.get(key, 0) + 1
    
    # Create or update analytics record
    Analytics.objects.update_or_create(
        country=country,
        date=date,
        defaults={
            "sentiment_trend": sentiment_trend,
            "entity_frequency": entity_frequency,
            "topic_distribution": {},  # To be implemented
            "engagement_metrics": {}   # To be implemented
        }
    ) 