"""
Analytics service models package initialization providing core graph analysis and TDA computation classes.
Implements lazy loading, performance monitoring, and comprehensive error handling.

Author: Community Platform Team
Version: 1.0.0
"""

import logging
import importlib
from typing import Any, Dict, Type

# Configure package-level logging
logger = logging.getLogger(__name__)

# Package metadata
__version__ = '1.0.0'
__author__ = 'Community Platform Team'

# Public exports
__all__ = ['GraphModel', 'TDAModel', 'PersistenceDiagram', 'PersistenceFeatures']

# Required package versions
REQUIRED_PACKAGES = {
    'networkx': '3.0',
    'numpy': '1.24',
    'scipy': '1.10',
    'gudhi': '3.7',
    'sklearn': '1.2'
}

def _validate_dependencies() -> bool:
    """
    Validate required dependencies and their versions.
    
    Returns:
        bool: True if all dependencies are valid
        
    Raises:
        ImportError: If dependencies are missing or invalid
    """
    try:
        for package, version in REQUIRED_PACKAGES.items():
            module = importlib.import_module(package)
            if not hasattr(module, '__version__'):
                logger.warning(f"Cannot verify version for {package}")
                continue
                
            if module.__version__.split('.')[0:2] < version.split('.')[0:2]:
                raise ImportError(
                    f"Invalid {package} version. Required: {version}, Found: {module.__version__}"
                )
                
        logger.info("All dependencies validated successfully")
        return True
        
    except ImportError as e:
        logger.error(f"Dependency validation failed: {str(e)}")
        raise

def _lazy_import(module_path: str, class_name: str) -> Type[Any]:
    """
    Implements lazy loading for model classes.
    
    Args:
        module_path: Path to module containing class
        class_name: Name of class to import
        
    Returns:
        Type[Any]: Proxy class for lazy loading
    """
    class LazyLoader:
        def __init__(self):
            self._real_class = None
            
        def __getattr__(self, name: str) -> Any:
            if self._real_class is None:
                try:
                    module = importlib.import_module(module_path)
                    self._real_class = getattr(module, class_name)
                except Exception as e:
                    logger.error(f"Error importing {class_name}: {str(e)}")
                    raise ImportError(f"Failed to load {class_name}")
                    
            return getattr(self._real_class, name)
            
    return LazyLoader

# Validate dependencies on import
_validate_dependencies()

# Lazy load model classes
GraphModel = _lazy_import('.graph_model', 'GraphModel')
TDAModel = _lazy_import('.tda_model', 'TDAModel')

# Import persistence diagram types
from .tda_model import PersistenceDiagram, PersistenceFeatures

# Initialize performance monitoring
logger.info(f"Analytics service models initialized - Version {__version__}")