"""
Initialization module for the analytics service utilities package.
Provides a centralized entry point for all utility functions related to graph operations,
TDA computations, and persistence diagram visualizations.

Author: Community Management Platform Team
Version: 1.0.0
"""

import logging
import warnings
from typing import List

# Internal imports with explicit version control
from .graph_utils import (  # v1.0
    convert_to_distance_matrix,
    batch_process_graph,
    compute_graph_embedding,
    normalize_graph_metrics
)

from .persistence_diagram import (  # v1.0
    plot_persistence_diagram,
    compute_diagram_statistics,
    PersistenceDiagramVisualizer
)

# Package metadata
__version__ = '1.0.0'
__author__ = 'Community Management Platform Team'

# Define public API
__all__: List[str] = [
    'convert_to_distance_matrix',
    'batch_process_graph', 
    'compute_graph_embedding',
    'normalize_graph_metrics',
    'plot_persistence_diagram',
    'compute_diagram_statistics',
    'PersistenceDiagramVisualizer'
]

# Configure package-level logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Configure warnings
warnings.filterwarnings('default', category=DeprecationWarning, module=__name__)

# Version compatibility checks
def _check_dependencies() -> None:
    """Verify compatibility of critical dependencies."""
    try:
        import networkx
        import numpy
        import scipy
        import plotly
        
        min_versions = {
            'networkx': '3.0',
            'numpy': '1.24',
            'scipy': '1.10',
            'plotly': '5.0'
        }
        
        for package_name, min_version in min_versions.items():
            package = globals()[package_name]
            if package.__version__ < min_version:
                warnings.warn(
                    f"{package_name} version {package.__version__} is below minimum required version {min_version}",
                    DeprecationWarning
                )
                
    except ImportError as e:
        logger.error(f"Critical dependency missing: {str(e)}")
        raise

# Run dependency checks on import
_check_dependencies()

# Initialize visualizer with default settings
default_visualizer = PersistenceDiagramVisualizer()

def get_default_visualizer() -> PersistenceDiagramVisualizer:
    """
    Get the default persistence diagram visualizer instance.
    
    Returns:
        PersistenceDiagramVisualizer: Default visualizer instance
    """
    return default_visualizer