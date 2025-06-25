# Review Insights Mobile SDK

React Native SDK for integrating Review Insights into your mobile applications. Collect reviews, analyze sentiment, and display analytics with ease.

## Features

- 📱 **Native Review Collection** - Beautiful, customizable review forms
- 📊 **Real-time Analytics** - Display review metrics and trends
- 🔔 **Smart Review Prompts** - Intelligent timing for app store ratings
- 📴 **Offline Support** - Queue reviews and sync when online
- 🎨 **Customizable UI** - Match your app's design
- 🔐 **Secure** - API key authentication with encrypted storage
- 📈 **Analytics Tracking** - Built-in event tracking

## Installation

```bash
npm install @review-insights/mobile-sdk
# or
yarn add @review-insights/mobile-sdk
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

No additional setup required for Android.

## Quick Start

### 1. Initialize the SDK

```typescript
import { ReviewInsightsSDK } from '@review-insights/mobile-sdk';

// In your app's entry point (App.tsx)
const sdk = ReviewInsightsSDK.initialize({
  apiKey: 'your-api-key',
  environment: 'production',
  enableAnalytics: true,
  enablePushNotifications: true,
  enableOfflineMode: true,
});
```

### 2. Identify Users

```typescript
// Identify logged-in users
await sdk.identifyUser('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'premium',
});
```

### 3. Collect Reviews

```typescript
import { ReviewCollector } from '@review-insights/mobile-sdk';

function ReviewScreen() {
  return (
    <ReviewCollector
      options={{
        allowAnonymous: true,
        enablePhotos: true,
        customFields: [
          {
            key: 'orderNumber',
            label: 'Order Number',
            type: 'text',
            required: false,
          },
        ],
      }}
      onSubmit={(review) => {
        console.log('Review submitted:', review);
        // Navigate to success screen
      }}
    />
  );
}
```

### 4. Show Review Prompt

```typescript
import { ReviewPrompt, useReviewPrompt } from '@review-insights/mobile-sdk';

function App() {
  const { shouldShow, incrementActionCount } = useReviewPrompt({
    showAfterActions: 5,
    cooldownDays: 7,
  });

  const [showPrompt, setShowPrompt] = useState(false);

  // Track significant user actions
  const handlePurchase = async () => {
    // ... purchase logic
    const shouldPrompt = await incrementActionCount();
    if (shouldPrompt && shouldShow) {
      setShowPrompt(true);
    }
  };

  return (
    <>
      <YourApp />
      <ReviewPrompt
        visible={showPrompt}
        onClose={() => setShowPrompt(false)}
        appStoreId="123456789"
        playStoreId="com.yourapp.id"
        positiveThreshold={4}
      />
    </>
  );
}
```

### 5. Display Analytics

```typescript
import { ReviewAnalytics } from '@review-insights/mobile-sdk';

function AnalyticsScreen() {
  return (
    <ReviewAnalytics
      showTrends={true}
      showKeywords={true}
      showDistribution={true}
      refreshInterval={300000} // 5 minutes
    />
  );
}
```

## Components

### ReviewCollector

Customizable form for collecting reviews with support for media uploads and custom fields.

```typescript
<ReviewCollector
  options={{
    allowAnonymous: false,
    requireEmail: true,
    enablePhotos: true,
    enableVideos: true,
    maxMediaSize: 10, // MB
    customFields: [...],
  }}
  onSubmit={(review) => {...}}
  onCancel={() => {...}}
/>
```

### ReviewPrompt

Smart review prompt that redirects satisfied users to app stores and collects feedback from others.

```typescript
<ReviewPrompt
  visible={visible}
  onClose={() => {...}}
  title="Enjoying our app?"
  message="Would you mind rating us?"
  positiveThreshold={4}
  appStoreId="123456789"
  playStoreId="com.app.id"
  customUI={{
    primaryColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  }}
/>
```

### ReviewWidget

Display reviews in a scrollable list with filtering and pagination.

```typescript
<ReviewWidget
  filter={{
    rating: { min: 4 },
    platforms: ['in-app', 'app-store'],
    sortBy: 'date',
    sortOrder: 'desc',
  }}
  onReviewPress={(review) => {...}}
  compact={true}
  showPlatform={true}
  showResponse={true}
/>
```

### ReviewAnalytics

Beautiful analytics dashboard showing ratings, sentiment, and trends.

```typescript
<ReviewAnalytics
  style={styles.analytics}
  showTrends={true}
  showKeywords={true}
  showDistribution={true}
  refreshInterval={300000}
/>
```

## Hooks

### useReviews

```typescript
const {
  reviews,
  loading,
  error,
  refetch,
  loadMore,
  hasMore,
} = useReviews({
  rating: { min: 4 },
  sortBy: 'date',
});
```

### useReviewAnalytics

```typescript
const {
  analytics,
  loading,
  error,
  refetch,
} = useReviewAnalytics({
  autoFetch: true,
  refreshInterval: 300000,
});
```

### useSDK

```typescript
const {
  sdk,
  isReady,
  user,
  error,
} = useSDK();
```

### useOfflineSync

```typescript
const {
  isOnline,
  queuedItems,
  queueCount,
  syncing,
  syncNow,
} = useOfflineSync();
```

## Advanced Usage

### Custom Review Platforms

```typescript
await sdk.submitReview({
  rating: 5,
  title: 'Great product!',
  content: 'Love using this app...',
  author: 'John Doe',
  platform: 'custom',
  metadata: {
    source: 'in-app-campaign',
    version: '2.1.0',
  },
});
```

### Offline Queue Management

```typescript
const { queuedItems, syncNow } = useOfflineSync();

// Manual sync
await syncNow();

// Clear offline queue
await sdk.clearCache();
```

### Analytics Events

```typescript
// Track custom events
sdk.trackEvent('feature_used', {
  feature: 'photo_upload',
  success: true,
});

// Track screens
sdk.trackScreen('ReviewDetailScreen', {
  reviewId: '123',
});
```

### Push Notifications

```typescript
// Enable push notifications
await sdk.enablePushNotifications({
  topics: ['reviews', 'updates'],
});

// Disable push notifications
await sdk.disablePushNotifications();
```

## Styling & Theming

All components support custom styling:

```typescript
const customTheme = {
  colors: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    background: '#F7F7F7',
  },
  fonts: {
    regular: 'System',
    bold: 'System-Bold',
  },
};

<ReviewCollector
  style={{
    container: {
      backgroundColor: customTheme.colors.background,
    },
  }}
/>
```

## Best Practices

1. **Initialize Early** - Initialize the SDK in your app's entry point
2. **Identify Users** - Always identify logged-in users for better analytics
3. **Handle Offline** - Enable offline mode for better user experience
4. **Test Prompts** - Test review prompts thoroughly before release
5. **Monitor Analytics** - Use analytics to improve your app

## API Reference

### SDK Methods

- `initialize(config)` - Initialize the SDK
- `identifyUser(userId, attributes)` - Identify a user
- `updateUserAttributes(attributes)` - Update user attributes
- `submitReview(review)` - Submit a review
- `getReviews(filter)` - Fetch reviews
- `getReviewAnalytics()` - Get analytics data
- `trackEvent(name, properties)` - Track an event
- `trackScreen(name, properties)` - Track a screen view
- `enablePushNotifications(config)` - Enable push notifications
- `disablePushNotifications()` - Disable push notifications
- `clearCache()` - Clear local cache
- `logout()` - Logout current user

## Error Handling

```typescript
try {
  await sdk.submitReview(review);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Handle network error
  } else if (error.code === 'VALIDATION_ERROR') {
    // Handle validation error
  }
}
```

## License

MIT © Review Insights