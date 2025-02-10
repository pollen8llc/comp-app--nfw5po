import { format, isValid, parseISO } from 'date-fns'; // date-fns v2.30.0

// Global date format constants
const DATE_FORMAT = 'MMM d, yyyy';
const TIME_FORMAT = 'h:mm a';
const DATE_TIME_FORMAT = 'MMM d, yyyy h:mm a';
const API_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

/**
 * Formats a date or date range for event display with comprehensive validation
 * @param startDate - Event start date
 * @param endDate - Optional event end date
 * @returns Formatted date string for display
 * @throws Error if startDate is invalid
 */
export const formatEventDate = (startDate: Date, endDate?: Date): string => {
  if (!isValid(startDate)) {
    throw new Error('Invalid start date provided');
  }

  const formattedStartDate = format(startDate, DATE_TIME_FORMAT);

  if (!endDate) {
    return formattedStartDate;
  }

  if (!isValid(endDate)) {
    throw new Error('Invalid end date provided');
  }

  // If same day, only show time for end date
  if (format(startDate, DATE_FORMAT) === format(endDate, DATE_FORMAT)) {
    return `${formattedStartDate} - ${format(endDate, TIME_FORMAT)}`;
  }

  return `${formattedStartDate} - ${format(endDate, DATE_TIME_FORMAT)}`;
};

/**
 * Parses and validates ISO date strings with comprehensive error handling
 * @param dateString - ISO date string to parse
 * @returns Parsed Date object if valid, null otherwise
 */
export const parseAndValidateDate = (
  dateString: string | null | undefined
): Date | null => {
  if (!dateString) {
    return null;
  }

  try {
    const parsedDate = parseISO(dateString);
    return isValid(parsedDate) ? parsedDate : null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Formats a date for API requests with strict ISO format compliance
 * @param date - Date to format
 * @returns ISO formatted date string
 * @throws Error if date is invalid
 */
export const formatDateForAPI = (date: Date): string => {
  if (!isValid(date)) {
    throw new Error('Invalid date provided for API formatting');
  }

  try {
    // Ensure UTC timezone for API consistency
    const utcDate = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds()
      )
    );

    return format(utcDate, API_DATE_FORMAT);
  } catch (error) {
    console.error('Error formatting date for API:', error);
    throw new Error('Failed to format date for API');
  }
};

/**
 * Calculates and formats a date range with intelligent display logic
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @returns Formatted date range string
 * @throws Error if dates are invalid or range is invalid
 */
export const getDateRange = (startDate: Date, endDate: Date): string => {
  if (!isValid(startDate) || !isValid(endDate)) {
    throw new Error('Invalid date(s) provided for range calculation');
  }

  if (endDate < startDate) {
    throw new Error('End date cannot be before start date');
  }

  // Same day check
  if (format(startDate, DATE_FORMAT) === format(endDate, DATE_FORMAT)) {
    return `${format(startDate, DATE_FORMAT)} ${format(startDate, TIME_FORMAT)} - ${format(
      endDate,
      TIME_FORMAT
    )}`;
  }

  // Same month check
  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${format(startDate, 'MMM d')} - ${format(endDate, DATE_FORMAT)}`;
  }

  // Different months or years
  return `${format(startDate, DATE_FORMAT)} - ${format(endDate, DATE_FORMAT)}`;
};