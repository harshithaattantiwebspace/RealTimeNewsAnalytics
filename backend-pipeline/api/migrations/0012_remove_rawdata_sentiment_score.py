# Generated by Django 5.1.7 on 2025-05-04 22:20

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_alter_processeddata_link'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='rawdata',
            name='sentiment_score',
        ),
    ]
