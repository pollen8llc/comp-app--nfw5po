"""
Utility module providing memory-optimized helper functions for graph operations and transformations.
Implements core graph manipulation functions with sparse matrix optimization and enhanced caching.

Author: Community Management Platform Team
Version: 1.0
"""

# External imports with version specifications
import networkx as nx  # v3.0
import numpy as np  # v1.24
from scipy import sparse  # v1.10
import logging
from weakref import WeakValueDictionary
from typing import Dict, List, Any, Callable, Union, Tuple

# Internal imports
from ..models.graph_model import GraphModel

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
SUPPORTED_GRAPH_FORMATS = ["adjacency_matrix", "edge_list", "adjacency_list", "sparse_matrix"]
DEFAULT_BATCH_SIZE = 1000
MEMORY_THRESHOLD = 0.8
MAX_RETRIES = 3

def validate_graph_format(graph_data: Any, format_type: str) -> bool:
    """
    Validate input graph format and structure.
    
    Args:
        graph_data: Input graph data in any supported format
        format_type: Expected format type
        
    Returns:
        bool: Validation status
    """
    try:
        if format_type not in SUPPORTED_GRAPH_FORMATS:
            logger.error(f"Unsupported graph format: {format_type}")
            return False
            
        if format_type == "adjacency_matrix":
            if not isinstance(graph_data, (np.ndarray, sparse.spmatrix)):
                return False
            # Verify matrix properties
            return graph_data.shape[0] == graph_data.shape[1]
            
        elif format_type == "edge_list":
            if not isinstance(graph_data, list):
                return False
            # Verify edge list format
            return all(isinstance(edge, tuple) and len(edge) >= 2 for edge in graph_data)
            
        elif format_type == "adjacency_list":
            if not isinstance(graph_data, dict):
                return False
            # Verify adjacency list structure
            return all(isinstance(neighbors, list) for neighbors in graph_data.values())
            
        elif format_type == "sparse_matrix":
            return isinstance(graph_data, sparse.spmatrix)
            
        return True
        
    except Exception as e:
        logger.error(f"Error validating graph format: {str(e)}")
        return False

def convert_to_adjacency_matrix(
    graph_data: Union[nx.Graph, np.ndarray, List[Tuple]], 
    input_format: str
) -> sparse.csr_matrix:
    """
    Convert graph from various formats to optimized sparse adjacency matrix.
    
    Args:
        graph_data: Input graph data
        input_format: Format of input data
        
    Returns:
        scipy.sparse.csr_matrix: Memory-optimized sparse adjacency matrix
    """
    try:
        # Validate input
        if not validate_graph_format(graph_data, input_format):
            raise ValueError(f"Invalid graph format: {input_format}")
            
        # Convert based on input format
        if input_format == "adjacency_matrix":
            if isinstance(graph_data, np.ndarray):
                return sparse.csr_matrix(graph_data)
            return graph_data
            
        elif input_format == "edge_list":
            # Create sparse matrix from edge list
            n = max(max(edge[0], edge[1]) for edge in graph_data) + 1
            matrix = sparse.lil_matrix((n, n), dtype=np.float32)
            for edge in graph_data:
                matrix[edge[0], edge[1]] = 1
                matrix[edge[1], edge[0]] = 1  # Undirected graph
            return matrix.tocsr()
            
        elif input_format == "adjacency_list":
            # Convert adjacency list to sparse matrix
            n = len(graph_data)
            matrix = sparse.lil_matrix((n, n), dtype=np.float32)
            for node, neighbors in graph_data.items():
                for neighbor in neighbors:
                    matrix[node, neighbor] = 1
                    matrix[neighbor, node] = 1
            return matrix.tocsr()
            
        elif isinstance(graph_data, nx.Graph):
            return nx.to_scipy_sparse_matrix(graph_data)
            
        raise ValueError("Unsupported conversion")
        
    except Exception as e:
        logger.error(f"Error converting to adjacency matrix: {str(e)}")
        raise

def compute_graph_density(graph: nx.Graph) -> float:
    """
    Calculate the density of the graph with memory optimization.
    
    Args:
        graph: Input NetworkX graph
        
    Returns:
        float: Graph density value between 0 and 1
    """
    try:
        n = graph.number_of_nodes()
        if n < 2:
            return 0.0
            
        # Use sparse matrix for efficient computation
        adj_matrix = nx.to_scipy_sparse_matrix(graph)
        m = adj_matrix.nnz // 2  # Number of edges (divide by 2 for undirected graph)
        
        # Calculate density
        max_edges = (n * (n - 1)) // 2
        density = m / max_edges if max_edges > 0 else 0.0
        
        logger.debug(f"Computed graph density: {density:.4f}")
        return density
        
    except Exception as e:
        logger.error(f"Error computing graph density: {str(e)}")
        raise

def batch_process_subgraphs(
    graph: nx.Graph,
    batch_size: int = DEFAULT_BATCH_SIZE,
    process_fn: Callable = None
) -> List[Any]:
    """
    Process large graphs in batches with parallel processing and memory optimization.
    
    Args:
        graph: Input NetworkX graph
        batch_size: Size of each batch
        process_fn: Processing function to apply to each batch
        
    Returns:
        List[Any]: Aggregated results from batch processing
    """
    try:
        if not process_fn:
            raise ValueError("Processing function must be provided")
            
        # Initialize graph model for batch processing
        model = GraphModel()
        results = []
        retries = 0
        
        while retries < MAX_RETRIES:
            try:
                # Process graph in batches
                subgraphs = model.batch_process_graph(
                    batch_size=batch_size,
                    progress_callback=lambda p: logger.debug(f"Batch processing progress: {p:.2%}")
                )
                
                # Process each subgraph
                for subgraph in subgraphs:
                    result = process_fn(subgraph)
                    results.append(result)
                    
                break
                
            except MemoryError:
                retries += 1
                batch_size = batch_size // 2
                logger.warning(f"Memory error, reducing batch size to {batch_size}")
                continue
                
        if retries == MAX_RETRIES:
            raise RuntimeError("Max retries exceeded in batch processing")
            
        return results
        
    except Exception as e:
        logger.error(f"Error in batch processing: {str(e)}")
        raise

class GraphTransformer:
    """Memory-efficient class for handling graph transformations with caching."""
    
    def __init__(self, cache_size_limit: int = 1000):
        """
        Initialize transformer with optimized caching.
        
        Args:
            cache_size_limit: Maximum number of cached transformations
        """
        self._converters = {}
        self._cache = WeakValueDictionary()
        self._stats = {'hits': 0, 'misses': 0}
        
        # Register default converters
        self.register_converter("adjacency_matrix", self._convert_to_adjacency_matrix)
        self.register_converter("edge_list", self._convert_to_edge_list)
        self.register_converter("sparse_matrix", self._convert_to_sparse_matrix)
        
        logger.info(f"Initialized GraphTransformer with cache limit: {cache_size_limit}")

    def register_converter(self, format_name: str, converter_fn: Callable) -> bool:
        """
        Register a new format converter with validation.
        
        Args:
            format_name: Name of the format
            converter_fn: Converter function
            
        Returns:
            bool: Registration success status
        """
        try:
            if not callable(converter_fn):
                raise ValueError("Converter must be callable")
                
            self._converters[format_name] = converter_fn
            logger.info(f"Registered converter for format: {format_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering converter: {str(e)}")
            return False

    def transform(self, graph_data: Any, source_format: str, target_format: str) -> Any:
        """
        Transform graph between formats with optimization.
        
        Args:
            graph_data: Input graph data
            source_format: Source format
            target_format: Target format
            
        Returns:
            Any: Transformed graph data
        """
        try:
            # Validate formats
            if not (source_format in self._converters and target_format in self._converters):
                raise ValueError("Unsupported format conversion")
                
            # Check cache
            cache_key = (id(graph_data), source_format, target_format)
            if cache_key in self._cache:
                self._stats['hits'] += 1
                return self._cache[cache_key]
                
            # Convert to intermediate adjacency matrix
            adj_matrix = self._converters[source_format](graph_data)
            
            # Convert to target format
            result = self._converters[target_format](adj_matrix)
            
            # Cache result
            self._cache[cache_key] = result
            self._stats['misses'] += 1
            
            return result
            
        except Exception as e:
            logger.error(f"Error in graph transformation: {str(e)}")
            raise

    def _convert_to_adjacency_matrix(self, data: Any) -> sparse.csr_matrix:
        """Internal converter to adjacency matrix."""
        return convert_to_adjacency_matrix(data, "adjacency_matrix")

    def _convert_to_edge_list(self, matrix: sparse.spmatrix) -> List[Tuple]:
        """Internal converter to edge list."""
        return list(zip(*matrix.nonzero()))

    def _convert_to_sparse_matrix(self, data: Any) -> sparse.csr_matrix:
        """Internal converter to sparse matrix."""
        if isinstance(data, sparse.spmatrix):
            return data.tocsr()
        return sparse.csr_matrix(data)