# api/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('news/country/', views.country_news, name='country_news'),
    path('analytics/country/', views.country_analytics, name='country_analytics'),
    path('visualization/sentiment-heatmap/', views.sentiment_heatmap, name='sentiment_heatmap'),
    path('visualization/entity-network/', views.entity_network, name='entity_network'),
    path('visualization/sentiment-timeline/', views.sentiment_timeline, name='sentiment_timeline'),
    path('visualization/interactive-map/', views.interactive_map, name='interactive_map'),
    path('process/article/', views.process_new_article, name='process_new_article'),
]