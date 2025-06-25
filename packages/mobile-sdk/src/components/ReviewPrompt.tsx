import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Rate, { AndroidMarket } from 'react-native-rate';
import { ReviewPromptConfig } from '../types';
import { ReviewInsightsSDK } from '../ReviewInsightsSDK';

interface ReviewPromptProps extends ReviewPromptConfig {
  visible: boolean;
  onClose: () => void;
  onReviewSubmitted?: (rating: number) => void;
  appStoreId?: string; // iOS App Store ID
  playStoreId?: string; // Android Play Store ID
}

export const ReviewPrompt: React.FC<ReviewPromptProps> = ({
  visible,
  onClose,
  onReviewSubmitted,
  title = 'Enjoying our app?',
  message = 'Would you mind taking a moment to rate us?',
  positiveThreshold = 4,
  appStoreId,
  playStoreId,
  customUI,
}) => {
  const [rating, setRating] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(300))[0];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleStarPress = (selectedRating: number) => {
    setRating(selectedRating);
    
    if (selectedRating >= positiveThreshold) {
      // High rating - redirect to app store
      redirectToStore();
    } else {
      // Low rating - show feedback form
      setShowFeedback(true);
    }

    // Track event
    ReviewInsightsSDK.getInstance().trackEvent('review_prompt_rated', {
      rating: selectedRating,
    });
  };

  const redirectToStore = async () => {
    const options = {
      AppleAppID: appStoreId,
      GooglePackageName: playStoreId,
      AmazonPackageName: playStoreId,
      preferredAndroidMarket: AndroidMarket.Google,
      preferInApp: true,
      openAppStoreIfInAppFails: true,
      fallbackPlatformURL: 'https://reviewinsights.ai',
    };

    try {
      const success = await Rate.rate(options);
      if (success) {
        await savePromptShown();
        onReviewSubmitted?.(rating);
        ReviewInsightsSDK.getInstance().trackEvent('review_prompt_store_redirect', {
          rating,
          platform: Platform.OS,
        });
      }
    } catch (error) {
      console.error('Error redirecting to store:', error);
    }

    onClose();
  };

  const handleFeedbackSubmit = async () => {
    try {
      // Submit feedback as an in-app review
      await ReviewInsightsSDK.getInstance().submitReview({
        rating,
        content: feedback,
        platform: 'in-app',
        metadata: {
          source: 'review_prompt',
          feedbackType: 'low_rating',
        },
      });

      await savePromptShown();
      onReviewSubmitted?.(rating);
      
      ReviewInsightsSDK.getInstance().trackEvent('review_prompt_feedback_submitted', {
        rating,
        feedbackLength: feedback.length,
      });

      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const savePromptShown = async () => {
    try {
      await AsyncStorage.setItem('@ReviewPrompt:lastShown', new Date().toISOString());
      await AsyncStorage.setItem('@ReviewPrompt:hasRated', 'true');
    } catch (error) {
      console.error('Error saving prompt state:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    content: {
      backgroundColor: customUI?.backgroundColor || '#FFFFFF',
      borderRadius: customUI?.borderRadius || 16,
      padding: 24,
      width: '85%',
      maxWidth: 350,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: customUI?.textColor || '#333333',
      textAlign: 'center',
      marginBottom: 8,
      fontFamily: customUI?.fontFamily,
    },
    message: {
      fontSize: 16,
      color: customUI?.textColor || '#666666',
      textAlign: 'center',
      marginBottom: 24,
      fontFamily: customUI?.fontFamily,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 24,
    },
    star: {
      fontSize: 36,
      marginHorizontal: 4,
    },
    feedbackInput: {
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 8,
      padding: 12,
      minHeight: 100,
      marginBottom: 16,
      fontSize: 16,
      color: customUI?.textColor || '#333333',
      textAlignVertical: 'top',
      fontFamily: customUI?.fontFamily,
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      marginHorizontal: 6,
    },
    primaryButton: {
      backgroundColor: customUI?.primaryColor || '#007AFF',
    },
    secondaryButton: {
      backgroundColor: '#F0F0F0',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: customUI?.fontFamily,
    },
    primaryButtonText: {
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      color: customUI?.textColor || '#333333',
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      padding: 8,
    },
    closeButtonText: {
      fontSize: 24,
      color: customUI?.textColor || '#999999',
    },
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
              >
                <Text style={styles.star}>
                  {star <= rating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {showFeedback && (
            <>
              <TextInput
                style={styles.feedbackInput}
                placeholder="We'd love to hear your feedback..."
                value={feedback}
                onChangeText={setFeedback}
                multiline
                placeholderTextColor="#999999"
              />

              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={onClose}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleFeedbackSubmit}
                  disabled={!feedback.trim()}
                >
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>
                    Submit
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Utility hook to manage review prompt timing
export const useReviewPrompt = (config?: {
  showAfterActions?: number;
  cooldownDays?: number;
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    checkPromptEligibility();
    loadActionCount();
  }, []);

  const checkPromptEligibility = async () => {
    try {
      const hasRated = await AsyncStorage.getItem('@ReviewPrompt:hasRated');
      if (hasRated === 'true') {
        setShouldShow(false);
        return;
      }

      const lastShown = await AsyncStorage.getItem('@ReviewPrompt:lastShown');
      if (lastShown) {
        const daysSinceLastShown = 
          (Date.now() - new Date(lastShown).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastShown < (config?.cooldownDays || 7)) {
          setShouldShow(false);
          return;
        }
      }

      setShouldShow(true);
    } catch (error) {
      console.error('Error checking prompt eligibility:', error);
    }
  };

  const loadActionCount = async () => {
    try {
      const count = await AsyncStorage.getItem('@ReviewPrompt:actionCount');
      setActionCount(count ? parseInt(count, 10) : 0);
    } catch (error) {
      console.error('Error loading action count:', error);
    }
  };

  const incrementActionCount = async () => {
    const newCount = actionCount + 1;
    setActionCount(newCount);
    
    try {
      await AsyncStorage.setItem('@ReviewPrompt:actionCount', newCount.toString());
    } catch (error) {
      console.error('Error saving action count:', error);
    }

    return newCount >= (config?.showAfterActions || 5);
  };

  const resetActionCount = async () => {
    setActionCount(0);
    try {
      await AsyncStorage.removeItem('@ReviewPrompt:actionCount');
    } catch (error) {
      console.error('Error resetting action count:', error);
    }
  };

  return {
    shouldShow,
    actionCount,
    incrementActionCount,
    resetActionCount,
  };
};

// Missing import
import { TextInput } from 'react-native';