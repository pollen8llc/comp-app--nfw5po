#!/bin/bash

# Setup Monitoring Infrastructure Script
# Version: 1.0.0
# Description: Sets up comprehensive monitoring infrastructure including Prometheus, 
# Grafana, and New Relic for the Community Management Platform

set -euo pipefail

# Configuration variables
PROMETHEUS_VERSION="2.45.0"
GRAFANA_VERSION="10.0.0"
NEWRELIC_VERSION="1.45.0"
DOCKER_VERSION="24.0.0"

# Directory structure
BASE_DIR="/opt/monitoring"
PROMETHEUS_DIR="${BASE_DIR}/prometheus"
GRAFANA_DIR="${BASE_DIR}/grafana"
CONFIG_DIR="${BASE_DIR}/config"
LOG_DIR="${BASE_DIR}/logs"

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_DIR}/setup.log"
}

# Function to check command status and exit if failed
check_status() {
    if [ $? -ne 0 ]; then
        log "ERROR: $1"
        exit 1
    fi
}

# Setup Prometheus monitoring service
setup_prometheus() {
    local data_dir=$1
    local config_path=$2
    
    log "Setting up Prometheus ${PROMETHEUS_VERSION}"
    
    # Create required directories
    mkdir -p "${data_dir}"
    mkdir -p "${config_path}"
    
    # Set correct permissions
    chown -R prometheus:prometheus "${data_dir}"
    chmod 750 "${data_dir}"
    
    # Copy and validate Prometheus configuration
    cp prometheus.yml "${config_path}/"
    promtool check config "${config_path}/prometheus.yml"
    check_status "Prometheus configuration validation failed"
    
    # Start Prometheus container
    docker run -d \
        --name prometheus \
        --restart unless-stopped \
        --network monitoring \
        -p 9090:9090 \
        -v "${config_path}/prometheus.yml:/etc/prometheus/prometheus.yml" \
        -v "${data_dir}:/prometheus" \
        --memory="2g" \
        --cpu-shares=2048 \
        prom/prometheus:v${PROMETHEUS_VERSION} \
        --config.file=/etc/prometheus/prometheus.yml \
        --storage.tsdb.path=/prometheus \
        --storage.tsdb.retention.time=15d \
        --web.enable-lifecycle
    
    check_status "Failed to start Prometheus container"
    
    return 0
}

# Setup Grafana with dashboards
setup_grafana() {
    local data_dir=$1
    local dashboard_path=$2
    
    log "Setting up Grafana ${GRAFANA_VERSION}"
    
    # Create required directories
    mkdir -p "${data_dir}"
    mkdir -p "${dashboard_path}"
    
    # Set correct permissions
    chown -R grafana:grafana "${data_dir}"
    chmod 750 "${data_dir}"
    
    # Copy dashboard configurations
    cp analytics.json "${dashboard_path}/"
    
    # Start Grafana container
    docker run -d \
        --name grafana \
        --restart unless-stopped \
        --network monitoring \
        -p 3000:3000 \
        -v "${data_dir}:/var/lib/grafana" \
        -v "${dashboard_path}:/etc/grafana/provisioning/dashboards" \
        --memory="1g" \
        --cpu-shares=1024 \
        grafana/grafana-enterprise:${GRAFANA_VERSION}
    
    check_status "Failed to start Grafana container"
    
    # Configure Grafana via API
    sleep 10 # Wait for Grafana to start
    
    # Add Prometheus data source
    curl -X POST \
        -H "Content-Type: application/json" \
        -d '{"name":"Prometheus","type":"prometheus","url":"http://prometheus:9090","access":"proxy","isDefault":true}' \
        http://admin:admin@localhost:3000/api/datasources
    
    check_status "Failed to configure Grafana data source"
    
    return 0
}

# Configure metrics collection
configure_metrics() {
    local service_config=$1
    
    log "Configuring metric collection"
    
    # Configure New Relic agent
    curl -Ls https://download.newrelic.com/install/newrelic-cli/scripts/install.sh | bash
    check_status "Failed to install New Relic CLI"
    
    NEW_RELIC_API_KEY=${NEW_RELIC_API_KEY:-}
    if [ -z "${NEW_RELIC_API_KEY}" ]; then
        log "ERROR: NEW_RELIC_API_KEY environment variable not set"
        exit 1
    fi
    
    # Install New Relic infrastructure agent
    newrelic install -n infrastructure-agent-installer \
        --licenseKey "${NEW_RELIC_API_KEY}" \
        --region US
    check_status "Failed to install New Relic infrastructure agent"
    
    # Configure service-specific exporters
    docker run -d \
        --name neo4j-exporter \
        --network monitoring \
        -p 9108:9108 \
        -e NEO4J_URI=bolt://neo4j:7687 \
        bitnami/neo4j-exporter
    
    docker run -d \
        --name redis-exporter \
        --network monitoring \
        -p 9121:9121 \
        -e REDIS_ADDR=redis://redis:6379 \
        oliver006/redis_exporter
    
    return 0
}

# Verify monitoring setup
verify_setup() {
    log "Verifying monitoring setup"
    
    # Check Prometheus
    curl -s http://localhost:9090/-/healthy
    check_status "Prometheus health check failed"
    
    # Check Grafana
    curl -s http://localhost:3000/api/health
    check_status "Grafana health check failed"
    
    # Check New Relic
    newrelic diagnose
    check_status "New Relic verification failed"
    
    # Verify metric collection
    curl -s http://localhost:9090/api/v1/targets | grep -q "neo4j"
    check_status "Neo4j metrics not found"
    
    curl -s http://localhost:9090/api/v1/targets | grep -q "redis"
    check_status "Redis metrics not found"
    
    return 0
}

# Main setup process
main() {
    log "Starting monitoring infrastructure setup"
    
    # Create required directories
    mkdir -p "${LOG_DIR}"
    mkdir -p "${CONFIG_DIR}"
    
    # Create Docker network for monitoring
    docker network create monitoring 2>/dev/null || true
    
    # Setup components
    setup_prometheus "${PROMETHEUS_DIR}" "${CONFIG_DIR}/prometheus"
    setup_grafana "${GRAFANA_DIR}" "${CONFIG_DIR}/grafana/dashboards"
    configure_metrics "${CONFIG_DIR}/services"
    verify_setup
    
    log "Monitoring infrastructure setup completed successfully"
    return 0
}

# Execute main function
main
exit $?