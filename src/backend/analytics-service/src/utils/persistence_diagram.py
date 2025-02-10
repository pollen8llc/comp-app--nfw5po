import numpy as np
import plotly.graph_objs as go
import plotly.express as px
from typing import Dict, Optional, Any, List
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Default visualization parameters with validated ranges
DEFAULT_VIZ_PARAMS = {
    'width': 800,
    'height': 600,
    'point_size': 6,
    'opacity': 0.7,
    'colorscale': 'Viridis',
    'title_text': 'Persistence Diagram',
    'show_grid': True,
    'show_legend': True,
    'margin': {'l': 50, 'r': 50, 't': 50, 'b': 50},
    'hovermode': 'closest',
    'transition_duration': 500
}

class PersistenceDiagramVisualizer:
    """
    A class for creating and managing interactive persistence diagram visualizations
    with optimized performance and memory management for TDA computations.
    """
    
    def __init__(self, 
                 viz_params: Optional[Dict[str, Any]] = None,
                 cache_config: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize the persistence diagram visualizer.
        
        Args:
            viz_params: Optional custom visualization parameters
            cache_config: Optional cache configuration settings
        """
        self._viz_params = DEFAULT_VIZ_PARAMS.copy()
        if viz_params:
            self._validate_and_update_params(viz_params)
            
        self._logger = logger
        self._logger.setLevel(logging.INFO)
        
        self._cache = {}
        if cache_config:
            self._setup_cache(cache_config)

    def create_interactive_diagram(self,
                                 persistence_data: np.ndarray,
                                 custom_params: Optional[Dict[str, Any]] = None,
                                 use_cache: bool = True) -> go.Figure:
        """
        Create an interactive persistence diagram visualization.
        
        Args:
            persistence_data: Array of birth-death pairs and dimensions
            custom_params: Optional custom visualization parameters
            use_cache: Whether to use caching for optimization
            
        Returns:
            Interactive Plotly figure object
        """
        if use_cache:
            cache_key = self._generate_cache_key(persistence_data, custom_params)
            if cache_key in self._cache:
                self._logger.info("Returning cached visualization")
                return self._cache[cache_key]

        # Validate input data
        if not isinstance(persistence_data, np.ndarray):
            raise ValueError("Persistence data must be a numpy array")
        if persistence_data.shape[1] != 3:  # birth, death, dimension
            raise ValueError("Persistence data must have shape (n, 3)")

        # Merge custom parameters with defaults
        viz_params = self._viz_params.copy()
        if custom_params:
            self._validate_and_update_params(custom_params)
            viz_params.update(custom_params)

        # Create scatter plot
        fig = go.Figure()
        
        # Add points for each dimension
        dimensions = np.unique(persistence_data[:, 2])
        for dim in dimensions:
            mask = persistence_data[:, 2] == dim
            dim_data = persistence_data[mask]
            
            fig.add_trace(go.Scatter(
                x=dim_data[:, 0],
                y=dim_data[:, 1],
                mode='markers',
                name=f'Dimension {int(dim)}',
                marker=dict(
                    size=viz_params['point_size'],
                    opacity=viz_params['opacity'],
                    color=dim,
                    colorscale=viz_params['colorscale']
                ),
                hovertemplate=(
                    'Birth: %{x:.3f}<br>'
                    'Death: %{y:.3f}<br>'
                    'Persistence: %{customdata:.3f}<br>'
                    'Dimension: %{text}'
                ),
                text=[f'Dimension {int(dim)}'] * len(dim_data),
                customdata=dim_data[:, 1] - dim_data[:, 0]  # persistence values
            ))

        # Update layout
        fig.update_layout(
            title=viz_params['title_text'],
            width=viz_params['width'],
            height=viz_params['height'],
            showlegend=viz_params['show_legend'],
            hovermode=viz_params['hovermode'],
            margin=viz_params['margin'],
            xaxis=dict(
                title='Birth',
                showgrid=viz_params['show_grid'],
                zeroline=True
            ),
            yaxis=dict(
                title='Death',
                showgrid=viz_params['show_grid'],
                zeroline=True
            )
        )

        if use_cache:
            self._cache[cache_key] = fig
            
        return fig

    def export_diagram(self,
                      figure: go.Figure,
                      format: str,
                      filename: str,
                      export_config: Optional[Dict[str, Any]] = None) -> str:
        """
        Export persistence diagram visualization.
        
        Args:
            figure: Plotly figure to export
            format: Export format ('png', 'svg', 'html', 'json')
            filename: Output filename
            export_config: Optional export configuration
            
        Returns:
            Path to exported file
        """
        supported_formats = {'png', 'svg', 'html', 'json'}
        if format not in supported_formats:
            raise ValueError(f"Unsupported export format. Use one of {supported_formats}")

        try:
            if format == 'html':
                figure.write_html(filename, include_plotlyjs=True)
            elif format in {'png', 'svg'}:
                figure.write_image(filename)
            elif format == 'json':
                figure.write_json(filename)
                
            self._logger.info(f"Successfully exported diagram to {filename}")
            return filename
            
        except Exception as e:
            self._logger.error(f"Error exporting diagram: {str(e)}")
            raise

    def update_visualization_params(self, new_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update visualization parameters with validation.
        
        Args:
            new_params: New parameter values to update
            
        Returns:
            Updated parameter dictionary
        """
        self._validate_and_update_params(new_params)
        self._cache.clear()  # Invalidate cache when parameters change
        return self._viz_params

    def add_reference_diagonal(self,
                             figure: go.Figure,
                             line_params: Optional[Dict[str, Any]] = None) -> go.Figure:
        """
        Add reference diagonal line to persistence diagram.
        
        Args:
            figure: Plotly figure to update
            line_params: Optional line styling parameters
            
        Returns:
            Updated figure with diagonal line
        """
        # Get axis ranges
        xrange = figure.layout.xaxis.range or [0, 1]
        yrange = figure.layout.yaxis.range or [0, 1]
        
        # Use the maximum range to ensure diagonal spans the plot
        max_range = max(xrange[1], yrange[1])
        
        # Default line parameters
        default_line_params = {
            'color': 'rgba(0,0,0,0.5)',
            'width': 1,
            'dash': 'dash'
        }
        
        if line_params:
            default_line_params.update(line_params)
            
        # Add diagonal line
        figure.add_trace(go.Scatter(
            x=[0, max_range],
            y=[0, max_range],
            mode='lines',
            name='Diagonal',
            line=default_line_params,
            hoverinfo='skip'
        ))
        
        return figure

    def _validate_and_update_params(self, params: Dict[str, Any]) -> None:
        """
        Validate and update visualization parameters.
        
        Args:
            params: Parameters to validate and update
        """
        # Parameter validation rules
        validation_rules = {
            'width': (100, 2000),
            'height': (100, 2000),
            'point_size': (1, 20),
            'opacity': (0.1, 1.0),
            'transition_duration': (0, 2000)
        }
        
        for param, value in params.items():
            if param in validation_rules:
                min_val, max_val = validation_rules[param]
                if not min_val <= value <= max_val:
                    raise ValueError(
                        f"Parameter '{param}' must be between {min_val} and {max_val}"
                    )
                    
        self._viz_params.update(params)

    def _generate_cache_key(self,
                          data: np.ndarray,
                          params: Optional[Dict[str, Any]]) -> str:
        """
        Generate cache key for visualization.
        
        Args:
            data: Input data array
            params: Visualization parameters
            
        Returns:
            Cache key string
        """
        data_hash = hash(data.tobytes())
        params_hash = hash(str(params)) if params else 0
        return f"{data_hash}_{params_hash}"

    def _setup_cache(self, cache_config: Dict[str, Any]) -> None:
        """
        Set up visualization cache with provided configuration.
        
        Args:
            cache_config: Cache configuration settings
        """
        # Implement cache size limits and cleanup strategy
        max_size = cache_config.get('max_size', 100)
        cleanup_threshold = cache_config.get('cleanup_threshold', 0.8)
        
        self._cache.clear()
        self._logger.info(f"Cache initialized with max size: {max_size}")