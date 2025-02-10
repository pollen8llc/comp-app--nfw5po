#!/bin/bash

# Community Management Platform Deployment Script
# Version: 1.0.0
# Requires: kubectl >= 1.24, aws-cli >= 2.0

set -euo pipefail

# Global configuration
readonly NAMESPACE="community-platform"
readonly MONITORING_DURATION=60  # minutes
readonly DEPLOYMENT_TIMEOUT=300  # seconds
readonly HEALTH_CHECK_INTERVAL=15  # seconds
readonly MAX_RETRY_ATTEMPTS=3
readonly TRAFFIC_SHIFT_INCREMENT=10  # percentage
readonly ERROR_THRESHOLD=0.1  # 10% error rate threshold

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check all prerequisites before deployment
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check kubectl version
    if ! kubectl version --client --short | grep -q "v1.2[4-9]"; then
        log_error "kubectl version 1.24 or higher required"
        return 1
    fi

    # Check AWS CLI version
    if ! aws --version | grep -q "aws-cli/2"; then
        log_error "AWS CLI version 2.0 or higher required"
        return 1
    }

    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "Invalid AWS credentials"
        return 1
    }

    # Check namespace exists
    if ! kubectl get namespace "${NAMESPACE}" &>/dev/null; then
        log_error "Namespace ${NAMESPACE} does not exist"
        return 1
    }

    # Verify required secrets exist
    local required_secrets=("platform-secrets" "api-gateway-secrets")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret -n "${NAMESPACE}" "${secret}" &>/dev/null; then
            log_error "Required secret ${secret} not found"
            return 1
        fi
    done

    # Check cluster resources
    local cpu_allocatable
    cpu_allocatable=$(kubectl get nodes -o=jsonpath='{.items[*].status.allocatable.cpu}')
    if [[ -z "${cpu_allocatable}" ]]; then
        log_error "Unable to verify cluster resources"
        return 1
    }

    log_info "Prerequisites check completed successfully"
    return 0
}

# Deploy a single service with blue-green deployment strategy
deploy_service() {
    local service_name=$1
    local deployment_file=$2
    local version_label="v$(date +%Y%m%d%H%M%S)"
    
    log_info "Deploying ${service_name} (${version_label})..."

    # Create new deployment with version label
    sed "s/:latest/:${version_label}/g" "${deployment_file}" | kubectl apply -f -

    # Wait for new pods to be ready
    if ! kubectl rollout status deployment/"${service_name}" -n "${NAMESPACE}" --timeout="${DEPLOYMENT_TIMEOUT}s"; then
        log_error "Deployment of ${service_name} failed"
        return 1
    }

    # Verify health checks
    local retry_count=0
    while [[ ${retry_count} -lt ${MAX_RETRY_ATTEMPTS} ]]; do
        if kubectl exec -n "${NAMESPACE}" -it "deployment/${service_name}" -- curl -s http://localhost:${PORT}/health | grep -q "ok"; then
            break
        fi
        ((retry_count++))
        sleep "${HEALTH_CHECK_INTERVAL}"
    done

    if [[ ${retry_count} -eq ${MAX_RETRY_ATTEMPTS} ]]; then
        log_error "Health check failed for ${service_name}"
        return 1
    }

    # Progressive traffic shift
    for percentage in $(seq "${TRAFFIC_SHIFT_INCREMENT}" "${TRAFFIC_SHIFT_INCREMENT}" 100); do
        kubectl patch service "${service_name}" -n "${NAMESPACE}" -p "{\"spec\":{\"selector\":{\"version\":\"${version_label}\"},\"weight\":${percentage}}}"
        sleep 5
        
        # Monitor error rates during traffic shift
        local error_rate
        error_rate=$(kubectl exec -n "${NAMESPACE}" -it "deployment/${service_name}" -- curl -s http://localhost:${PORT}/metrics | grep "error_rate" | awk '{print $2}')
        if (( $(echo "${error_rate} > ${ERROR_THRESHOLD}" | bc -l) )); then
            log_error "Error rate threshold exceeded during traffic shift"
            rollback_deployment "${service_name}" "${version_label}"
            return 1
        fi
    done

    log_info "${service_name} deployment completed successfully"
    return 0
}

# Rollback deployment to previous version
rollback_deployment() {
    local service_name=$1
    local failed_version=$2

    log_warn "Rolling back ${service_name} deployment..."

    # Get previous stable version
    local previous_version
    previous_version=$(kubectl get deployment "${service_name}" -n "${NAMESPACE}" -o jsonpath='{.metadata.labels.stable-version}')

    # Instant traffic shift back to previous version
    kubectl patch service "${service_name}" -n "${NAMESPACE}" -p "{\"spec\":{\"selector\":{\"version\":\"${previous_version}\"}}}"

    # Scale down failed deployment
    kubectl scale deployment "${service_name}" -n "${NAMESPACE}" --replicas=0 -l "version=${failed_version}"

    # Clean up failed deployment resources
    kubectl delete deployment "${service_name}" -n "${NAMESPACE}" -l "version=${failed_version}"

    log_info "Rollback completed successfully"
    return 0
}

# Monitor deployment health
monitor_deployment() {
    local service_name=$1
    local duration=$2
    local start_time
    start_time=$(date +%s)
    local end_time=$((start_time + duration * 60))

    log_info "Monitoring ${service_name} deployment for ${duration} minutes..."

    while [[ $(date +%s) -lt ${end_time} ]]; do
        # Check pod status
        local ready_pods
        ready_pods=$(kubectl get deployment "${service_name}" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}')
        local total_pods
        total_pods=$(kubectl get deployment "${service_name}" -n "${NAMESPACE}" -o jsonpath='{.spec.replicas}')

        if [[ "${ready_pods}" != "${total_pods}" ]]; then
            log_warn "Not all pods are ready: ${ready_pods}/${total_pods}"
        fi

        # Check resource usage
        kubectl top pod -n "${NAMESPACE}" -l "app=${service_name}" --containers

        # Check error rates
        local error_rate
        error_rate=$(kubectl exec -n "${NAMESPACE}" -it "deployment/${service_name}" -- curl -s http://localhost:${PORT}/metrics | grep "error_rate" | awk '{print $2}')
        if (( $(echo "${error_rate} > ${ERROR_THRESHOLD}" | bc -l) )); then
            log_warn "High error rate detected: ${error_rate}"
        fi

        sleep "${HEALTH_CHECK_INTERVAL}"
    done

    log_info "Monitoring completed for ${service_name}"
}

# Main deployment function
deploy_all() {
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    }

    # Deploy services in order
    local services=(
        "api-gateway:../k8s/api-gateway/deployment.yaml"
        "member-service:../k8s/member-service/deployment.yaml"
        "analytics-service:../k8s/analytics-service/deployment.yaml"
    )

    for service in "${services[@]}"; do
        IFS=':' read -r service_name deployment_file <<< "${service}"
        
        if ! deploy_service "${service_name}" "${deployment_file}"; then
            log_error "Deployment failed for ${service_name}"
            exit 1
        fi

        monitor_deployment "${service_name}" "${MONITORING_DURATION}"
    done

    log_info "All services deployed successfully"
}

# Parse command line arguments
case "${1:-}" in
    "deploy")
        deploy_all
        ;;
    "rollback")
        if [[ -z "${2:-}" || -z "${3:-}" ]]; then
            log_error "Usage: $0 rollback <service-name> <version>"
            exit 1
        fi
        rollback_deployment "$2" "$3"
        ;;
    "monitor")
        if [[ -z "${2:-}" ]]; then
            log_error "Usage: $0 monitor <service-name>"
            exit 1
        fi
        monitor_deployment "$2" "${MONITORING_DURATION}"
        ;;
    *)
        log_error "Usage: $0 {deploy|rollback|monitor}"
        exit 1
        ;;
esac

exit 0