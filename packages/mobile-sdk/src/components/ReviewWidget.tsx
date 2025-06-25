import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Review, ReviewFilter } from '../types';
import { useReviews } from '../hooks/useReviews';
import { formatDate, formatRating, truncateText } from '../utils/formatters';

interface ReviewWidgetProps {
  filter?: ReviewFilter;
  onReviewPress?: (review: Review) => void;
  style?: any;
  compact?: boolean;
  showPlatform?: boolean;
  showResponse?: boolean;
  emptyMessage?: string;
  headerComponent?: React.ReactElement;
  footerComponent?: React.ReactElement;
}

export const ReviewWidget: React.FC<ReviewWidgetProps> = ({
  filter,
  onReviewPress,
  style,
  compact = false,
  showPlatform = true,
  showResponse = true,
  emptyMessage = 'No reviews yet',
  headerComponent,
  footerComponent,
}) => {
  const {
    reviews,
    loading,
    error,
    loadMore,
    hasMore,
    refetch,
  } = useReviews(filter);

  const renderReview = ({ item }: { item: Review }) => {
    const content = compact
      ? truncateText(item.content, 100)
      : item.content;

    return (
      <TouchableOpacity
        style={styles.reviewCard}
        onPress={() => onReviewPress?.(item)}
        activeOpacity={onReviewPress ? 0.7 : 1}
      >
        <View style={styles.reviewHeader}>
          <View style={styles.reviewMeta}>
            <Text style={styles.reviewAuthor}>{item.author}</Text>
            {showPlatform && (
              <Text style={styles.reviewPlatform}>{item.platform}</Text>
            )}
          </View>
          <Text style={styles.reviewDate}>{formatDate(item.date)}</Text>
        </View>

        <View style={styles.reviewRating}>
          <Text style={styles.ratingText}>{formatRating(item.rating)}</Text>
          {item.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        {item.title && (
          <Text style={styles.reviewTitle}>{item.title}</Text>
        )}

        <Text style={styles.reviewContent}>{content}</Text>

        {showResponse && item.response && (
          <View style={styles.responseContainer}>
            <Text style={styles.responseLabel}>Business Response:</Text>
            <Text style={styles.responseText}>
              {compact ? truncateText(item.response, 80) : item.response}
            </Text>
          </View>
        )}

        {item.helpful !== undefined && item.helpful > 0 && (
          <Text style={styles.helpfulText}>
            {item.helpful} people found this helpful
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading) return footerComponent || null;

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>Failed to load reviews</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8F8F8',
    },
    reviewCard: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    reviewMeta: {
      flex: 1,
    },
    reviewAuthor: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
    },
    reviewPlatform: {
      fontSize: 12,
      color: '#666',
      marginTop: 2,
    },
    reviewDate: {
      fontSize: 14,
      color: '#999',
    },
    reviewRating: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    ratingText: {
      fontSize: 16,
      color: '#FFD60A',
    },
    verifiedBadge: {
      marginLeft: 12,
      backgroundColor: '#E8F5E8',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    verifiedText: {
      fontSize: 12,
      color: '#34C759',
      fontWeight: '500',
    },
    reviewTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
    },
    reviewContent: {
      fontSize: 15,
      color: '#666',
      lineHeight: 22,
    },
    responseContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: '#F0F0F0',
      borderRadius: 8,
    },
    responseLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
    },
    responseText: {
      fontSize: 14,
      color: '#666',
      lineHeight: 20,
    },
    helpfulText: {
      marginTop: 12,
      fontSize: 13,
      color: '#999',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 16,
      color: '#999',
      textAlign: 'center',
    },
    loadingContainer: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    errorContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorText: {
      fontSize: 16,
      color: '#FF3B30',
      marginBottom: 16,
    },
    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 24,
      backgroundColor: '#007AFF',
      borderRadius: 20,
    },
    retryText: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '500',
    },
  });

  return (
    <FlatList
      style={[styles.container, style]}
      data={reviews}
      renderItem={renderReview}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={headerComponent}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      refreshing={loading && reviews.length === 0}
      onRefresh={handleRefresh}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      contentContainerStyle={reviews.length === 0 ? { flex: 1 } : undefined}
    />
  );
};