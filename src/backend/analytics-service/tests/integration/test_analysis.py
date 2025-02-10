"""
Integration tests for the analytics service graph analysis functionality.
Tests TDA computation, network metrics, and large-scale graph processing with performance validation.

Author: Community Management Platform Team
Version: 1.0
"""

# External imports with version specifications
import pytest  # v7.0
import numpy as np  # v1.24
import networkx as nx  # v3.0
import asyncio
from memory_profiler import profile  # v0.60
from datetime import datetime
from typing import Dict, List, Any

# Internal imports
from ...src.services.graph_analysis import GraphAnalysisService
from ...src.models.tda_model import TDAModel, DEFAULT_TDA_PARAMS

# Test configuration constants
TEST_GRAPH_SIZES = [100, 500, 1000, 5000]

TEST_TDA_PARAMS = {
    'epsilon': [0.1, 0.5, 1.0],
    'minPoints': [5, 15, 50],
    'dimension': [2, 3],
    'persistenceThreshold': [0.1, 0.3, 0.9],
    'distanceMetric': ['euclidean', 'manhattan', 'cosine']
}

PERFORMANCE_THRESHOLDS = {
    'small_graph_ms': 500,
    'medium_graph_ms': 1000,
    'large_graph_ms': 2000,
    'max_memory_mb': 1024
}

def generate_test_graph(size: int, edge_probability: float = 0.1,
                       node_attributes: Dict = None,
                       edge_weights: Dict = None) -> nx.Graph:
    """Generate synthetic graph data for testing."""
    # Create random graph
    graph = nx.erdos_renyi_graph(size, edge_probability)
    
    # Add node attributes
    if node_attributes:
        for node in graph.nodes():
            for attr, value_range in node_attributes.items():
                graph.nodes[node][attr] = np.random.uniform(*value_range)
    
    # Add edge weights
    if edge_weights:
        for edge in graph.edges():
            for attr, value_range in edge_weights.items():
                graph.edges[edge][attr] = np.random.uniform(*value_range)
    
    return graph

@pytest.mark.integration
class TestGraphAnalysis:
    """Integration test suite for graph analysis functionality."""
    
    def setup_method(self):
        """Set up test environment before each test."""
        self._service = GraphAnalysisService()
        self._test_graphs = {}
        self._performance_metrics = {}
        self._memory_monitor = profile
        
        # Generate test graphs of different sizes
        for size in TEST_GRAPH_SIZES:
            self._test_graphs[size] = generate_test_graph(
                size,
                node_attributes={'weight': (0, 1)},
                edge_weights={'weight': (0, 1)}
            )
    
    def teardown_method(self):
        """Clean up resources after each test."""
        self._test_graphs.clear()
        self._performance_metrics.clear()

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_graph_structure_analysis(self):
        """Test comprehensive graph structure analysis with performance validation."""
        for size, graph in self._test_graphs.items():
            start_time = datetime.now()
            
            # Perform structure analysis
            result = await self._service.analyze_graph_structure({
                'metrics': ['density', 'diameter', 'radius'],
                'include_topology': True,
                'include_communities': True
            })
            
            # Validate results structure
            assert 'metrics' in result
            assert 'topology' in result
            assert 'communities' in result
            assert 'performance' in result
            
            # Validate metrics computation
            assert 0 <= result['metrics'].get('density', 0) <= 1
            assert isinstance(result['metrics'].get('diameter'), (int, float))
            assert isinstance(result['metrics'].get('radius'), (int, float))
            
            # Validate topology results
            assert 'persistence_diagram' in result['topology']
            assert len(result['topology']['persistence_diagram']) > 0
            
            # Validate community detection
            assert 'communities' in result['communities']
            assert result['communities']['count'] > 0
            
            # Performance validation
            duration_ms = (datetime.now() - start_time).total_seconds() * 1000
            if size <= 500:
                assert duration_ms < PERFORMANCE_THRESHOLDS['small_graph_ms']
            elif size <= 2000:
                assert duration_ms < PERFORMANCE_THRESHOLDS['medium_graph_ms']
            else:
                assert duration_ms < PERFORMANCE_THRESHOLDS['large_graph_ms']

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_tda_computation(self):
        """Test TDA computation with parameter validation and performance checks."""
        test_graph = self._test_graphs[500]  # Use medium-sized graph for TDA tests
        
        for epsilon in TEST_TDA_PARAMS['epsilon']:
            for min_points in TEST_TDA_PARAMS['minPoints']:
                for dimension in TEST_TDA_PARAMS['dimension']:
                    for threshold in TEST_TDA_PARAMS['persistenceThreshold']:
                        for metric in TEST_TDA_PARAMS['distanceMetric']:
                            # Configure TDA parameters
                            tda_params = {
                                'epsilon': epsilon,
                                'minPoints': min_points,
                                'dimension': dimension,
                                'persistenceThreshold': threshold,
                                'distanceMetric': metric
                            }
                            
                            start_time = datetime.now()
                            
                            # Compute TDA
                            result = await self._service.analyze_graph_structure({
                                'include_topology': True,
                                'tda_params': tda_params
                            })
                            
                            # Validate TDA results
                            assert 'topology' in result
                            persistence_diagram = result['topology']['persistence_diagram']
                            assert isinstance(persistence_diagram, list)
                            assert len(persistence_diagram) > 0
                            
                            # Validate persistence diagram properties
                            for point in persistence_diagram:
                                assert point[1] >= point[0]  # Death >= Birth
                                assert point[1] - point[0] >= threshold
                            
                            # Performance validation
                            duration_ms = (datetime.now() - start_time).total_seconds() * 1000
                            assert duration_ms < PERFORMANCE_THRESHOLDS['medium_graph_ms']

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.memory
    async def test_large_graph_processing(self):
        """Test analysis of large graphs with batching and memory optimization."""
        large_graph = self._test_graphs[5000]
        
        # Monitor memory usage
        @self._memory_monitor
        def run_large_graph_analysis():
            return asyncio.run(self._service.analyze_graph_structure({
                'metrics': ['betweenness_centrality', 'clustering_coefficient'],
                'include_topology': True,
                'include_communities': True,
                'batch_size': 1000
            }))
        
        start_time = datetime.now()
        result = run_large_graph_analysis()
        
        # Validate results
        assert 'metrics' in result
        assert 'topology' in result
        assert 'communities' in result
        
        # Validate batch processing
        assert 'performance' in result
        assert 'batch_count' in result['performance']
        assert result['performance']['batch_count'] > 1
        
        # Performance validation
        duration_ms = (datetime.now() - start_time).total_seconds() * 1000
        assert duration_ms < PERFORMANCE_THRESHOLDS['large_graph_ms']
        
        # Memory validation
        memory_usage = result['performance'].get('max_memory_mb', 0)
        assert memory_usage < PERFORMANCE_THRESHOLDS['max_memory_mb']

    @pytest.mark.asyncio
    @pytest.mark.benchmark
    async def test_network_metrics_computation(self):
        """Test computation of network metrics with performance validation."""
        test_graph = self._test_graphs[1000]
        
        start_time = datetime.now()
        
        # Compute network metrics
        result = await self._service.analyze_graph_structure({
            'metrics': [
                'betweenness_centrality',
                'eigenvector_centrality',
                'clustering_coefficient',
                'degree_centrality',
                'closeness_centrality'
            ]
        })
        
        # Validate metric results
        assert 'metrics' in result
        for metric in result['metrics']:
            assert isinstance(result['metrics'][metric], dict)
            for node, value in result['metrics'][metric].items():
                assert 0 <= value <= 1  # All metrics should be normalized
        
        # Performance validation
        duration_ms = (datetime.now() - start_time).total_seconds() * 1000
        assert duration_ms < PERFORMANCE_THRESHOLDS['medium_graph_ms']