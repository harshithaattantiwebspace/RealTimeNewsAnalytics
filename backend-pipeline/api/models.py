from django.db import models
from django.contrib.postgres.fields import JSONField  # For Django 3.1 use models.JSONField
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point


class RawData(models.Model):
    title = models.TextField()
    description = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=50)
    country = models.CharField(max_length=50)
    published_date = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=100, null=True, blank=True)
    link = models.URLField(null=True, blank=True, unique=True, max_length=2000)  
    created_at = models.DateTimeField(auto_now_add=True)
    raw_response = models.JSONField(null=True, blank=True)

    def __str__(self):
        return self.title

# Model definition with proper indexing
class ProcessedData(models.Model):
    title = models.TextField()
    description = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=50)
    country = models.CharField(max_length=50, db_index=True)  # Indexed for fast filtering
    sentiment_score = models.FloatField(null=True, blank=True)
    published_date = models.DateTimeField(null=True, blank=True, db_index=True)
    source = models.CharField(max_length=100, null=True, blank=True)
    link = models.URLField(null=True, blank=True, unique=True, max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    raw_response = models.JSONField(null=True, blank=True)  # Store raw API response if needed
    
    # New fields for enhanced analytics
    location = gis_models.PointField(null=True, blank=True, geography=True)
    entities = models.JSONField(null=True, blank=True)  # Store named entities
    topics = models.JSONField(null=True, blank=True)    # Store topic modeling results
    llm_summary = models.TextField(null=True, blank=True)  # Store LLM-generated summary
    llm_insights = models.JSONField(null=True, blank=True)  # Store LLM-generated insights
    sentiment_details = models.JSONField(null=True, blank=True)  # Detailed sentiment analysis
    engagement_metrics = models.JSONField(null=True, blank=True)  # Social media engagement metrics
    
    class Meta:
        indexes = [
            models.Index(fields=['country', 'category']),  # For common filtering
            models.Index(fields=['country', 'published_date']),  # For timeline queries
            models.Index(fields=['sentiment_score']),
            models.Index(fields=['published_date']),
        ]

    def __str__(self):
        return f"{self.title} ({self.country})"



class Meta:
    indexes = [
        models.Index(fields=['category']),
        models.Index(fields=['country']),
        models.Index(fields=['published_date']),
    ]


class SampleModel(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Analytics(models.Model):
    """Model for storing aggregated analytics data"""
    country = models.CharField(max_length=50, db_index=True)
    date = models.DateField(db_index=True)
    sentiment_trend = models.JSONField()  # Store sentiment trends over time
    topic_distribution = models.JSONField()  # Store topic distribution
    entity_frequency = models.JSONField()  # Store entity frequency
    engagement_metrics = models.JSONField()  # Store engagement metrics
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['country', 'date']),
        ]
        unique_together = ['country', 'date']

    def __str__(self):
        return f"Analytics for {self.country} on {self.date}"
