import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Spinner,
  useColorModeValue,
  SimpleGrid,
  Badge,
} from '@chakra-ui/react';
import Plot from 'react-plotly.js';
import axios from 'axios';

const SentimentAnalysis = ({ country }) => {
  const [loading, setLoading] = useState(true);
  const [sentimentData, setSentimentData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [error, setError] = useState(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch sentiment analytics
        const analyticsResponse = await axios.get(
          `http://localhost:8000/api/analytics/country/?country=${country}`
        );
        setSentimentData(analyticsResponse.data);

        // Fetch heatmap data
        const heatmapResponse = await axios.get(
          `http://localhost:8000/api/visualization/sentiment-heatmap/?country=${country}`
        );
        setHeatmapData(heatmapResponse.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (country) {
      fetchData();
    }
  }, [country]);

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="red.500">Error: {error}</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch" p={4}>
      <Heading size="lg">Sentiment Analysis for {country.toUpperCase()}</Heading>

      {/* Sentiment Overview */}
      <Box
        p={4}
        bg={bgColor}
        borderRadius="md"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Heading size="md" mb={4}>Overall Sentiment</Heading>
        <SimpleGrid columns={2} spacing={4}>
          <Box>
            <Text>Average Sentiment</Text>
            <Badge
              colorScheme={sentimentData?.sentiment_trend[0]?.mean > 0 ? 'green' : 'red'}
              fontSize="lg"
            >
              {sentimentData?.sentiment_trend[0]?.mean.toFixed(2)}
            </Badge>
          </Box>
          <Box>
            <Text>Article Count</Text>
            <Badge fontSize="lg">
              {sentimentData?.sentiment_trend[0]?.count}
            </Badge>
          </Box>
        </SimpleGrid>
      </Box>

      {/* Sentiment Heatmap */}
      {heatmapData && (
        <Box
          p={4}
          bg={bgColor}
          borderRadius="md"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Heading size="md" mb={4}>Sentiment Heatmap</Heading>
          <Plot
            data={heatmapData.data}
            layout={{
              ...heatmapData.layout,
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
            }}
            style={{ width: '100%', height: '400px' }}
          />
        </Box>
      )}

      {/* Entity Network */}
      {sentimentData?.entity_frequency && (
        <Box
          p={4}
          bg={bgColor}
          borderRadius="md"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <Heading size="md" mb={4}>Top Entities</Heading>
          <SimpleGrid columns={3} spacing={4}>
            {Object.entries(sentimentData.entity_frequency)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([entity, count]) => (
                <Box key={entity}>
                  <Text fontWeight="bold">{entity.split('_')[0]}</Text>
                  <Badge>{count} mentions</Badge>
                </Box>
              ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
};

export default SentimentAnalysis; 