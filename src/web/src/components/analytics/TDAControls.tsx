import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.2
import debounce from 'lodash/debounce'; // v4.0.8
import { Input } from '../common/Input';
import { TDAParameters, DistanceMetric } from '../../types/analytics';
import { useAnalytics } from '../../hooks/useAnalytics';

interface TDAControlsProps {
  className?: string;
  onCompute?: (params: TDAParameters) => void;
  onError?: (error: string) => void;
  autoCompute?: boolean;
}

// Parameter validation ranges from technical specification
const VALIDATION_RANGES = {
  EPSILON: { min: 0.1, max: 1.0, default: 0.5 },
  MIN_POINTS: { min: 5, max: 50, default: 15 },
  DIMENSION: { min: 2, max: 3, default: 2 },
  PERSISTENCE: { min: 0.1, max: 0.9, default: 0.3 }
} as const;

export const TDAControls: React.FC<TDAControlsProps> = ({
  className,
  onCompute,
  onError,
  autoCompute = false
}) => {
  const {
    tdaParams,
    setTDAParams,
    computeTDA,
    isComputing,
    error: computeError
  } = useAnalytics();

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Validation functions for each parameter
  const validateEpsilon = useCallback((value: number): string | null => {
    if (value < VALIDATION_RANGES.EPSILON.min || value > VALIDATION_RANGES.EPSILON.max) {
      return `Epsilon must be between ${VALIDATION_RANGES.EPSILON.min} and ${VALIDATION_RANGES.EPSILON.max}`;
    }
    return null;
  }, []);

  const validateMinPoints = useCallback((value: number): string | null => {
    if (value < VALIDATION_RANGES.MIN_POINTS.min || value > VALIDATION_RANGES.MIN_POINTS.max) {
      return `Minimum points must be between ${VALIDATION_RANGES.MIN_POINTS.min} and ${VALIDATION_RANGES.MIN_POINTS.max}`;
    }
    return null;
  }, []);

  const validateDimension = useCallback((value: number): string | null => {
    if (value < VALIDATION_RANGES.DIMENSION.min || value > VALIDATION_RANGES.DIMENSION.max) {
      return `Dimension must be ${VALIDATION_RANGES.DIMENSION.min} or ${VALIDATION_RANGES.DIMENSION.max}`;
    }
    return null;
  }, []);

  const validatePersistence = useCallback((value: number): string | null => {
    if (value < VALIDATION_RANGES.PERSISTENCE.min || value > VALIDATION_RANGES.PERSISTENCE.max) {
      return `Persistence threshold must be between ${VALIDATION_RANGES.PERSISTENCE.min} and ${VALIDATION_RANGES.PERSISTENCE.max}`;
    }
    return null;
  }, []);

  // Debounced parameter update handlers
  const debouncedParamUpdate = useCallback(
    debounce((newParams: Partial<TDAParameters>) => {
      setTDAParams(newParams);
      if (autoCompute && isDirty) {
        handleCompute();
      }
    }, 500),
    [autoCompute, isDirty]
  );

  // Parameter change handlers
  const handleEpsilonChange = useCallback((value: string) => {
    const numValue = parseFloat(value);
    const error = validateEpsilon(numValue);
    setValidationErrors(prev => ({ ...prev, epsilon: error || '' }));
    if (!error) {
      debouncedParamUpdate({ epsilon: numValue });
      setIsDirty(true);
    }
  }, [validateEpsilon, debouncedParamUpdate]);

  const handleMinPointsChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10);
    const error = validateMinPoints(numValue);
    setValidationErrors(prev => ({ ...prev, minPoints: error || '' }));
    if (!error) {
      debouncedParamUpdate({ minPoints: numValue });
      setIsDirty(true);
    }
  }, [validateMinPoints, debouncedParamUpdate]);

  const handleDimensionChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10);
    const error = validateDimension(numValue);
    setValidationErrors(prev => ({ ...prev, dimension: error || '' }));
    if (!error) {
      debouncedParamUpdate({ dimension: numValue });
      setIsDirty(true);
    }
  }, [validateDimension, debouncedParamUpdate]);

  const handlePersistenceChange = useCallback((value: string) => {
    const numValue = parseFloat(value);
    const error = validatePersistence(numValue);
    setValidationErrors(prev => ({ ...prev, persistenceThreshold: error || '' }));
    if (!error) {
      debouncedParamUpdate({ persistenceThreshold: numValue });
      setIsDirty(true);
    }
  }, [validatePersistence, debouncedParamUpdate]);

  const handleMetricChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as DistanceMetric;
    debouncedParamUpdate({ distanceMetric: value });
    setIsDirty(true);
  }, [debouncedParamUpdate]);

  // Compute handler
  const handleCompute = useCallback(async () => {
    try {
      await computeTDA(tdaParams);
      onCompute?.(tdaParams);
      setIsDirty(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Computation failed';
      onError?.(errorMessage);
    }
  }, [tdaParams, computeTDA, onCompute, onError]);

  // Reset handler
  const handleReset = useCallback(() => {
    setTDAParams({
      epsilon: VALIDATION_RANGES.EPSILON.default,
      minPoints: VALIDATION_RANGES.MIN_POINTS.default,
      dimension: VALIDATION_RANGES.DIMENSION.default,
      persistenceThreshold: VALIDATION_RANGES.PERSISTENCE.default,
      distanceMetric: 'euclidean'
    });
    setValidationErrors({});
    setIsDirty(false);
  }, [setTDAParams]);

  // Effect for error propagation
  useEffect(() => {
    if (computeError) {
      onError?.(computeError);
    }
  }, [computeError, onError]);

  const containerClasses = classNames(
    'p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md',
    'border border-gray-200 dark:border-gray-700',
    className
  );

  return (
    <div className={containerClasses} role="region" aria-label="TDA Controls">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Topological Analysis Parameters
      </h3>

      <div className="space-y-4">
        <Input
          label="Epsilon"
          type="number"
          value={tdaParams.epsilon}
          onChange={handleEpsilonChange}
          error={validationErrors.epsilon}
          aria-describedby="epsilon-description"
          min={VALIDATION_RANGES.EPSILON.min}
          max={VALIDATION_RANGES.EPSILON.max}
          step={0.1}
        />
        <p id="epsilon-description" className="text-sm text-gray-500">
          Neighborhood size for connectivity analysis
        </p>

        <Input
          label="Minimum Points"
          type="number"
          value={tdaParams.minPoints}
          onChange={handleMinPointsChange}
          error={validationErrors.minPoints}
          aria-describedby="min-points-description"
          min={VALIDATION_RANGES.MIN_POINTS.min}
          max={VALIDATION_RANGES.MIN_POINTS.max}
          step={1}
        />
        <p id="min-points-description" className="text-sm text-gray-500">
          Minimum number of points to form a cluster
        </p>

        <Input
          label="Dimension"
          type="number"
          value={tdaParams.dimension}
          onChange={handleDimensionChange}
          error={validationErrors.dimension}
          aria-describedby="dimension-description"
          min={VALIDATION_RANGES.DIMENSION.min}
          max={VALIDATION_RANGES.DIMENSION.max}
          step={1}
        />
        <p id="dimension-description" className="text-sm text-gray-500">
          Visualization dimensionality (2D or 3D)
        </p>

        <Input
          label="Persistence Threshold"
          type="number"
          value={tdaParams.persistenceThreshold}
          onChange={handlePersistenceChange}
          error={validationErrors.persistenceThreshold}
          aria-describedby="persistence-description"
          min={VALIDATION_RANGES.PERSISTENCE.min}
          max={VALIDATION_RANGES.PERSISTENCE.max}
          step={0.1}
        />
        <p id="persistence-description" className="text-sm text-gray-500">
          Threshold for feature significance
        </p>

        <div className="space-y-2">
          <label htmlFor="metric" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Distance Metric
          </label>
          <select
            id="metric"
            value={tdaParams.distanceMetric}
            onChange={handleMetricChange}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            aria-describedby="metric-description"
          >
            <option value="euclidean">Euclidean</option>
            <option value="manhattan">Manhattan</option>
            <option value="cosine">Cosine</option>
          </select>
          <p id="metric-description" className="text-sm text-gray-500">
            Method for calculating distances between points
          </p>
        </div>

        <div className="flex justify-end space-x-4 mt-6">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isComputing}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleCompute}
            disabled={isComputing || Object.keys(validationErrors).length > 0}
            className={classNames(
              'px-4 py-2 text-sm font-medium text-white rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              isComputing || Object.keys(validationErrors).length > 0
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {isComputing ? 'Computing...' : 'Compute TDA'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TDAControls;