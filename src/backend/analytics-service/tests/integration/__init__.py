"""
Integration test package initializer for analytics service.
Provides shared test fixtures, configuration and utilities for integration testing
of graph analysis, TDA computation and network metrics.

Author: Community Management Platform Team
Version: 1.0
"""

# External imports with version specifications
import pytest  # v7.0+
import pytest_asyncio  # v0.20+
import numpy as np  # v1.24+
import networkx as nx  # v3.0+
from typing import Dict, Any

# Internal imports
from ..test_analysis import TestAnalysisFixtures

# Global test configuration constants
INTEGRATION_TEST_CONFIG = {
    'tda_params': {
        'epsilon': {
            'default': 0.5,
            'range': [0.1, 1.0],
            'step': 0.1
        },
        'min_points': {
            'default': 15,
            'range': [5, 50],
            'step': 5
        },
        'dimension': {
            'default': 2,
            'allowed': [2, 3]
        },
        'persistence': {
            'default': 0.3,
            'range': [0.1, 0.9],
            'step': 0.1
        },
        'distance_metric': {
            'default': 'euclidean',
            'allowed': ['euclidean', 'manhattan', 'cosine']
        }
    },
    'performance_thresholds': {
        'simple_query_ms': 200,
        'complex_query_ms': 1000,
        'tda_computation_ms': 5000,
        'memory_limit_mb': 4096,
        'test_timeout_s': 300
    }
}

# Test graph size parameters
TEST_GRAPH_SIZE = {
    'nodes': 1000,
    'edges': 5000,
    'min_degree': 2,
    'max_degree': 50,
    'attribute_count': 10
}

def pytest_integration_configure(config: pytest.Config) -> None:
    """
    Configure pytest specifically for analytics service integration tests
    with performance monitoring and resource management.
    
    Args:
        config: pytest configuration object
    """
    # Register custom markers
    config.addinivalue_line(
        "markers",
        "performance: mark test for performance validation"
    )
    config.addinivalue_line(
        "markers",
        "tda: mark test for TDA computation validation"
    )
    config.addinivalue_line(
        "markers",
        "network: mark test for network analysis validation"
    )
    
    # Configure test timeouts
    config.option.timeout = INTEGRATION_TEST_CONFIG['performance_thresholds']['test_timeout_s']
    
    # Set up memory monitoring
    config.option.max_memory = INTEGRATION_TEST_CONFIG['performance_thresholds']['memory_limit_mb']
    
    # Initialize test graph parameters
    config.option.test_graph_size = TEST_GRAPH_SIZE
    
    # Configure async test support
    pytest_asyncio.plugin.pytest_configure(config)
    
    # Set up performance benchmark collection
    config.option.benchmark_only = False
    config.option.benchmark_disable = False
    config.option.benchmark_max_time = INTEGRATION_TEST_CONFIG['performance_thresholds']['test_timeout_s']
    
    # Initialize cleanup handlers
    config.add_cleanup(TestAnalysisFixtures.cleanup_test_graph)
    
    # Configure detailed test reporting
    config.option.verbose = 2
    config.option.log_level = 'DEBUG'
    config.option.log_format = (
        '%(asctime)s [%(levelname)8s] %(message)s (%(filename)s:%(lineno)s)'
    )
    
    # Set up test isolation
    config.option.isolated_download = True
    
    # Initialize error handling
    config.option.reruns = 2
    config.option.reruns_delay = 1