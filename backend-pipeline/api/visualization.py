import folium
from folium import plugins
import plotly.express as px
import plotly.graph_objects as go
from typing import List, Dict
import pandas as pd
from .models import ProcessedData, Analytics
from django.utils import timezone
from datetime import timedelta
import json

def create_sentiment_heatmap(country: str, days: int = 7) -> Dict:
    """
    Create a heatmap of sentiment scores over time for a country
    """
    end_date = timezone.now()
    start_date = end_date - timedelta(days=days)
    
    articles = ProcessedData.objects.filter(
        country=country,
        published_date__range=(start_date, end_date)
    ).values('published_date', 'sentiment_score')
    
    df = pd.DataFrame(articles)
    if df.empty:
        return None
    
    # Create heatmap data
    df['hour'] = df['published_date'].dt.hour
    df['day'] = df['published_date'].dt.day_name()
    
    pivot_table = df.pivot_table(
        values='sentiment_score',
        index='day',
        columns='hour',
        aggfunc='mean'
    )
    
    # Create heatmap
    fig = go.Figure(data=go.Heatmap(
        z=pivot_table.values,
        x=pivot_table.columns,
        y=pivot_table.index,
        colorscale='RdYlGn'
    ))
    
    fig.update_layout(
        title=f'Sentiment Heatmap for {country.upper()}',
        xaxis_title='Hour of Day',
        yaxis_title='Day of Week'
    )
    
    return json.loads(fig.to_json())

def create_entity_network(country: str) -> Dict:
    """
    Create a network graph of entities and their relationships
    """
    articles = ProcessedData.objects.filter(
        country=country,
        entities__isnull=False
    ).values('entities')
    
    # Process entities and their relationships
    nodes = set()
    edges = []
    
    for article in articles:
        entities = article['entities']
        for i, entity1 in enumerate(entities):
            nodes.add(entity1['text'])
            for entity2 in entities[i+1:]:
                edges.append((entity1['text'], entity2['text']))
    
    # Create network graph
    fig = go.Figure(data=go.Scatter(
        x=[], y=[],
        mode='markers+text',
        text=list(nodes),
        hoverinfo='text'
    ))
    
    fig.update_layout(
        title=f'Entity Network for {country.upper()}',
        showlegend=False
    )
    
    return json.loads(fig.to_json())

def create_sentiment_timeline(country: str, days: int = 30) -> Dict:
    """
    Create a timeline of sentiment scores
    """
    end_date = timezone.now()
    start_date = end_date - timedelta(days=days)
    
    analytics = Analytics.objects.filter(
        country=country,
        date__range=(start_date, end_date)
    ).values('date', 'sentiment_trend')
    
    df = pd.DataFrame(analytics)
    if df.empty:
        return None
    
    # Extract mean sentiment scores
    df['sentiment_mean'] = df['sentiment_trend'].apply(lambda x: x['mean'])
    
    # Create timeline
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df['date'],
        y=df['sentiment_mean'],
        mode='lines+markers',
        name='Sentiment Score'
    ))
    
    fig.update_layout(
        title=f'Sentiment Timeline for {country.upper()}',
        xaxis_title='Date',
        yaxis_title='Sentiment Score',
        hovermode='x unified'
    )
    
    return json.loads(fig.to_json())

def create_interactive_map() -> str:
    """
    Create an interactive map with sentiment data
    """
    # Get latest analytics for each country
    countries = ProcessedData.objects.values_list('country', flat=True).distinct()
    
    # Create base map
    m = folium.Map(location=[20, 0], zoom_start=2)
    
    for country in countries:
        latest_analytics = Analytics.objects.filter(
            country=country
        ).order_by('-date').first()
        
        if latest_analytics:
            # Get country coordinates (you'll need to implement this)
            coords = get_country_coordinates(country)
            if coords:
                # Create popup content
                popup_content = f"""
                <b>{country.upper()}</b><br>
                Average Sentiment: {latest_analytics.sentiment_trend['mean']:.2f}<br>
                Article Count: {latest_analytics.sentiment_trend['count']}
                """
                
                # Add marker
                folium.Marker(
                    location=coords,
                    popup=folium.Popup(popup_content, max_width=300),
                    icon=folium.Icon(
                        color='red' if latest_analytics.sentiment_trend['mean'] < 0 else 'green',
                        icon='info-sign'
                    )
                ).add_to(m)
    
    # Add layer control
    folium.LayerControl().add_to(m)
    
    return m._repr_html_()

def get_country_coordinates(country: str) -> tuple:
    """
    Get coordinates for a country (to be implemented with a proper geocoding service)
    """
    # This is a placeholder - you should implement proper geocoding
    country_coords = {
        'us': (37.0902, -95.7129),
        'gb': (55.3781, -3.4360),
        'fr': (46.2276, 2.2137),
        'de': (51.1657, 10.4515),
        'it': (41.8719, 12.5674),
        'es': (40.4637, -3.7492),
        'pt': (39.3999, -8.2245),
        'nl': (52.1326, 5.2913),
        'be': (50.8503, 4.3517),
        'ch': (46.8182, 8.2275),
        'at': (47.5162, 14.5501),
        'se': (60.1282, 18.6435),
        'no': (60.4720, 8.4689),
        'dk': (56.2639, 9.5018),
        'fi': (61.9241, 25.7482),
        'pl': (51.9194, 19.1451),
        'cz': (49.8175, 15.4730),
        'sk': (48.6690, 19.6990),
        'hu': (47.1625, 19.5033),
        'ro': (45.9432, 24.9668),
        'bg': (42.7339, 25.4858),
        'gr': (39.0742, 21.8243),
        'tr': (38.9637, 35.2433),
        'ua': (48.3794, 31.1656),
        'ru': (61.5240, 105.3188),
        'by': (53.7098, 27.9534),
        'lt': (55.1694, 23.8813),
        'lv': (56.8796, 24.6032),
        'ee': (58.5953, 25.0136),
        'ie': (53.1424, -7.6921),
        'is': (64.9631, -19.0208),
        'mt': (35.9375, 14.3754),
        'cy': (35.1264, 33.4299),
        'lu': (49.8153, 6.1296),
        'li': (47.1660, 9.5554),
        'mc': (43.7384, 7.4246),
        'sm': (43.9424, 12.4578),
        'va': (41.9029, 12.4534),
        'ad': (42.5063, 1.5218),
        'me': (42.7087, 19.3744),
        'mk': (41.6086, 21.7453),
        'al': (41.1533, 20.1683),
        'rs': (44.0165, 21.0059),
        'hr': (45.1000, 15.2000),
        'si': (46.1512, 14.9955),
        'ba': (43.9159, 17.6791),
        'hr': (45.1000, 15.2000),
        'si': (46.1512, 14.9955),
        'ba': (43.9159, 17.6791),
        'me': (42.7087, 19.3744),
        'mk': (41.6086, 21.7453),
        'al': (41.1533, 20.1683),
        'rs': (44.0165, 21.0059),
    }
    
    return country_coords.get(country.lower()) 