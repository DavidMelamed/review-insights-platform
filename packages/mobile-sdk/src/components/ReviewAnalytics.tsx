import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useReviewAnalytics } from '../hooks/useReviewAnalytics';
import { formatRating } from '../utils/formatters';

interface ReviewAnalyticsProps {
  style?: any;
  refreshInterval?: number;
  showTrends?: boolean;
  showKeywords?: boolean;
  showDistribution?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const ReviewAnalytics: React.FC<ReviewAnalyticsProps> = ({
  style,
  refreshInterval,
  showTrends = true,
  showKeywords = true,
  showDistribution = true,
}) => {
  const { analytics, loading, error } = useReviewAnalytics({
    autoFetch: true,
    refreshInterval,
  });

  if (loading && !analytics) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <Text style={styles.errorText}>Failed to load analytics</Text>
      </View>
    );
  }

  if (!analytics) {
    return null;
  }

  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.overviewGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{analytics.totalReviews}</Text>
          <Text style={styles.metricLabel}>Total Reviews</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatRating(analytics.averageRating)}</Text>
          <Text style={styles.metricLabel}>Average Rating</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{(analytics.responseRate * 100).toFixed(0)}%</Text>
          <Text style={styles.metricLabel}>Response Rate</Text>
        </View>
      </View>
    </View>
  );

  const renderSentiment = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sentiment Analysis</Text>
      <View style={styles.sentimentContainer}>
        <View style={styles.sentimentBar}>
          <View
            style={[
              styles.sentimentSegment,
              styles.positiveSegment,
              { flex: analytics.sentiment.positive },
            ]}
          />
          <View
            style={[
              styles.sentimentSegment,
              styles.neutralSegment,
              { flex: analytics.sentiment.neutral },
            ]}
          />
          <View
            style={[
              styles.sentimentSegment,
              styles.negativeSegment,
              { flex: analytics.sentiment.negative },
            ]}
          />
        </View>
        <View style={styles.sentimentLabels}>
          <Text style={styles.sentimentLabel}>
            Positive: {(analytics.sentiment.positive * 100).toFixed(0)}%
          </Text>
          <Text style={styles.sentimentLabel}>
            Neutral: {(analytics.sentiment.neutral * 100).toFixed(0)}%
          </Text>
          <Text style={styles.sentimentLabel}>
            Negative: {(analytics.sentiment.negative * 100).toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDistribution = () => {
    if (!showDistribution) return null;

    const maxCount = Math.max(...Object.values(analytics.ratingDistribution));

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rating Distribution</Text>
        <View style={styles.distributionContainer}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = analytics.ratingDistribution[rating] || 0;
            const percentage = analytics.totalReviews > 0
              ? (count / analytics.totalReviews) * 100
              : 0;

            return (
              <View key={rating} style={styles.distributionRow}>
                <Text style={styles.distributionRating}>{rating}★</Text>
                <View style={styles.distributionBarContainer}>
                  <View
                    style={[
                      styles.distributionBar,
                      {
                        width: `${(count / maxCount) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.distributionCount}>
                  {count} ({percentage.toFixed(0)}%)
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderKeywords = () => {
    if (!showKeywords || !analytics.topKeywords.length) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Keywords</Text>
        <View style={styles.keywordsContainer}>
          {analytics.topKeywords.slice(0, 10).map((keyword, index) => (
            <View key={index} style={styles.keywordChip}>
              <Text style={styles.keywordText}>{keyword.word}</Text>
              <Text style={styles.keywordCount}>{keyword.count}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#FFFFFF',
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: '#666',
    },
    errorText: {
      fontSize: 16,
      color: '#FF3B30',
    },
    section: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E0E0E0',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 16,
    },
    overviewGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    metricCard: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#F8F8F8',
      borderRadius: 8,
      marginHorizontal: 4,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: '700',
      color: '#007AFF',
      marginBottom: 4,
    },
    metricLabel: {
      fontSize: 14,
      color: '#666',
    },
    sentimentContainer: {
      marginBottom: 12,
    },
    sentimentBar: {
      flexDirection: 'row',
      height: 24,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
    },
    sentimentSegment: {
      height: '100%',
    },
    positiveSegment: {
      backgroundColor: '#34C759',
    },
    neutralSegment: {
      backgroundColor: '#FFD60A',
    },
    negativeSegment: {
      backgroundColor: '#FF3B30',
    },
    sentimentLabels: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    sentimentLabel: {
      fontSize: 14,
      color: '#666',
    },
    distributionContainer: {
      marginTop: 8,
    },
    distributionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    distributionRating: {
      width: 30,
      fontSize: 16,
      color: '#333',
    },
    distributionBarContainer: {
      flex: 1,
      height: 20,
      backgroundColor: '#F0F0F0',
      borderRadius: 10,
      marginHorizontal: 12,
      overflow: 'hidden',
    },
    distributionBar: {
      height: '100%',
      backgroundColor: '#007AFF',
      borderRadius: 10,
    },
    distributionCount: {
      width: 80,
      fontSize: 14,
      color: '#666',
      textAlign: 'right',
    },
    keywordsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    keywordChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F0F0F0',
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      margin: 4,
    },
    keywordText: {
      fontSize: 14,
      color: '#333',
      marginRight: 6,
    },
    keywordCount: {
      fontSize: 12,
      color: '#666',
      backgroundColor: '#E0E0E0',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
  });

  return (
    <ScrollView style={[styles.container, style]}>
      {renderOverview()}
      {renderSentiment()}
      {renderDistribution()}
      {renderKeywords()}
    </ScrollView>
  );
};