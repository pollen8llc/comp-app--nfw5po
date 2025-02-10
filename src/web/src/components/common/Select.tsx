import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Icon } from './Icon';
import { useToast } from '../../hooks/useToast';

// Interfaces
interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: string;
  metadata?: Record<string, unknown>;
  ariaLabel?: string;
  testId?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | string[] | number | number[];
  onChange: (value: string | string[] | number | number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  error?: string;
  className?: string;
  maxHeight?: number;
  loading?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
  onBlur?: (event: FocusEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  renderOption?: (option: SelectOption) => React.ReactNode;
  noOptionsMessage?: string;
  loadingMessage?: string;
  clearable?: boolean;
  rtl?: boolean;
  menuPosition?: 'top' | 'bottom' | 'auto';
  menuPortalTarget?: HTMLElement;
  testId?: string;
}

// Animation variants
const dropdownVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const optionVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  hover: { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
};

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  multiple = false,
  searchable = false,
  error,
  className,
  maxHeight = 300,
  loading = false,
  required = false,
  name,
  id,
  ariaLabel,
  onBlur,
  onFocus,
  renderOption,
  noOptionsMessage = 'No options available',
  loadingMessage = 'Loading...',
  clearable = true,
  rtl = false,
  menuPosition = 'bottom',
  menuPortalTarget,
  testId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Filter options based on search text
  const filterOptions = useCallback((options: SelectOption[], searchText: string): SelectOption[] => {
    if (!searchText) return options;
    const normalized = searchText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return options.filter(option => 
      option.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .includes(normalized)
    );
  }, []);

  const filteredOptions = searchable ? filterOptions(options, searchText) : options;

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          handleSelect(filteredOptions[focusedIndex]);
        } else {
          setIsOpen(true);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;

      case 'Tab':
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
        }
        break;
    }
  }, [disabled, filteredOptions, focusedIndex, isOpen]);

  // Handle option selection
  const handleSelect = useCallback((option: SelectOption) => {
    if (option.disabled) {
      showToast({
        type: 'error',
        message: 'This option is disabled'
      });
      return;
    }

    if (multiple) {
      const newValue = Array.isArray(value) ? [...value] : [];
      const optionValue = option.value.toString();
      
      if (newValue.includes(optionValue)) {
        onChange(newValue.filter(v => v !== optionValue));
      } else {
        onChange([...newValue, optionValue]);
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
    }

    if (searchable) {
      setSearchText('');
    }
  }, [multiple, value, onChange, searchable]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening dropdown
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'select-container',
        {
          'select-disabled': disabled,
          'select-error': error,
          'select-rtl': rtl
        },
        className
      )}
      data-testid={testId}
    >
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-label={ariaLabel || placeholder}
        aria-required={required}
        aria-invalid={!!error}
        tabIndex={disabled ? -1 : 0}
        className="select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
      >
        {searchable && isOpen ? (
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={placeholder}
            className="select-search"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="select-value">
            {multiple ? (
              Array.isArray(value) && value.length > 0 ? (
                value.map(v => options.find(o => o.value.toString() === v)?.label).join(', ')
              ) : placeholder
            ) : (
              options.find(o => o.value === value)?.label || placeholder
            )}
          </span>
        )}

        <div className="select-indicators">
          {clearable && value && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="select-clear"
              onClick={e => {
                e.stopPropagation();
                onChange(multiple ? [] : '');
              }}
              aria-label="Clear selection"
            >
              <Icon name="close" size="sm" ariaLabel="Clear selection" />
            </motion.button>
          )}
          <Icon
            name={isOpen ? 'menu' : 'menu'}
            size="sm"
            className={clsx('select-arrow', { 'select-arrow-open': isOpen })}
            ariaLabel={isOpen ? 'Close options' : 'Open options'}
          />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            role="listbox"
            id={`${id}-listbox`}
            className="select-dropdown"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={dropdownVariants}
            style={{
              maxHeight,
              [menuPosition === 'top' ? 'bottom' : 'top']: '100%'
            }}
          >
            {loading ? (
              <div className="select-loading" role="status">
                <Icon name="menu" size="sm" spin ariaLabel="Loading" />
                <span>{loadingMessage}</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="select-no-options">{noOptionsMessage}</div>
            ) : (
              filteredOptions.map((option, index) => (
                <motion.div
                  key={option.value}
                  role="option"
                  aria-selected={multiple ? 
                    Array.isArray(value) && value.includes(option.value.toString()) :
                    value === option.value
                  }
                  aria-disabled={option.disabled}
                  className={clsx('select-option', {
                    'option-selected': multiple ?
                      Array.isArray(value) && value.includes(option.value.toString()) :
                      value === option.value,
                    'option-focused': focusedIndex === index,
                    'option-disabled': option.disabled
                  })}
                  onClick={() => handleSelect(option)}
                  variants={optionVariants}
                  whileHover="hover"
                  data-testid={option.testId}
                >
                  {option.icon && (
                    <Icon name={option.icon} size="sm" ariaLabel={option.ariaLabel} />
                  )}
                  {renderOption ? renderOption(option) : option.label}
                  {multiple && Array.isArray(value) && value.includes(option.value.toString()) && (
                    <Icon name="menu" size="sm" className="option-check" ariaLabel="Selected" />
                  )}
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="select-error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export type { SelectOption, SelectProps };