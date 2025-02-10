import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.2
import { twMerge } from 'tailwind-merge'; // v3.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { validateProfile } from '../../utils/validation';

interface InputProps {
  value: string | number;
  onChange: (value: string | number) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';
  required?: boolean;
  disabled?: boolean;
  className?: string;
  validate?: (value: string | number) => Promise<boolean> | boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  autoComplete?: string;
  maxLength?: number;
  pattern?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  loading?: boolean;
}

export const Input: React.FC<InputProps> = React.memo(({
  value,
  onChange,
  onBlur,
  error,
  label,
  placeholder,
  type = 'text',
  required = false,
  disabled = false,
  className,
  validate,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  autoComplete,
  maxLength,
  pattern,
  inputMode,
  loading = false,
}) => {
  // State management
  const [internalValue, setInternalValue] = useState<string | number>(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useRef(`${label?.toLowerCase().replace(/\s+/g, '-')}-error-${Math.random().toString(36).substr(2, 9)}`);
  
  // Debounced validation
  const [debouncedValidate] = useDebounce(
    async (val: string | number) => {
      if (!validate) return;
      
      setIsValidating(true);
      try {
        const isValid = await validate(val);
        if (!isValid) {
          setValidationError('Invalid value');
        } else {
          setValidationError(undefined);
        }
      } catch (err) {
        setValidationError(err instanceof Error ? err.message : 'Validation failed');
      } finally {
        setIsValidating(false);
      }
    },
    500
  );

  // Handle value changes from parent
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle change events
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    
    const newValue = type === 'number' 
      ? parseFloat(event.target.value)
      : event.target.value;

    setInternalValue(newValue);
    setIsTouched(true);

    // Trigger validation
    if (validate) {
      debouncedValidate(newValue);
    }

    onChange(newValue);
  }, [onChange, type, validate, debouncedValidate]);

  // Handle blur events
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setIsTouched(true);

    if (validate) {
      debouncedValidate(internalValue);
    }

    if (onBlur) {
      onBlur(event);
    }
  }, [onBlur, validate, debouncedValidate, internalValue]);

  // Generate class names
  const containerClasses = twMerge(
    'relative w-full',
    className
  );

  const inputClasses = classNames(
    'w-full px-4 py-2 text-base transition-all duration-200',
    'border rounded-md outline-none appearance-none',
    'bg-white dark:bg-gray-800',
    'text-gray-900 dark:text-gray-100',
    {
      'border-gray-300 dark:border-gray-600': !error && !isFocused,
      'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800': isFocused && !error,
      'border-red-500 ring-2 ring-red-200 dark:ring-red-800': error || validationError,
      'bg-gray-100 dark:bg-gray-900 cursor-not-allowed': disabled,
      'pr-10': loading || (error || validationError),
    }
  );

  const labelClasses = classNames(
    'block mb-2 text-sm font-medium',
    'text-gray-700 dark:text-gray-300',
    {
      'text-red-500 dark:text-red-400': error || validationError,
    }
  );

  return (
    <div className={containerClasses}>
      {label && (
        <label 
          htmlFor={errorId.current}
          className={labelClasses}
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          id={errorId.current}
          type={type}
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={inputClasses}
          aria-label={ariaLabel}
          aria-invalid={!!(error || validationError)}
          aria-describedby={ariaDescribedBy || (error || validationError ? errorId.current : undefined)}
          autoComplete={autoComplete}
          maxLength={maxLength}
          pattern={pattern}
          inputMode={inputMode}
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded-full animate-spin border-t-transparent" />
          </div>
        )}

        {/* Error icon */}
        {(error || validationError) && !loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg 
              className="w-5 h-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Error message */}
      {(error || validationError) && (
        <p 
          id={errorId.current}
          className="mt-2 text-sm text-red-500 dark:text-red-400"
          role="alert"
        >
          {error || validationError}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;