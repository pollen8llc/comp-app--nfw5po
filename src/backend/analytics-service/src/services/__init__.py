"""
Analytics Service Package Initialization

Provides thread-safe initialization and exports for core analytics service classes
including graph analysis, network metrics computation, and TDA analysis.

Author: Community Management Platform Team
Version: 1.0.0
"""

# External imports with version specifications
import logging  # built-in
import threading  # built-in
import atexit  # built-in

# Internal service imports
from .graph_analysis import GraphAnalysisService
from .network_metrics import NetworkMetricsService
from .tda_computation import TDAComputationService

# Initialize package-level logger
logger = logging.getLogger(__name__)

# Thread-safe service initialization lock
_service_lock = threading.Lock()

# Service instance cache
_initialized_services = {}

# Package version
__version__ = '1.0.0'

def _initialize_logging(log_level: str = 'INFO', 
                       log_format: str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s') -> None:
    """
    Configure production-grade logging with correlation IDs.
    
    Args:
        log_level: Logging level to set
        log_format: Log message format string
    """
    # Set numeric log level
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f'Invalid log level: {log_level}')

    # Configure root logger
    logging.basicConfig(
        level=numeric_level,
        format=log_format,
        handlers=[
            logging.StreamHandler()
        ]
    )

    # Add correlation ID filter
    class CorrelationIDFilter(logging.Filter):
        def filter(self, record):
            record.correlation_id = getattr(threading.current_thread(), 'correlation_id', None)
            return True

    logger.addFilter(CorrelationIDFilter())
    logger.info("Logging initialized with level %s", log_level)

def _cleanup_resources() -> None:
    """
    Perform cleanup of service resources during shutdown.
    """
    logger.info("Cleaning up analytics service resources")
    
    try:
        # Clean up service instances
        for service_name, service in _initialized_services.items():
            try:
                if hasattr(service, 'cleanup'):
                    service.cleanup()
                logger.debug("Cleaned up service: %s", service_name)
            except Exception as e:
                logger.error("Error cleaning up service %s: %s", service_name, str(e))

        # Clear service cache
        _initialized_services.clear()
        
        # Flush logging handlers
        for handler in logger.handlers:
            handler.flush()
            handler.close()
            
        logger.info("Resource cleanup completed")
        
    except Exception as e:
        logger.error("Error during resource cleanup: %s", str(e))

# Register cleanup handler
atexit.register(_cleanup_resources)

# Initialize logging with default configuration
_initialize_logging()

# Export service classes
__all__ = [
    'GraphAnalysisService',
    'NetworkMetricsService', 
    'TDAComputationService',
    '__version__'
]

logger.info("Analytics service package initialized (version %s)", __version__)