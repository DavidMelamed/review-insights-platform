export const formatDate = (date: Date | string, format: 'short' | 'long' = 'short'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'short') {
    // Return relative time for recent dates
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes === 0) return 'Just now';
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
  }
  
  // Return formatted date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatRating = (rating: number, maxRating: number = 5): string => {
  const stars = '★'.repeat(Math.floor(rating));
  const emptyStars = '☆'.repeat(maxRating - Math.floor(rating));
  return `${stars}${emptyStars} ${rating.toFixed(1)}`;
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  
  // Try to break at a word boundary
  const truncated = text.substr(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substr(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};