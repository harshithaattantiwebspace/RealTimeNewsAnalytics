# api/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import ProcessedData, Analytics
from .analytics import process_article, aggregate_analytics
from .visualization import (
    create_sentiment_heatmap,
    create_entity_network,
    create_sentiment_timeline,
    create_interactive_map
)
from django.utils import timezone
from datetime import timedelta

@api_view(['GET'])
def country_news(request):
    country_code = request.GET.get('country', '').lower()
    print(f"Country code received: {country_code}")
    #country_code = 'us'
    limit = int(request.GET.get('limit', 10))  # Default to 10 articles
    
    articles = ProcessedData.objects.filter(country=country_code)\
                           .order_by('-published_date')[:limit]
    
    data = [{
        "title": article.title,
        "description": article.description,
        "source": article.source,
        "published_date": article.published_date,
        "link": article.link,
        "sentiment_score": article.sentiment_score,
        "llm_summary": article.llm_summary,
        "entities": article.entities
    } for article in articles]
    
    return Response(data)

@api_view(['GET'])
def country_analytics(request):
    country_code = request.GET.get('country', '').lower()
    days = int(request.GET.get('days', 7))
    
    # Get analytics data
    end_date = timezone.now()
    start_date = end_date - timedelta(days=days)
    
    analytics = Analytics.objects.filter(
        country=country_code,
        date__range=(start_date, end_date)
    ).order_by('date')
    
    data = {
        "sentiment_trend": [{
            "date": a.date,
            "mean": a.sentiment_trend['mean'],
            "std": a.sentiment_trend['std'],
            "count": a.sentiment_trend['count']
        } for a in analytics],
        "entity_frequency": analytics.last().entity_frequency if analytics.exists() else {},
        "topic_distribution": analytics.last().topic_distribution if analytics.exists() else {}
    }
    
    return Response(data)

@api_view(['GET'])
def sentiment_heatmap(request):
    country_code = request.GET.get('country', '').lower()
    days = int(request.GET.get('days', 7))
    
    heatmap_data = create_sentiment_heatmap(country_code, days)
    return Response(heatmap_data)

@api_view(['GET'])
def entity_network(request):
    country_code = request.GET.get('country', '').lower()
    
    network_data = create_entity_network(country_code)
    return Response(network_data)

@api_view(['GET'])
def sentiment_timeline(request):
    country_code = request.GET.get('country', '').lower()
    days = int(request.GET.get('days', 30))
    
    timeline_data = create_sentiment_timeline(country_code, days)
    return Response(timeline_data)

@api_view(['GET'])
def interactive_map(request):
    map_html = create_interactive_map()
    return Response({"map_html": map_html})

@api_view(['POST'])
def process_new_article(request):
    """
    Process a new article with sentiment analysis and LLM insights
    """
    article_id = request.data.get('article_id')
    try:
        article = ProcessedData.objects.get(id=article_id)
        process_article(article)
        aggregate_analytics(article.country)
        return Response({"status": "success"})
    except ProcessedData.DoesNotExist:
        return Response({"error": "Article not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
