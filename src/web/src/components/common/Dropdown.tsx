import React, { useState, useRef, useCallback, useEffect } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Icon } from './Icon';
import { Button } from './Button';

// Type-safe dropdown variants and sizes
export const DROPDOWN_VARIANTS = ['outline', 'filled', 'standard'] as const;
export const DROPDOWN_SIZES = ['sm', 'md', 'lg'] as const;

type DropdownVariant = typeof DROPDOWN_VARIANTS[number];
type DropdownSize = typeof DROPDOWN_SIZES[number];

interface DropdownOption {
  value: any;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  /** Dropdown visual variant */
  variant?: DropdownVariant;
  /** Dropdown size */
  size?: DropdownSize;
  /** Array of options to display */
  options: DropdownOption[];
  /** Selected value(s) */
  value: any | any[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Enable search functionality */
  searchable?: boolean;
  /** Enable multiple selection */
  multiple?: boolean;
  /** Custom class name */
  className?: string;
  /** Change handler */
  onChange: (value: any | any[]) => void;
  /** Search handler */
  onSearch?: (searchValue: string) => void;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * Generates class names for dropdown styling based on props
 */
const getDropdownClasses = (
  variant: DropdownVariant,
  size: DropdownSize,
  isOpen: boolean,
  disabled: boolean,
  className?: string
): string => {
  return clsx(
    // Base styles
    'relative inline-flex flex-col w-full',
    // Variant styles
    {
      'border rounded-md': variant === 'outline',
      'bg-gray-100 rounded-md': variant === 'filled',
      'border-b': variant === 'standard',
    },
    // Size styles
    {
      'text-sm': size === 'sm',
      'text-base': size === 'md',
      'text-lg': size === 'lg',
    },
    // State styles
    {
      'border-primary-600 ring-2 ring-primary-100': isOpen && !disabled,
      'opacity-50 cursor-not-allowed': disabled,
    },
    className
  );
};

/**
 * Dropdown component that follows Material Design 3.0 principles
 * and WCAG 2.1 Level AA accessibility guidelines
 */
export const Dropdown: React.FC<DropdownProps> = ({
  variant = 'outline',
  size = 'md',
  options,
  value,
  placeholder = 'Select an option',
  disabled = false,
  searchable = false,
  multiple = false,
  className,
  onChange,
  onSearch,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle dropdown toggle
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchValue('');
      setActiveIndex(-1);
    }
  }, [disabled]);

  // Handle option selection
  const handleSelect = useCallback((option: DropdownOption) => {
    if (option.disabled) return;

    if (multiple) {
      const newValue = Array.isArray(value) ? value : [];
      const optionIndex = newValue.indexOf(option.value);
      
      if (optionIndex === -1) {
        onChange([...newValue, option.value]);
      } else {
        onChange(newValue.filter((v) => v !== option.value));
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  }, [multiple, onChange, value]);

  // Handle search input
  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchValue = event.target.value;
    setSearchValue(newSearchValue);
    onSearch?.(newSearchValue);
    setActiveIndex(-1);
  }, [onSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        if (isOpen && activeIndex >= 0) {
          handleSelect(options[activeIndex]);
        } else {
          setIsOpen(!isOpen);
        }
        event.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        event.preventDefault();
        break;
      case 'ArrowDown':
        if (isOpen) {
          setActiveIndex((prev) => (prev + 1) % options.length);
          event.preventDefault();
        }
        break;
      case 'ArrowUp':
        if (isOpen) {
          setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
          event.preventDefault();
        }
        break;
    }
  }, [isOpen, activeIndex, options, handleSelect]);

  // Filter options based on search
  const filteredOptions = searchable && searchValue
    ? options.filter((option) =>
        option.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    : options;

  // Get selected option label(s)
  const getSelectedLabel = () => {
    if (multiple && Array.isArray(value)) {
      const selectedLabels = options
        .filter((option) => value.includes(option.value))
        .map((option) => option.label);
      return selectedLabels.length
        ? selectedLabels.join(', ')
        : placeholder;
    }
    
    const selectedOption = options.find((option) => option.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

  return (
    <div
      ref={dropdownRef}
      className={getDropdownClasses(variant, size, isOpen, disabled, className)}
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
    >
      <Button
        variant="ghost"
        size={size}
        fullWidth
        disabled={disabled}
        onClick={handleToggle}
        endIcon={isOpen ? 'close' : 'menu'}
        aria-label={`${ariaLabel || 'Dropdown'} toggle`}
      >
        {getSelectedLabel()}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg"
          >
            {searchable && (
              <div className="p-2 border-b">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={handleSearch}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Search..."
                  aria-label="Search dropdown options"
                />
              </div>
            )}

            <div
              ref={optionsRef}
              className="max-h-60 overflow-auto"
              role="listbox"
              aria-multiselectable={multiple}
            >
              {filteredOptions.map((option, index) => {
                const isSelected = multiple
                  ? Array.isArray(value) && value.includes(option.value)
                  : option.value === value;

                return (
                  <div
                    key={option.value}
                    className={clsx(
                      'px-4 py-2 cursor-pointer transition-colors',
                      {
                        'bg-primary-50': activeIndex === index,
                        'bg-primary-100': isSelected,
                        'opacity-50 cursor-not-allowed': option.disabled,
                        'hover:bg-gray-100': !option.disabled && activeIndex !== index,
                      }
                    )}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    onClick={() => handleSelect(option)}
                  >
                    <div className="flex items-center gap-2">
                      {multiple && (
                        <Icon
                          name={isSelected ? 'close' : 'add'}
                          size="sm"
                          ariaLabel={isSelected ? 'Remove option' : 'Add option'}
                        />
                      )}
                      {option.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Type exports for consuming components
export type { DropdownProps, DropdownVariant, DropdownSize, DropdownOption };