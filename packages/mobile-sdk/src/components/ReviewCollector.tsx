import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { ReviewCollectionOptions, CustomField, Review } from '../types';
import { ReviewInsightsSDK } from '../ReviewInsightsSDK';

interface ReviewCollectorProps {
  options?: ReviewCollectionOptions;
  onSubmit?: (review: Review) => void;
  onCancel?: () => void;
  style?: any;
}

export const ReviewCollector: React.FC<ReviewCollectorProps> = ({
  options = {},
  onSubmit,
  onCancel,
  style,
}) => {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [media, setMedia] = useState<Array<{ uri: string; type: string }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scrollViewRef = useRef<ScrollView>(null);

  const handleRatingPress = (selectedRating: number) => {
    setRating(selectedRating);
    setErrors({ ...errors, rating: '' });
  };

  const handleMediaSelect = () => {
    Alert.alert(
      'Add Photo/Video',
      'Choose source',
      [
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Gallery', onPress: () => openGallery() },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const openCamera = () => {
    launchCamera(
      {
        mediaType: 'mixed',
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        videoQuality: 'medium',
      },
      (response) => {
        if (response.assets?.[0]) {
          const asset = response.assets[0];
          if (validateMediaSize(asset)) {
            setMedia([...media, { uri: asset.uri!, type: asset.type! }]);
          }
        }
      }
    );
  };

  const openGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'mixed',
        selectionLimit: 5 - media.length,
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
      },
      (response) => {
        if (response.assets) {
          const validAssets = response.assets
            .filter(validateMediaSize)
            .map(asset => ({ uri: asset.uri!, type: asset.type! }));
          setMedia([...media, ...validAssets]);
        }
      }
    );
  };

  const validateMediaSize = (asset: any): boolean => {
    const maxSize = (options.maxMediaSize || 10) * 1024 * 1024; // MB to bytes
    if (asset.fileSize && asset.fileSize > maxSize) {
      Alert.alert(
        'File Too Large',
        `Please select files smaller than ${options.maxMediaSize || 10}MB`
      );
      return false;
    }
    return true;
  };

  const removeMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (rating === 0) {
      newErrors.rating = 'Please select a rating';
    }

    if (!content.trim()) {
      newErrors.content = 'Please write your review';
    } else if (content.length < 10) {
      newErrors.content = 'Review must be at least 10 characters';
    }

    if (!options.allowAnonymous && !authorName.trim()) {
      newErrors.authorName = 'Name is required';
    }

    if (options.requireEmail && !authorEmail.trim()) {
      newErrors.authorEmail = 'Email is required';
    } else if (authorEmail && !isValidEmail(authorEmail)) {
      newErrors.authorEmail = 'Please enter a valid email';
    }

    // Validate custom fields
    options.customFields?.forEach(field => {
      if (field.required && !customFieldValues[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }

      if (field.validation && customFieldValues[field.key]) {
        const value = customFieldValues[field.key];
        const { min, max, pattern, message } = field.validation;

        if (field.type === 'number') {
          if (min !== undefined && value < min) {
            newErrors[field.key] = message || `Minimum value is ${min}`;
          }
          if (max !== undefined && value > max) {
            newErrors[field.key] = message || `Maximum value is ${max}`;
          }
        } else if (field.type === 'text' && pattern) {
          if (!new RegExp(pattern).test(value)) {
            newErrors[field.key] = message || 'Invalid format';
          }
        }
      }
    });

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      // Scroll to first error
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const review = await ReviewInsightsSDK.getInstance().submitReview({
        rating,
        title: title.trim(),
        content: content.trim(),
        author: authorName.trim() || 'Anonymous',
        platform: 'in-app',
        metadata: {
          email: authorEmail.trim(),
          media: media.map(m => m.uri),
          customFields: customFieldValues,
          devicePlatform: Platform.OS,
        },
      });

      // Track event
      ReviewInsightsSDK.getInstance().trackEvent('review_collected', {
        rating,
        hasMedia: media.length > 0,
        customFieldsCount: Object.keys(customFieldValues).length,
      });

      onSubmit?.(review);

      // Reset form
      resetForm();

      Alert.alert(
        'Thank You!',
        'Your review has been submitted successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Submission Failed',
        'Unable to submit your review. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setRating(0);
    setTitle('');
    setContent('');
    setAuthorName('');
    setAuthorEmail('');
    setMedia([]);
    setCustomFieldValues({});
    setErrors({});
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const renderCustomField = (field: CustomField) => {
    switch (field.type) {
      case 'text':
        return (
          <TextInput
            style={styles.input}
            placeholder={field.label}
            value={customFieldValues[field.key] || ''}
            onChangeText={(value) => {
              setCustomFieldValues({ ...customFieldValues, [field.key]: value });
              setErrors({ ...errors, [field.key]: '' });
            }}
            placeholderTextColor="#999"
          />
        );

      case 'number':
        return (
          <TextInput
            style={styles.input}
            placeholder={field.label}
            value={customFieldValues[field.key]?.toString() || ''}
            onChangeText={(value) => {
              const numValue = parseFloat(value) || 0;
              setCustomFieldValues({ ...customFieldValues, [field.key]: numValue });
              setErrors({ ...errors, [field.key]: '' });
            }}
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        );

      case 'select':
        return (
          <View style={styles.selectContainer}>
            {field.options?.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.selectOption,
                  customFieldValues[field.key] === option && styles.selectOptionActive,
                ]}
                onPress={() => {
                  setCustomFieldValues({ ...customFieldValues, [field.key]: option });
                  setErrors({ ...errors, [field.key]: '' });
                }}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    customFieldValues[field.key] === option && styles.selectOptionTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'boolean':
        return (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => {
              setCustomFieldValues({
                ...customFieldValues,
                [field.key]: !customFieldValues[field.key],
              });
              setErrors({ ...errors, [field.key]: '' });
            }}
          >
            <View style={[styles.checkbox, customFieldValues[field.key] && styles.checkboxChecked]}>
              {customFieldValues[field.key] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{field.label}</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    scrollContent: {
      padding: 20,
    },
    header: {
      marginBottom: 24,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      color: '#666',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 12,
    },
    required: {
      color: '#FF3B30',
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 8,
    },
    star: {
      fontSize: 40,
      marginHorizontal: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: '#333',
      marginBottom: 12,
    },
    textArea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    error: {
      color: '#FF3B30',
      fontSize: 14,
      marginTop: -8,
      marginBottom: 8,
    },
    mediaContainer: {
      marginBottom: 12,
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    mediaItem: {
      width: 100,
      height: 100,
      margin: 6,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#F0F0F0',
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    mediaRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mediaRemoveText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    addMediaButton: {
      borderWidth: 2,
      borderColor: '#007AFF',
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 20,
      alignItems: 'center',
      marginBottom: 12,
    },
    addMediaText: {
      color: '#007AFF',
      fontSize: 16,
      fontWeight: '500',
    },
    selectContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
      marginBottom: 12,
    },
    selectOption: {
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
      margin: 4,
    },
    selectOptionActive: {
      borderColor: '#007AFF',
      backgroundColor: '#007AFF',
    },
    selectOptionText: {
      color: '#666',
      fontSize: 14,
    },
    selectOptionTextActive: {
      color: '#FFFFFF',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: '#E0E0E0',
      borderRadius: 4,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      borderColor: '#007AFF',
      backgroundColor: '#007AFF',
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    checkboxLabel: {
      fontSize: 16,
      color: '#333',
      flex: 1,
    },
    buttonsContainer: {
      flexDirection: 'row',
      marginTop: 32,
      marginBottom: 20,
    },
    button: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 8,
      marginHorizontal: 6,
    },
    primaryButton: {
      backgroundColor: '#007AFF',
    },
    secondaryButton: {
      backgroundColor: '#F0F0F0',
    },
    disabledButton: {
      backgroundColor: '#E0E0E0',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    primaryButtonText: {
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      color: '#333',
    },
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Write a Review</Text>
          <Text style={styles.headerSubtitle}>
            Share your experience to help others
          </Text>
        </View>

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Rating <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleRatingPress(star)}
              >
                <Text style={styles.star}>
                  {star <= rating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.rating && <Text style={styles.error}>{errors.rating}</Text>}
        </View>

        {/* Review Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Review <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Title (optional)"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about your experience..."
            value={content}
            onChangeText={(text) => {
              setContent(text);
              setErrors({ ...errors, content: '' });
            }}
            multiline
            placeholderTextColor="#999"
          />
          {errors.content && <Text style={styles.error}>{errors.content}</Text>}
        </View>

        {/* Media Section */}
        {(options.enablePhotos || options.enableVideos) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos/Videos</Text>
            <View style={styles.mediaContainer}>
              <View style={styles.mediaGrid}>
                {media.map((item, index) => (
                  <View key={index} style={styles.mediaItem}>
                    <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                    <TouchableOpacity
                      style={styles.mediaRemove}
                      onPress={() => removeMedia(index)}
                    >
                      <Text style={styles.mediaRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {media.length < 5 && (
                <TouchableOpacity
                  style={styles.addMediaButton}
                  onPress={handleMediaSelect}
                >
                  <Text style={styles.addMediaText}>
                    + Add Photo/Video
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Custom Fields */}
        {options.customFields?.map((field) => (
          <View key={field.key} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            {renderCustomField(field)}
            {errors[field.key] && (
              <Text style={styles.error}>{errors[field.key]}</Text>
            )}
          </View>
        ))}

        {/* Author Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About You
            {!options.allowAnonymous && <Text style={styles.required}> *</Text>}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={options.allowAnonymous ? 'Name (optional)' : 'Name'}
            value={authorName}
            onChangeText={(text) => {
              setAuthorName(text);
              setErrors({ ...errors, authorName: '' });
            }}
            placeholderTextColor="#999"
          />
          {errors.authorName && (
            <Text style={styles.error}>{errors.authorName}</Text>
          )}
          
          <TextInput
            style={styles.input}
            placeholder={options.requireEmail ? 'Email' : 'Email (optional)'}
            value={authorEmail}
            onChangeText={(text) => {
              setAuthorEmail(text);
              setErrors({ ...errors, authorEmail: '' });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
          {errors.authorEmail && (
            <Text style={styles.error}>{errors.authorEmail}</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onCancel || resetForm}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              isSubmitting && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                Submit Review
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};