import React, { useState, useCallback } from 'react';
import { useFormik } from 'formik'; // v2.4.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import * as yup from 'yup'; // v1.0.0
import { motion } from 'framer-motion'; // v10.0.0
import { Event, EventPlatform, CreateEventInput } from '../../types/events';
import { useToast } from '../../hooks/useToast';
import { Icon, ICON_NAMES } from '../common/Icon';

// Validation schema for event form
const eventValidationSchema = yup.object().shape({
  title: yup.string()
    .required('Event title is required')
    .max(100, 'Title must be less than 100 characters'),
  description: yup.string()
    .max(1000, 'Description must be less than 1000 characters'),
  start_date: yup.date()
    .required('Start date is required')
    .min(new Date(), 'Start date must be in the future'),
  end_date: yup.date()
    .required('End date is required')
    .min(yup.ref('start_date'), 'End date must be after start date'),
  location: yup.string()
    .required('Location is required'),
  metadata: yup.object().shape({
    tags: yup.object(),
    categories: yup.array().of(yup.string()),
    capacity: yup.number().min(1, 'Capacity must be at least 1'),
    is_private: yup.boolean()
  })
});

// Platform configuration interface
interface PlatformConfig {
  platform: EventPlatform;
  api_key?: string;
  is_connected: boolean;
}

// Props interface for the EventForm component
interface EventFormProps {
  event?: Event;
  onSubmit: (event: CreateEventInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  platformConfig: Record<EventPlatform, PlatformConfig>;
  onPlatformConnect: (platform: EventPlatform) => Promise<void>;
}

export const EventForm: React.FC<EventFormProps> = ({
  event,
  onSubmit,
  onCancel,
  isLoading,
  platformConfig,
  onPlatformConnect
}) => {
  const { showToast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<EventPlatform | null>(null);

  // Initialize form with Formik
  const formik = useFormik({
    initialValues: event || {
      title: '',
      description: '',
      start_date: new Date(),
      end_date: new Date(),
      location: '',
      metadata: {
        tags: {},
        categories: [],
        capacity: 100,
        is_private: false
      }
    },
    validationSchema: eventValidationSchema,
    onSubmit: async (values) => {
      try {
        await onSubmit(values as CreateEventInput);
        showToast({
          type: 'success',
          message: 'Event saved successfully'
        });
      } catch (error) {
        showToast({
          type: 'error',
          message: 'Failed to save event',
          description: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
  });

  // Handle platform connection
  const handlePlatformConnect = useCallback(async (platform: EventPlatform) => {
    try {
      setSelectedPlatform(platform);
      await onPlatformConnect(platform);
      showToast({
        type: 'success',
        message: `Connected to ${platform} successfully`
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: `Failed to connect to ${platform}`,
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [onPlatformConnect, showToast]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-boundary">
          <h3>Something went wrong with the event form</h3>
          <button onClick={() => window.location.reload()}>Reload page</button>
        </div>
      }
    >
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="event-form"
        onSubmit={formik.handleSubmit}
        aria-label="Event form"
      >
        {/* Event Details Section */}
        <div className="form-section">
          <h2>Event Details</h2>
          
          <div className="form-field">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.title}
              disabled={isLoading}
              aria-invalid={formik.touched.title && Boolean(formik.errors.title)}
              aria-describedby="title-error"
            />
            {formik.touched.title && formik.errors.title && (
              <div id="title-error" className="error-message">
                {formik.errors.title}
              </div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.description}
              disabled={isLoading}
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="start_date">Start Date *</label>
              <input
                id="start_date"
                name="start_date"
                type="datetime-local"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.start_date}
                disabled={isLoading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="end_date">End Date *</label>
              <input
                id="end_date"
                name="end_date"
                type="datetime-local"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.end_date}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="location">Location *</label>
            <input
              id="location"
              name="location"
              type="text"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.location}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Platform Integration Section */}
        <div className="form-section">
          <h2>Platform Integration</h2>
          <div className="platform-grid">
            {Object.entries(platformConfig).map(([platform, config]) => (
              <motion.div
                key={platform}
                className={`platform-card ${config.is_connected ? 'connected' : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon
                  name={ICON_NAMES[7]} // import icon
                  size="lg"
                  ariaLabel={`${platform} integration`}
                />
                <h3>{platform}</h3>
                <button
                  type="button"
                  onClick={() => handlePlatformConnect(platform as EventPlatform)}
                  disabled={isLoading || config.is_connected}
                  className="platform-connect-button"
                >
                  {config.is_connected ? 'Connected' : 'Connect'}
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <motion.button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="cancel-button"
          >
            Cancel
          </motion.button>
          
          <motion.button
            type="submit"
            disabled={isLoading || !formik.isValid}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="submit-button"
          >
            {isLoading ? (
              <Icon name={ICON_NAMES[10]} spin={true} ariaLabel="Saving..." />
            ) : 'Save Event'}
          </motion.button>
        </div>
      </motion.form>
    </ErrorBoundary>
  );
};

export default EventForm;