"""
Analytics Service Configuration Module

Initializes and exports configuration settings for the Analytics Service with secure parameter loading,
validation and environment-specific overrides. Provides production-ready defaults for TDA parameters
and service infrastructure settings.

Version: 1.0.0
"""

# External imports - version specified for production readiness
import os  # built-in

# Internal imports
from .settings import TDASettings, ServiceSettings

# Environment configuration with secure default
ENV = os.getenv('ANALYTICS_SERVICE_ENV', 'development')

def load_environment_config(env: str) -> dict:
    """
    Securely loads environment-specific configuration overrides.
    
    Args:
        env (str): Environment name (development/staging/production)
        
    Returns:
        dict: Environment-specific configuration dictionary
        
    Raises:
        ValueError: If environment configuration is invalid
    """
    # Base configuration defaults optimized for production
    base_config = {
        'tda': {
            'epsilon': 0.5,
            'min_points': 15,
            'dimension': 2,
            'persistence': 0.3,
            'distance_metric': 'euclidean'
        },
        'service': {
            'host': '0.0.0.0',
            'port': 5000,
            'worker_threads': 4,
            'query_timeout': 5000,
            'max_batch_size': 1000,
            'connection_pool_size': 50,
            'retry_count': 3
        }
    }
    
    # Environment-specific overrides
    env_overrides = {
        'development': {
            'service': {
                'host': 'localhost',
                'worker_threads': 2,
                'connection_pool_size': 10
            }
        },
        'staging': {
            'service': {
                'worker_threads': 4,
                'connection_pool_size': 25
            }
        },
        'production': {
            'service': {
                'worker_threads': 8,
                'connection_pool_size': 50
            }
        }
    }
    
    # Merge base config with environment overrides
    if env in env_overrides:
        for section, settings in env_overrides[env].items():
            base_config[section].update(settings)
            
    return base_config

def validate_configuration(config: dict) -> bool:
    """
    Validates loaded configuration against defined schemas and constraints.
    
    Args:
        config (dict): Configuration dictionary to validate
        
    Returns:
        bool: True if configuration is valid
        
    Raises:
        ValueError: If configuration validation fails
    """
    # Validate TDA parameters
    if not (0.1 <= config['tda']['epsilon'] <= 1.0):
        raise ValueError("TDA epsilon must be between 0.1 and 1.0")
    
    if not (5 <= config['tda']['min_points'] <= 50):
        raise ValueError("TDA min_points must be between 5 and 50")
        
    if not config['tda']['dimension'] in [2, 3]:
        raise ValueError("TDA dimension must be 2 or 3")
        
    if not (0.1 <= config['tda']['persistence'] <= 0.9):
        raise ValueError("TDA persistence must be between 0.1 and 0.9")
        
    if not config['tda']['distance_metric'] in ['euclidean', 'manhattan', 'cosine']:
        raise ValueError("Invalid distance metric specified")
    
    # Validate service settings
    if config['service']['worker_threads'] < 1:
        raise ValueError("Worker threads must be at least 1")
        
    if config['service']['query_timeout'] < 1000:
        raise ValueError("Query timeout must be at least 1000ms")
        
    if config['service']['max_batch_size'] < 100:
        raise ValueError("Batch size must be at least 100")
        
    if config['service']['connection_pool_size'] < 5:
        raise ValueError("Connection pool size must be at least 5")
    
    return True

# Load and validate environment configuration
config = load_environment_config(ENV)
validate_configuration(config)

# Initialize settings with validated configuration
tda_settings = TDASettings()
tda_settings.epsilon = config['tda']['epsilon']
tda_settings.min_points = config['tda']['min_points']
tda_settings.dimension = config['tda']['dimension']
tda_settings.persistence_threshold = config['tda']['persistence']
tda_settings.distance_metric = config['tda']['distance_metric']

service_settings = ServiceSettings()
service_settings.host = config['service']['host']
service_settings.port = config['service']['port']
service_settings.worker_threads = config['service']['worker_threads']
service_settings.query_timeout = config['service']['query_timeout']
service_settings.max_batch_size = config['service']['max_batch_size']
service_settings.connection_pool_size = config['service']['connection_pool_size']
service_settings.retry_count = config['service']['retry_count']

# Export validated settings
__all__ = ['tda_settings', 'service_settings']