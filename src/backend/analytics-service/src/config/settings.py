# External imports - versions specified for production readiness
import os  # built-in
from dataclasses import dataclass  # built-in
from typing import List, Dict, Any, Tuple  # built-in

# Global environment settings with secure defaults
ENV = os.getenv('ENV', 'development')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

@dataclass
class TDASettings:
    """
    Configuration settings for Topological Data Analysis (TDA) with comprehensive parameter validation.
    All parameters are validated against predefined rules to ensure computation stability.
    """
    epsilon: float
    min_points: int
    dimension: int
    persistence_threshold: float
    distance_metric: str
    _validation_rules: Dict[str, Any]

    def __init__(self):
        # Initialize validation rules for all TDA parameters
        self._validation_rules = {
            'epsilon': {'min': 0.1, 'max': 1.0, 'type': float},
            'min_points': {'min': 5, 'max': 50, 'type': int},
            'dimension': {'min': 2, 'max': 3, 'type': int},
            'persistence_threshold': {'min': 0.1, 'max': 0.9, 'type': float},
            'distance_metric': {'options': ['euclidean', 'manhattan', 'cosine']}
        }

        # Set defaults with production-ready values
        self.epsilon = 0.5
        self.min_points = 15
        self.dimension = 2
        self.persistence_threshold = 0.3
        self.distance_metric = 'euclidean'

        # Validate initial configuration
        valid, errors = self.validate()
        if not valid:
            raise ValueError(f"Invalid TDA settings: {', '.join(errors)}")

    def validate(self) -> Tuple[bool, List[str]]:
        """
        Performs comprehensive validation of all TDA parameters.
        Returns:
            Tuple[bool, List[str]]: Validation status and list of error messages
        """
        errors = []

        # Validate epsilon
        if not isinstance(self.epsilon, self._validation_rules['epsilon']['type']):
            errors.append("epsilon must be a float")
        elif not (self._validation_rules['epsilon']['min'] <= self.epsilon <= self._validation_rules['epsilon']['max']):
            errors.append(f"epsilon must be between {self._validation_rules['epsilon']['min']} and {self._validation_rules['epsilon']['max']}")

        # Validate min_points
        if not isinstance(self.min_points, self._validation_rules['min_points']['type']):
            errors.append("min_points must be an integer")
        elif not (self._validation_rules['min_points']['min'] <= self.min_points <= self._validation_rules['min_points']['max']):
            errors.append(f"min_points must be between {self._validation_rules['min_points']['min']} and {self._validation_rules['min_points']['max']}")

        # Validate dimension
        if not isinstance(self.dimension, self._validation_rules['dimension']['type']):
            errors.append("dimension must be an integer")
        elif not (self._validation_rules['dimension']['min'] <= self.dimension <= self._validation_rules['dimension']['max']):
            errors.append(f"dimension must be between {self._validation_rules['dimension']['min']} and {self._validation_rules['dimension']['max']}")

        # Validate persistence_threshold
        if not isinstance(self.persistence_threshold, self._validation_rules['persistence_threshold']['type']):
            errors.append("persistence_threshold must be a float")
        elif not (self._validation_rules['persistence_threshold']['min'] <= self.persistence_threshold <= self._validation_rules['persistence_threshold']['max']):
            errors.append(f"persistence_threshold must be between {self._validation_rules['persistence_threshold']['min']} and {self._validation_rules['persistence_threshold']['max']}")

        # Validate distance_metric
        if self.distance_metric not in self._validation_rules['distance_metric']['options']:
            errors.append(f"distance_metric must be one of {self._validation_rules['distance_metric']['options']}")

        return len(errors) == 0, errors

@dataclass
class NetworkAnalysisSettings:
    """
    Performance-optimized settings for network analysis operations with caching support.
    Includes batch processing and timeout configurations for large-scale computations.
    """
    metrics: List[str]
    max_nodes: int
    cache_ttl: int
    use_cache: bool
    batch_size: int
    computation_timeout: int

    def __init__(self):
        # Initialize with production-optimized defaults
        self.metrics = ['centrality', 'community', 'clustering']
        self.max_nodes = 10000  # Memory-optimized limit
        self.cache_ttl = 3600  # 1 hour cache lifetime
        self.use_cache = True
        self.batch_size = 1000  # Chunked processing size
        self.computation_timeout = 30000  # 30 seconds timeout

@dataclass
class DatabaseSettings:
    """
    Secure database connection settings with connection pooling and retry mechanisms.
    All sensitive information is loaded from environment variables.
    """
    host: str
    port: int
    user: str
    password: str
    database: str
    max_connections: int
    connection_timeout: int
    idle_timeout: int
    retry_limit: int
    ssl_enabled: bool

    def __init__(self):
        # Secure loading of database configuration
        self.host = os.getenv('DB_HOST', 'localhost')
        self.port = int(os.getenv('DB_PORT', '7687'))
        self.user = os.getenv('DB_USER', 'neo4j')
        self.password = os.getenv('DB_PASSWORD', '')  # Must be set in environment
        self.database = os.getenv('DB_NAME', 'neo4j')
        
        # Connection pool optimization
        self.max_connections = 50
        self.connection_timeout = 5000  # 5 seconds
        self.idle_timeout = 300  # 5 minutes
        self.retry_limit = 3
        self.ssl_enabled = True  # Enforce SSL for security

        # Validate database configuration
        if not self.password:
            raise ValueError("Database password must be set in environment variables")
        if self.port < 1 or self.port > 65535:
            raise ValueError("Invalid database port number")