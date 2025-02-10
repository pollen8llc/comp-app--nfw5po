"""
Unit test suite for Topological Data Analysis (TDA) functionality.
Tests core TDA computations, feature extraction, visualization, and performance optimization.

Author: Community Management Platform Team
Version: 1.0
"""

# External imports with version specifications
import pytest  # v7.0.0
import numpy as np  # v1.24
import time
from typing import Dict, List, Any
import logging

# Internal imports
from ...src.models.tda_model import TDAModel, DEFAULT_TDA_PARAMS
from ...src.services.tda_computation import TDAComputationService
from ...src.utils.persistence_diagram import PersistenceDiagramVisualizer

# Configure logging
logger = logging.getLogger(__name__)

class TestTDAModel:
    """Test suite for core TDA model functionality."""
    
    def setup_method(self):
        """Set up test environment with model initialization and test data."""
        self._model = TDAModel()
        self._test_data = self._generate_test_data()
        self._memory_tracker = {'initial': 0, 'peak': 0}
        
    def _generate_test_data(self, size: int = 100) -> np.ndarray:
        """Generate synthetic test data with known topological features."""
        # Create circular pattern
        t = np.linspace(0, 2*np.pi, size)
        circle = np.column_stack((np.cos(t), np.sin(t)))
        
        # Add noise
        noise = np.random.normal(0, 0.1, circle.shape)
        data = circle + noise
        
        # Add dimension column
        dimensions = np.zeros(size)
        data = np.column_stack((data, dimensions))
        
        return data

    @pytest.mark.timeout(5)
    def test_compute_persistence_homology(self):
        """Test persistence homology computation with performance validation."""
        # Create test distance matrix
        distance_matrix = np.random.rand(50, 50)
        np.fill_diagonal(distance_matrix, 0)
        distance_matrix = np.maximum(distance_matrix, distance_matrix.T)
        
        # Record initial memory
        initial_memory = self._get_memory_usage()
        
        # Time the computation
        start_time = time.time()
        persistence_diagram = self._model.compute_persistence_homology(distance_matrix)
        computation_time = time.time() - start_time
        
        # Verify output shape and values
        assert isinstance(persistence_diagram, np.ndarray)
        assert persistence_diagram.shape[1] == 2  # birth-death pairs
        assert np.all(persistence_diagram[:, 1] >= persistence_diagram[:, 0])  # death >= birth
        
        # Validate computation time
        assert computation_time < 2.0, "Computation exceeded 2 second limit"
        
        # Check memory usage
        peak_memory = self._get_memory_usage()
        memory_increase = peak_memory - initial_memory
        assert memory_increase < 100 * 1024 * 1024, "Memory usage exceeded 100MB limit"
        
        # Verify cache effectiveness
        cached_result = self._model.compute_persistence_homology(distance_matrix)
        assert np.array_equal(persistence_diagram, cached_result)

    def test_extract_topological_features(self):
        """Test feature extraction from persistence diagram."""
        # Generate sample persistence diagram
        persistence_diagram = np.array([
            [0.0, 0.5],
            [0.1, 0.8],
            [0.2, 0.6],
            [0.3, 0.9]
        ])
        
        # Extract features
        features = self._model.extract_topological_features(persistence_diagram)
        
        # Verify feature structure
        assert isinstance(features, dict)
        assert 'betti_numbers' in features
        assert 'persistence_entropy' in features
        assert 'significant_features' in features
        assert 'statistics' in features
        
        # Validate feature values
        assert features['persistence_entropy'] >= 0
        assert isinstance(features['betti_numbers'], dict)
        assert len(features['significant_features']) > 0
        
        # Statistical validation
        stats = features['statistics']
        assert 0 <= stats['mean_persistence'] <= 1
        assert stats['feature_count'] == len(persistence_diagram)
        
        # Test feature stability
        noisy_diagram = persistence_diagram + np.random.normal(0, 0.01, persistence_diagram.shape)
        noisy_features = self._model.extract_topological_features(noisy_diagram)
        assert abs(features['persistence_entropy'] - noisy_features['persistence_entropy']) < 0.1

    def test_tda_parameter_validation(self):
        """Test TDA parameter validation and defaults."""
        # Test epsilon validation
        with pytest.raises(ValueError):
            self._model._validate_params({'epsilon': 0.05})
        with pytest.raises(ValueError):
            self._model._validate_params({'epsilon': 1.1})
            
        # Test minPoints validation
        with pytest.raises(ValueError):
            self._model._validate_params({'minPoints': 4})
        with pytest.raises(ValueError):
            self._model._validate_params({'minPoints': 51})
            
        # Test dimension validation
        with pytest.raises(ValueError):
            self._model._validate_params({'dimension': 1})
        with pytest.raises(ValueError):
            self._model._validate_params({'dimension': 4})
            
        # Verify default parameters
        assert self._model._tda_params['epsilon'] == DEFAULT_TDA_PARAMS['epsilon']
        assert self._model._tda_params['minPoints'] == DEFAULT_TDA_PARAMS['minPoints']
        assert self._model._tda_params['dimension'] == DEFAULT_TDA_PARAMS['dimension']

class TestTDAComputationService:
    """Test suite for TDA computation service."""
    
    def setup_method(self):
        """Set up test environment for service testing."""
        self._service = TDAComputationService()
        self._network_data = self._generate_network_data()
        self._performance_metrics = {}
        
    def _generate_network_data(self, size: int = 100) -> np.ndarray:
        """Generate test network data with various topologies."""
        # Create network with multiple components
        components = []
        
        # Circular component
        t = np.linspace(0, 2*np.pi, size//2)
        circle = np.column_stack((np.cos(t), np.sin(t)))
        components.append(circle)
        
        # Linear component
        line = np.linspace(-1, 1, size//2)
        linear = np.column_stack((line, np.zeros_like(line)))
        components.append(linear)
        
        # Combine components and add noise
        data = np.vstack(components)
        noise = np.random.normal(0, 0.05, data.shape)
        data = data + noise
        
        return data

    @pytest.mark.timeout(10)
    def test_compute_network_tda(self):
        """Test network TDA computation with performance monitoring."""
        # Monitor initial resources
        initial_memory = self._get_memory_usage()
        
        # Compute TDA
        start_time = time.time()
        results = self._service.compute_network_tda(self._network_data)
        computation_time = time.time() - start_time
        
        # Verify results structure
        assert 'persistence_diagram' in results
        assert 'features' in results
        assert 'visualization' in results
        assert 'computation_time' in results
        
        # Validate computation time
        assert computation_time < 2.0, "Network TDA computation exceeded time limit"
        
        # Check resource usage
        peak_memory = self._get_memory_usage()
        memory_increase = peak_memory - initial_memory
        assert memory_increase < 200 * 1024 * 1024, "Memory usage exceeded limit"

    def test_batch_computation(self):
        """Test batch processing capabilities for large networks."""
        # Create large network dataset
        large_network = self._generate_network_data(size=1000)
        
        # Configure batch processing
        batch_size = 200
        initial_memory = self._get_memory_usage()
        
        # Process in batches
        results = self._service.batch_compute_tda(large_network, batch_size)
        
        # Verify batch results
        assert isinstance(results, dict)
        assert 'persistence_diagram' in results
        assert len(results['features']) > 0
        
        # Validate memory optimization
        peak_memory = self._get_memory_usage()
        memory_per_node = (peak_memory - initial_memory) / len(large_network)
        assert memory_per_node < 1024, "Memory usage per node exceeded limit"

    def _get_memory_usage(self) -> int:
        """Helper method to get current memory usage."""
        import psutil
        process = psutil.Process()
        return process.memory_info().rss