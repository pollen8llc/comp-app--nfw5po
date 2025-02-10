import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { debounce } from 'lodash'; // v4.17.21
import { Select } from '../common/Select';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { NodeType, EdgeType, type GraphQueryPattern } from '../../types/graph';
import { validateGraphQuery } from '../../utils/validation';

// Animation configuration
const ANIMATION_CONFIG = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' }
};

// Constants
const VALIDATION_DEBOUNCE_MS = 300;
const MAX_QUERY_COMPLEXITY = 100;

// ARIA labels for accessibility
const ARIA_LABELS = {
  builder: 'Knowledge graph query builder',
  nodeSelect: 'Select node type',
  edgeSelect: 'Select relationship type',
  conditionInput: 'Enter query condition'
};

interface QueryBuilderProps {
  onQueryChange: (pattern: GraphQueryPattern, isValid: boolean) => void;
  onExecute: () => Promise<void>;
  onSave: () => Promise<void>;
  onClear: () => void;
  className?: string;
  disabled?: boolean;
  maxComplexity?: number;
  validatePattern?: (pattern: GraphQueryPattern) => Promise<boolean>;
  'aria-label'?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  complexity: number;
}

const useQueryValidation = (
  pattern: GraphQueryPattern,
  validatePattern?: (pattern: GraphQueryPattern) => Promise<boolean>
) => {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    errors: {},
    complexity: 0
  });

  const validate = useCallback(async () => {
    const result = validateGraphQuery(pattern);
    const complexity = pattern.nodes.length + pattern.relationships.length;
    
    if (!result.success) {
      setValidation({
        isValid: false,
        errors: result.errors?.reduce((acc, err) => ({ ...acc, [err]: err }), {}),
        complexity
      });
      return;
    }

    if (validatePattern) {
      const isValid = await validatePattern(pattern);
      setValidation({
        isValid,
        errors: isValid ? {} : { custom: 'Custom validation failed' },
        complexity
      });
      return;
    }

    setValidation({ isValid: true, errors: {}, complexity });
  }, [pattern, validatePattern]);

  return { validation, validate };
};

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  onQueryChange,
  onExecute,
  onSave,
  onClear,
  className,
  disabled = false,
  maxComplexity = MAX_QUERY_COMPLEXITY,
  validatePattern,
  'aria-label': ariaLabel
}) => {
  // State management
  const [pattern, setPattern] = useState<GraphQueryPattern>({
    nodes: [{ type: NodeType.MEMBER, conditions: {} }],
    relationships: [],
    conditions: [],
    limit: 100
  });

  // Custom hooks
  const { validation, validate } = useQueryValidation(pattern, validatePattern);

  // Debounced validation and change notification
  const debouncedValidate = useMemo(
    () => debounce(async () => {
      await validate();
      onQueryChange(pattern, validation.isValid);
    }, VALIDATION_DEBOUNCE_MS),
    [validate, pattern, validation.isValid, onQueryChange]
  );

  // Pattern update handlers
  const updateNodes = useCallback((index: number, type: NodeType) => {
    setPattern(prev => ({
      ...prev,
      nodes: prev.nodes.map((node, i) => 
        i === index ? { ...node, type } : node
      )
    }));
    debouncedValidate();
  }, [debouncedValidate]);

  const updateRelationships = useCallback((index: number, type: EdgeType) => {
    setPattern(prev => ({
      ...prev,
      relationships: prev.relationships.map((rel, i) =>
        i === index ? { ...rel, type } : rel
      )
    }));
    debouncedValidate();
  }, [debouncedValidate]);

  const addNode = useCallback(() => {
    setPattern(prev => ({
      ...prev,
      nodes: [...prev.nodes, { type: NodeType.MEMBER, conditions: {} }]
    }));
    debouncedValidate();
  }, [debouncedValidate]);

  const addRelationship = useCallback(() => {
    setPattern(prev => ({
      ...prev,
      relationships: [...prev.relationships, { type: EdgeType.KNOWS, direction: 'both' }]
    }));
    debouncedValidate();
  }, [debouncedValidate]);

  return (
    <ErrorBoundary>
      <motion.div
        className={className}
        initial="initial"
        animate="animate"
        variants={ANIMATION_CONFIG}
        role="form"
        aria-label={ariaLabel || ARIA_LABELS.builder}
      >
        {/* Node Selection */}
        <div className="space-y-4">
          {pattern.nodes.map((node, index) => (
            <motion.div
              key={`node-${index}`}
              variants={ANIMATION_CONFIG}
              className="flex items-center gap-4"
            >
              <Select
                value={node.type}
                onChange={(value) => updateNodes(index, value as NodeType)}
                options={Object.values(NodeType).map(type => ({
                  value: type,
                  label: type.toLowerCase()
                }))}
                disabled={disabled}
                aria-label={ARIA_LABELS.nodeSelect}
              />
              <Input
                value={JSON.stringify(node.conditions)}
                onChange={(value) => {
                  try {
                    const conditions = JSON.parse(value as string);
                    setPattern(prev => ({
                      ...prev,
                      nodes: prev.nodes.map((n, i) =>
                        i === index ? { ...n, conditions } : n
                      )
                    }));
                    debouncedValidate();
                  } catch (e) {
                    // Handle JSON parse error
                  }
                }}
                disabled={disabled}
                aria-label={ARIA_LABELS.conditionInput}
              />
            </motion.div>
          ))}
        </div>

        {/* Relationship Selection */}
        <div className="space-y-4 mt-4">
          {pattern.relationships.map((rel, index) => (
            <motion.div
              key={`rel-${index}`}
              variants={ANIMATION_CONFIG}
              className="flex items-center gap-4"
            >
              <Select
                value={rel.type}
                onChange={(value) => updateRelationships(index, value as EdgeType)}
                options={Object.values(EdgeType).map(type => ({
                  value: type,
                  label: type.toLowerCase()
                }))}
                disabled={disabled}
                aria-label={ARIA_LABELS.edgeSelect}
              />
              <Select
                value={rel.direction}
                onChange={(value) => {
                  setPattern(prev => ({
                    ...prev,
                    relationships: prev.relationships.map((r, i) =>
                      i === index ? { ...r, direction: value as 'incoming' | 'outgoing' | 'both' } : r
                    )
                  }));
                  debouncedValidate();
                }}
                options={[
                  { value: 'both', label: 'Both Directions' },
                  { value: 'incoming', label: 'Incoming' },
                  { value: 'outgoing', label: 'Outgoing' }
                ]}
                disabled={disabled}
              />
            </motion.div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-6">
          <Button
            onClick={addNode}
            disabled={disabled || pattern.nodes.length >= maxComplexity}
            startIcon="add"
            variant="outline"
          >
            Add Node
          </Button>
          <Button
            onClick={addRelationship}
            disabled={disabled || pattern.relationships.length >= maxComplexity}
            startIcon="add"
            variant="outline"
          >
            Add Relationship
          </Button>
          <Button
            onClick={onExecute}
            disabled={disabled || !validation.isValid}
            loading={disabled}
            variant="primary"
          >
            Execute Query
          </Button>
          <Button
            onClick={onSave}
            disabled={disabled || !validation.isValid}
            variant="secondary"
          >
            Save Query
          </Button>
          <Button
            onClick={onClear}
            disabled={disabled}
            variant="ghost"
          >
            Clear
          </Button>
        </div>

        {/* Validation Feedback */}
        {Object.keys(validation.errors).length > 0 && (
          <motion.div
            variants={ANIMATION_CONFIG}
            className="mt-4 text-red-500"
            role="alert"
          >
            {Object.values(validation.errors).map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </ErrorBoundary>
  );
};

export type { QueryBuilderProps, ValidationResult };