export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateRating = (rating: number, min: number = 1, max: number = 5): boolean => {
  return rating >= min && rating <= max && Number.isInteger(rating);
};