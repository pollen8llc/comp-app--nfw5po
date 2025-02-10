"""
Test package initializer for analytics service tests providing shared test fixtures,
configuration, and utilities for both unit and integration tests.

Author: Community Management Platform Team
Version: 1.0
"""

# External imports with version specifications
import pytest  # v7.0+
import numpy as np  # v1.24+

# Internal imports
from .integration.test_analysis import TestAnalysisFixtures

# Global test configuration with validated TDA parameters and performance thresholds
TEST_CONFIG = {
    'tda_params': {
        'epsilon': 0.5,  # Range: 0.1-1.0
        'min_points': 15,  # Range: 5-50
        'dimension': 2,  # Range: 2-3
        'persistence': 0.3,  # Range: 0.1-0.9
        'distance_metric': 'euclidean'  # Options: euclidean, manhattan, cosine
    },
    'performance_thresholds': {
        'simple_query_ms': 200,  # Max response time for simple graph queries
        'complex_query_ms': 1000,  # Max response time for complex graph queries
        'entity_disambiguation_ms': 500,  # Max time for entity disambiguation
        'tda_computation_ms': 5000,  # Max time for TDA computation
        'event_import_ms': 30000,  # Max time for event data import
        'network_visualization_ms': 2000  # Max time for network visualization
    },
    'load_thresholds': {
        'simple_query_qps': 1000,  # Queries per second for simple operations
        'complex_query_qps': 100,  # Queries per second for complex operations
        'tda_computation_rps': 10,  # Requests per second for TDA computation
        'network_visualization_rps': 100  # Requests per second for visualization
    }
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest for analytics service tests with custom markers, timeouts,
    and performance thresholds.
    """
    # Register custom test markers
    config.addinivalue_line(
        "markers",
        "unit: Unit tests for individual components"
    )
    config.addinivalue_line(
        "markers",
        "integration: Integration tests for component interactions"
    )
    config.addinivalue_line(
        "markers",
        "performance: Performance benchmark tests"
    )
    config.addinivalue_line(
        "markers",
        "memory: Memory usage and optimization tests"
    )
    
    # Configure test timeouts based on performance thresholds
    config.addinivalue_line(
        "timeout",
        f"default-timeout: {TEST_CONFIG['performance_thresholds']['complex_query_ms'] / 1000.0}"
    )
    
    # Set up shared test fixtures
    config.pluginmanager.register(TestAnalysisFixtures)
    
    # Configure test reporting format
    config.option.verbose = 2
    config.option.showlocals = True
    
    # Initialize test data generators
    np.random.seed(42)  # Ensure reproducible test data

def pytest_collection_modifyitems(config: pytest.Config, items: list) -> None:
    """
    Modify test collection to handle async tests, apply markers, and manage test ordering.
    """
    # Apply async markers to coroutine tests
    for item in items:
        if item.get_closest_marker('asyncio'):
            item.add_marker(pytest.mark.timeout(
                TEST_CONFIG['performance_thresholds']['complex_query_ms'] / 1000.0
            ))
    
    # Add performance markers to benchmark tests
    performance_tests = []
    other_tests = []
    
    for item in items:
        if "performance" in item.keywords:
            performance_tests.append(item)
            # Set performance test timeout
            item.add_marker(pytest.mark.timeout(
                TEST_CONFIG['performance_thresholds']['tda_computation_ms'] / 1000.0
            ))
        else:
            other_tests.append(item)
    
    # Reorder tests to run performance tests last
    items[:] = other_tests + performance_tests
    
    # Skip performance tests in CI unless explicitly enabled
    if config.getoption("--ci", default=False):
        skip_perf = pytest.mark.skip(reason="Performance tests skipped in CI")
        for item in performance_tests:
            item.add_marker(skip_perf)
    
    # Apply resource quotas to performance-intensive tests
    for item in performance_tests:
        item.add_marker(pytest.mark.limit_memory("2GB"))