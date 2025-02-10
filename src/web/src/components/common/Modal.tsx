import React, { useEffect, useRef } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Button } from './Button';
import { Icon } from './Icon';

// Modal size constants
export const MODAL_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
type ModalSize = typeof MODAL_SIZES[number];

// Animation variants following Material Design motion principles
const ANIMATION_VARIANTS = {
  overlay: {
    visible: { opacity: 1, transition: { duration: 0.2 } },
    hidden: { opacity: 0, transition: { duration: 0.2 } },
  },
  modal: {
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: 20,
      transition: {
        duration: 0.2,
      },
    },
  },
};

interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Modal size variant */
  size?: ModalSize;
  /** Additional CSS classes */
  className?: string;
  /** Show close button */
  showCloseButton?: boolean;
  /** Modal footer content */
  footer?: React.ReactNode;
  /** Close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Accessible label */
  ariaLabel?: string;
  /** ID of element describing modal */
  ariaDescribedby?: string;
  /** Custom header content */
  headerContent?: React.ReactNode;
}

/**
 * Generates modal class names based on size and custom classes
 */
const getModalClasses = (size: ModalSize, className?: string): string => {
  return clsx(
    // Base styles
    'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl',
    'flex flex-col max-h-[90vh] outline-none',
    // Size variants
    {
      'w-full max-w-sm': size === 'sm',
      'w-full max-w-md': size === 'md',
      'w-full max-w-lg': size === 'lg',
      'w-full max-w-xl': size === 'xl',
    },
    // Custom classes
    className
  );
};

/**
 * Modal component that follows Material Design 3.0 principles
 * with enhanced accessibility and animation features
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
  showCloseButton = true,
  footer,
  closeOnOverlayClick = true,
  ariaLabel,
  ariaDescribedby,
  headerContent,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose]);

  // Manage focus trap
  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();

      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore focus and scroll
      previousFocus.current?.focus();
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            variants={ANIMATION_VARIANTS.overlay}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title}
            aria-describedby={ariaDescribedby}
            className={getModalClasses(size, className)}
            variants={ANIMATION_VARIANTS.modal}
            initial="hidden"
            animate="visible"
            exit="hidden"
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              {headerContent || (
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  ariaLabel="Close modal"
                >
                  <Icon name="close" size="sm" ariaLabel="Close" />
                </Button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Type exports
export type { ModalProps, ModalSize };