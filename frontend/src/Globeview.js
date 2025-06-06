import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import * as topojson from "topojson-client";
import { motion } from "framer-motion";
import { 
  Box, ChakraProvider, SimpleGrid, Heading, Text, Badge, 
  LinkBox, LinkOverlay, HStack, Spacer, Spinner, 
  useColorMode, useColorModeValue, IconButton, VStack
} from "@chakra-ui/react";
import { SunIcon, MoonIcon } from "@chakra-ui/icons";
import axios from "axios";
import "./GlobeView.css";
import Plot from 'react-plotly.js';

// Memoized NewsCard component for better performance
const NewsCard = React.memo(({ title, source, date, link, sentiment_score, llm_summary, isLoading }) => {
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  
  // Get sentiment color and label
  const getSentimentInfo = (score) => {
    if (score === null || score === undefined) return { color: "gray", label: "Neutral" };
    if (score > 0.3) return { color: "green", label: "Positive" };
    if (score < -0.3) return { color: "red", label: "Negative" };
    return { color: "yellow", label: "Neutral" };
  };

  const sentimentInfo = getSentimentInfo(sentiment_score);
  
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <LinkBox
        as="article"
        p={4}
        borderWidth="1px"
        borderColor={cardBorder}
        rounded="md"
        bg={cardBg}
        h="100%"
        display="flex"
        flexDirection="column"
        boxShadow="sm"
        _hover={{ boxShadow: "md" }}
      >
        <LinkOverlay href={link} isExternal>
          <Heading size="md" my={2} noOfLines={2}>
            {title}
          </Heading>
        </LinkOverlay>
        
        {llm_summary && (
          <Text fontSize="sm" color="gray.600" mb={3} noOfLines={2}>
            {llm_summary}
          </Text>
        )}
        
        <Spacer />
        <HStack justify="space-between" mt={2}>
          <HStack spacing={2}>
          <Badge colorScheme="blue">{source}</Badge>
            <Badge colorScheme={sentimentInfo.color}>
              {sentimentInfo.label}
              {sentiment_score !== null && ` (${sentiment_score.toFixed(2)})`}
            </Badge>
          </HStack>
          <Text fontSize="sm" color="gray.500">
            {new Date(date).toLocaleDateString()}
          </Text>
        </HStack>
      </LinkBox>
    </motion.div>
  );
});

// Main GlobeView component
function GlobeView() {
  const globeEl = useRef();
  const [countries, setCountries] = useState([]);
  const [hoverD, setHoverD] = useState();
  const [activeCountry, setActiveCountry] = useState();
  const [countryNews, setCountryNews] = useState([]);
  const [countryAnalytics, setCountryAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [globeReady, setGlobeReady] = useState(false);
  const { colorMode, toggleColorMode } = useColorMode();

  // Move useColorModeValue hooks to the top level
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const boxBg = useColorModeValue("white", "gray.800");
  const globeImageUrl = colorMode === 'light' 
    ? "//unpkg.com/three-globe/example/img/earth-day.jpg"
    : "//unpkg.com/three-globe/example/img/earth-day.jpg";
  const backgroundImageUrl = colorMode === 'light'
    ? "//unpkg.com/three-globe/example/img/night-sky.png"
    : null;
  const atmosphereColor = colorMode === 'dark' ? "#3a228a" : "#0077ff";
  const polygonSideColor = colorMode === 'dark' ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.2)";
  const polygonStrokeColor = colorMode === 'dark' ? "#AAA" : "#222";

  // Calculate country centroid - improved version with better handling
  const getCountryCentroid = useCallback((country) => {
    if (!country || !country.geometry) return { lat: 0, lng: 0 };
    
    try {
      // Handle different geometry types
      const coordinates = (() => {
        if (country.geometry.type === 'MultiPolygon') {
          // Find the largest polygon in a MultiPolygon
          return country.geometry.coordinates.reduce(
            (largest, current) => (current[0].length > largest[0].length ? current : largest),
            [[[0, 0]]]
          )[0];
        } else if (country.geometry.type === 'Polygon') {
          return country.geometry.coordinates[0];
        } else {
          // Fallback for other geometry types
          return [[0, 0]];
        }
      })();
      
      // Calculate bounds
      if (!coordinates || coordinates.length === 0) return { lat: 0, lng: 0 };
      
      const countryBounds = coordinates.reduce(
        (acc, coord) => ({
          minLng: Math.min(acc.minLng, coord[0]),
          maxLng: Math.max(acc.maxLng, coord[0]),
          minLat: Math.min(acc.minLat, coord[1]),
          maxLat: Math.max(acc.maxLat, coord[1]),
        }),
        { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 }
      );
      
      // Calculate center
      return {
        lat: (countryBounds.minLat + countryBounds.maxLat) / 2,
        lng: (countryBounds.minLng + countryBounds.maxLng) / 2,
        width: Math.abs(countryBounds.maxLng - countryBounds.minLng),
        height: Math.abs(countryBounds.maxLat - countryBounds.minLat),
      };
    } catch (error) {
      console.error("Error calculating centroid:", error);
      return { lat: 0, lng: 0, width: 10, height: 10 };
    }
  }, []);

  // Get country color based on hover state with enhanced colors
  const getCountryColor = useCallback((feat) => {
    const isHovered = feat === hoverD;
    const isSelected = activeCountry && feat.id === activeCountry.id;
    
    if (isSelected) return colorMode === 'dark' ? "#2B6CB0" : "#3182CE"; // blue - stronger
    if (isHovered) return colorMode === 'dark' ? "#ED8936" : "#DD6B20"; // orange - more vibrant
    return colorMode === 'dark' ? "#2D3748" : "#E2E8F0"; // default - better contrast
  }, [hoverD, activeCountry, colorMode]);

  // Optimize hover handler with debounce
  const handleHover = useMemo(() => {
    return debounce(setHoverD, 60); // 60ms debounce for smoother performance
  }, []);

  // Helper function for debouncing
  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // Create tooltip content
  const createTooltipContent = useCallback((feat) => {
    const name = feat?.properties?.NAME || feat?.properties?.name || '';
    return `<div class="globe-tooltip">
              <b>${name}</b>
              <br/>Click to see news
            </div>`;
  }, []);

  // Fetch world data once on mount
  useEffect(() => {
    fetch("/countries-110m.json")
      .then(res => res.json())
      .then(topology => {
        const geojson = topojson.feature(
          topology,
          topology.objects.countries
        ).features;
        setCountries(geojson);
      });
  }, []);

  // Configure auto-rotation when globe is ready with improved speed
  useEffect(() => {
    if (globeReady && globeEl.current) {
      const controls = globeEl.current.controls();
      controls.autoRotate = !activeCountry;
      controls.autoRotateSpeed = 0.8; // Faster rotation
      controls.enableDamping = true; // Add smooth damping
      controls.dampingFactor = 0.2; // More responsive feel
      
      if (activeCountry && globeEl.current.pointOfView) {
        try {
          // Get country details including size
          const countryInfo = getCountryCentroid(activeCountry);
          
          // Country-specific adjustments
          const countryAdjustments = {
            // Special cases for specific countries by ID
            356: { lat: 20.5, lng: 78.9, altitude: 2.5 }, // India
            643: { altitude: 2.8 }, // Russia
            156: { altitude: 2.8 }, // China
            124: { altitude: 2.0 }, // Canada
            76: { altitude: 2.0 },  // Brazil
            36: { altitude: 2.0 },  // Australia
          };

          // Get country ID
          const countryId = activeCountry.id || activeCountry.properties.id;
          
          // Apply country-specific overrides or calculate based on size
          let altitude = 2.0; // Default altitude
          let lat = countryInfo.lat;
          let lng = countryInfo.lng;
          
          // Calculate altitude based on country size (larger countries need higher altitude)
          const size = Math.max(countryInfo.width, countryInfo.height);
          if (size > 50) {
            altitude = 3.0; // Very large countries
          } else if (size > 20) {
            altitude = 2.5; // Large countries
          } else if (size > 10) {
            altitude = 2.0; // Medium countries
          } else {
            altitude = 1.5; // Small countries
          }
          
          // Apply country-specific overrides if they exist
          if (countryAdjustments[countryId]) {
            if (countryAdjustments[countryId].lat) lat = countryAdjustments[countryId].lat;
            if (countryAdjustments[countryId].lng) lng = countryAdjustments[countryId].lng;
            if (countryAdjustments[countryId].altitude) altitude = countryAdjustments[countryId].altitude;
          }
          
          console.log(`Focusing on country ${countryId} at position:`, { lat, lng, altitude });
          
          // Apply camera position with smooth transition
          globeEl.current.pointOfView(
            { lat, lng, altitude },
            1000
          );
        } catch (error) {
          console.error("Error positioning globe:", error);
          // Fallback to default view
          globeEl.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
        }
      }
    }
  }, [globeReady, activeCountry, getCountryCentroid]);

  // Handler for country click
  const handleCountryClick = useCallback((country) => {
    setActiveCountry(country);
  }, []);

  // Fetch news when a country is selected
  useEffect(() => {
    if (activeCountry) {
      fetchCountryData(activeCountry.id || activeCountry.properties.id);
    }
  }, [activeCountry]);

  // Update the fetchCountryData function
  const fetchCountryData = async (country) => {
      setLoading(true);
    setError(null);
    try {
      const [newsResponse, analyticsResponse] = await Promise.all([
        axios.get(`/api/news/country/${country}/`),
        axios.get(`/api/analytics/country/`, { params: { country } })
      ]);

      setCountryNews(newsResponse.data);
      
      // Ensure data structure matches backend
      if (analyticsResponse.data) {
        const formattedData = {
          sentiment_trend: analyticsResponse.data.sentiment_trend || [],
          entity_frequency: analyticsResponse.data.entity_frequency || {},
          topic_distribution: analyticsResponse.data.topic_distribution || {},
          llm_insights: analyticsResponse.data.llm_insights || []
        };
        setCountryAnalytics(formattedData);
      }
    } catch (err) {
      console.error('Error fetching country data:', err);
      setError('Failed to load country data. Please try again.');
    } finally {
        setLoading(false);
      }
  };

  // Preload textures for better performance
  useEffect(() => {
    const preloadImages = [
      "//unpkg.com/three-globe/example/img/earth-day.jpg",
      "//unpkg.com/three-globe/example/img/earth-topology.png",
      "//unpkg.com/three-globe/example/img/night-sky.png"
    ];
    
    preloadImages.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);
  
  // Globe configuration props with improved performance and visuals
  const globeProps = useMemo(() => ({
    globeImageUrl,
    bumpImageUrl: "//unpkg.com/three-globe/example/img/earth-topology.png",
    backgroundImageUrl,
    showAtmosphere: true,
    atmosphereColor,
    atmosphereAltitude: 0.15, // Thinner atmosphere for better appearance
    polygonsData: countries,
    polygonCapColor: getCountryColor,
    polygonSideColor: () => polygonSideColor,
    polygonStrokeColor: () => polygonStrokeColor,
    polygonLabel: createTooltipContent,
    polygonAltitude: feat => feat === hoverD ? 0.08 : 0.01, // More pronounced elevation
    onPolygonHover: handleHover, // Use debounced hover handler
    onPolygonClick: handleCountryClick,
    onGlobeReady: () => {
      setGlobeReady(true);
      // Add initial rotation animation
      if (globeEl.current) {
        const controls = globeEl.current.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;
        setTimeout(() => {
          controls.autoRotateSpeed = 0.8;
        }, 1000);
      }
    },
    animateIn: true, // Enable animation on load
    width: window.innerWidth,
    height: window.innerHeight,
    globeResolution: 96, // Lower resolution for better performance
  }), [
    countries, 
    getCountryColor, 
    createTooltipContent, 
    handleCountryClick, 
    handleHover,
    hoverD,
    globeImageUrl,
    backgroundImageUrl,
    atmosphereColor,
    polygonSideColor,
    polygonStrokeColor
  ]);
  
  // Animation variants with improved transitions
  const infoBoxVariants = {
    hidden: { opacity: 0, x: 100, transition: { duration: 0.3 } },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 20, 
        duration: 0.4 
      }
    }
  };

  return (
    <ChakraProvider>
      <Box 
        className="globe-container" 
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg={bgColor}
      >
        {/* Globe Container */}
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          zIndex="0"
        >
          <Globe
            ref={globeEl}
            {...globeProps}
          />
        </Box>

        {/* UI Layer */}
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          pointerEvents="none"
          zIndex="1"
        >
          {/* Color Mode Toggle */}
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <SunIcon /> : <MoonIcon />}
            onClick={toggleColorMode}
            position="absolute"
            top="20px"
            right="20px"
            pointerEvents="auto"
            colorScheme={colorMode === 'light' ? "orange" : "blue"}
            borderRadius="full"
          />

          {/* Country Info & News Panel */}
          {activeCountry?.properties && (
            <Box
              position="absolute"
              top="80px"
              right="20px"
              width={["90%", "400px"]}
              pointerEvents="auto"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={infoBoxVariants}
              >
                <Box
                  bg={boxBg}
                  p={5}
                  borderRadius="md"
                  boxShadow="lg"
                  maxHeight="calc(100vh - 120px)"
                  overflowY="auto"
                >
                  <HStack justify="space-between" mb={4}>
                    <Heading size="lg">
                      {activeCountry.properties.NAME || activeCountry.properties.name}
                    </Heading>
                    <IconButton
                      size="sm"
                      icon={<span>✕</span>}
                      onClick={() => setActiveCountry(null)}
                      variant="ghost"
                    />
                  </HStack>
                  
                  {/* Error Display */}
                  {error && (
                    <Box mb={6} p={4} bg="red.50" color="red.500" borderRadius="md">
                      <Text>{error}</Text>
                    </Box>
                  )}

                  {/* Sentiment Analytics Panel */}
                  {loading ? (
                    <Box mb={6} p={4} bg={useColorModeValue("gray.50", "gray.700")} borderRadius="md">
                      <HStack justify="center" spacing={4}>
                        <Spinner size="sm" />
                        <Text>Loading analytics...</Text>
                      </HStack>
                    </Box>
                  ) : countryAnalytics ? (
                    <Box mb={6} p={4} bg={useColorModeValue("gray.50", "gray.700")} borderRadius="md">
                      <Heading size="md" mb={4}>Sentiment Analysis</Heading>
                      
                      {/* Sentiment Summary */}
                      <SimpleGrid columns={2} spacing={4}>
                        <Box>
                          <Text fontSize="sm" color="gray.500">Average Sentiment</Text>
                          <Badge
                            colorScheme={countryAnalytics.sentiment_trend[0]?.mean > 0 ? "green" : "red"}
                            fontSize="lg"
                            p={2}
                          >
                            {countryAnalytics.sentiment_trend[0]?.mean?.toFixed(2) || 'N/A'}
                          </Badge>
                        </Box>
                    <Box>
                          <Text fontSize="sm" color="gray.500">Article Count</Text>
                          <Badge fontSize="lg" p={2}>
                            {countryAnalytics.sentiment_trend[0]?.count || 0}
                          </Badge>
                        </Box>
                      </SimpleGrid>

                      {/* Sentiment Trend Chart */}
                      {countryAnalytics.sentiment_trend?.length > 0 && (
                        <Box mt={4}>
                          <Text fontSize="sm" color="gray.500" mb={2}>Sentiment Trend</Text>
                          <Plot
                            data={[
                              {
                                x: countryAnalytics.sentiment_trend.map(item => item.date),
                                y: countryAnalytics.sentiment_trend.map(item => item.mean),
                                type: 'scatter',
                                mode: 'lines+markers',
                                name: 'Sentiment',
                                line: { color: '#3182CE' },
                                marker: { size: 8 }
                              }
                            ]}
                            layout={{
                              height: 200,
                              margin: { t: 10, r: 10, b: 30, l: 40 },
                              paper_bgcolor: 'rgba(0,0,0,0)',
                              plot_bgcolor: 'rgba(0,0,0,0)',
                              font: { color: useColorModeValue('#2D3748', '#E2E8F0') },
                              xaxis: {
                                showgrid: false,
                                tickangle: -45,
                                tickfont: { size: 10 }
                              },
                              yaxis: {
                                showgrid: true,
                                gridcolor: useColorModeValue('#E2E8F0', '#4A5568'),
                                zeroline: false,
                                range: [-1, 1]
                              }
                            }}
                            config={{ displayModeBar: false }}
                          />
                        </Box>
                      )}

                      {/* Topic Distribution */}
                      {countryAnalytics.topic_distribution && Object.keys(countryAnalytics.topic_distribution).length > 0 && (
                        <Box mt={4}>
                          <Text fontSize="sm" color="gray.500" mb={2}>Topic Distribution</Text>
                          <SimpleGrid columns={2} spacing={2}>
                            {Object.entries(countryAnalytics.topic_distribution)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 4)
                              .map(([topic, weight]) => (
                                <Box 
                                  key={topic} 
                                  p={2} 
                                  bg={useColorModeValue("white", "gray.600")} 
                                  borderRadius="md"
                                  boxShadow="sm"
                                >
                                  <HStack justify="space-between">
                                    <Text fontSize="sm" fontWeight="medium">
                                      {topic}
                                    </Text>
                                    <Badge colorScheme="purple">
                                      {(weight * 100).toFixed(1)}%
                                    </Badge>
                                  </HStack>
                                </Box>
                              ))}
                          </SimpleGrid>
                        </Box>
                      )}

                      {/* Enhanced Entity Display */}
                      {countryAnalytics.entity_frequency && Object.keys(countryAnalytics.entity_frequency).length > 0 && (
                        <Box mt={4}>
                          <Text fontSize="sm" color="gray.500" mb={2}>Top Entities</Text>
                          <SimpleGrid columns={2} spacing={2}>
                            {Object.entries(countryAnalytics.entity_frequency)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 6)
                              .map(([entity, count]) => (
                                <Box 
                                  key={entity} 
                                  p={2} 
                                  bg={useColorModeValue("white", "gray.600")} 
                                  borderRadius="md"
                                  boxShadow="sm"
                                >
                                  <HStack justify="space-between">
                                    <VStack align="start" spacing={0}>
                                      <Text fontSize="sm" fontWeight="medium">
                                        {entity.split('_')[0]}
                                      </Text>
                                      <Text fontSize="xs" color="gray.500">
                                        {entity.split('_')[1] || 'Unknown'}
                                      </Text>
                                    </VStack>
                                    <Badge colorScheme="blue">{count}</Badge>
                                  </HStack>
                                </Box>
                        ))}
                      </SimpleGrid>
                        </Box>
                      )}

                      {/* LLM Insights */}
                      {countryAnalytics.llm_insights && countryAnalytics.llm_insights.length > 0 && (
                        <Box mt={4}>
                          <Text fontSize="sm" color="gray.500" mb={2}>Key Insights</Text>
                          <VStack spacing={2} align="stretch">
                            {countryAnalytics.llm_insights.map((insight, index) => (
                              <Box 
                                key={index}
                                p={2}
                                bg={useColorModeValue("white", "gray.600")}
                                borderRadius="md"
                                boxShadow="sm"
                              >
                                <Text fontSize="sm">{insight}</Text>
                              </Box>
                            ))}
                          </VStack>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box mb={6} p={4} bg={useColorModeValue("gray.50", "gray.700")} borderRadius="md">
                      <Text textAlign="center" color="gray.500">
                        No analytics available for this country.
                      </Text>
                    </Box>
                  )}

                  {/* News Cards */}
                  <SimpleGrid columns={1} spacing={4}>
                    {countryNews.map((article, index) => (
                      <NewsCard
                        key={index}
                        title={article.title}
                        source={article.source}
                        date={article.published_date}
                        link={article.link}
                        sentiment_score={article.sentiment_score}
                        llm_summary={article.llm_summary}
                        isLoading={loading}
                      />
                    ))}
                  </SimpleGrid>
                </Box>
              </motion.div>
            </Box>
          )}
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default React.memo(GlobeView);
