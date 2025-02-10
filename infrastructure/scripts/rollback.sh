#!/bin/bash

# Community Management Platform Rollback Script
# Version: 1.0.0
# Requires: kubectl >= 1.24, aws-cli >= 2.0

set -euo pipefail

# Import utility functions from deploy.sh
source "$(dirname "$0")/deploy.sh"

# Global configuration
readonly NAMESPACE="community-platform"
readonly ROLLBACK_TIMEOUT=300  # seconds
readonly HEALTH_CHECK_INTERVAL=15  # seconds
readonly STABILITY_WAIT=300  # seconds

# Service deployment sequence (in reverse order for rollback)
readonly SERVICES=(
    "analytics-service"
    "event-service"
    "member-service"
    "api-gateway"
)

# Rollback a Kubernetes deployment
rollback_kubernetes() {
    local service_name=$1
    local deployment_name=$2
    
    log_info "Rolling back Kubernetes deployment for ${service_name}..."
    
    # Create rollback snapshot for audit
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local snapshot_name="${service_name}-pre-rollback-${timestamp}"
    kubectl get deployment "${deployment_name}" -n "${NAMESPACE}" -o yaml > "/tmp/${snapshot_name}.yaml"
    
    # Start health check monitoring in background
    monitor_deployment "${service_name}" 5 &
    local monitor_pid=$!
    
    # Execute rollback
    if ! kubectl rollout undo deployment/"${deployment_name}" -n "${NAMESPACE}"; then
        log_error "Failed to rollback deployment ${deployment_name}"
        kill "${monitor_pid}" 2>/dev/null || true
        return 1
    fi
    
    # Wait for rollback to complete
    if ! kubectl rollout status deployment/"${deployment_name}" -n "${NAMESPACE}" --timeout="${ROLLBACK_TIMEOUT}s"; then
        log_error "Rollback timed out for ${deployment_name}"
        kill "${monitor_pid}" 2>/dev/null || true
        return 1
    }
    
    # Verify deployment health
    if ! verify_rollback "${service_name}" "kubernetes"; then
        log_error "Health verification failed after rollback"
        kill "${monitor_pid}" 2>/dev/null || true
        return 1
    }
    
    # Clean up failed deployment resources
    cleanup_failed_deployment "${service_name}" "kubernetes"
    
    kill "${monitor_pid}" 2>/dev/null || true
    log_info "Kubernetes rollback completed successfully for ${service_name}"
    return 0
}

# Rollback an ECS service
rollback_ecs() {
    local cluster_name=$1
    local service_name=$2
    
    log_info "Rolling back ECS service ${service_name} in cluster ${cluster_name}..."
    
    # Get previous stable task definition
    local previous_task_def
    previous_task_def=$(aws ecs describe-services \
        --cluster "${cluster_name}" \
        --services "${service_name}" \
        --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition' \
        --output text)
    
    if [[ -z "${previous_task_def}" ]]; then
        log_error "Failed to retrieve previous task definition"
        return 1
    }
    
    # Create new deployment with previous task definition
    if ! aws ecs update-service \
        --cluster "${cluster_name}" \
        --service "${service_name}" \
        --task-definition "${previous_task_def}" \
        --force-new-deployment; then
        log_error "Failed to initiate ECS rollback"
        return 1
    }
    
    # Monitor deployment status
    local timeout=${ROLLBACK_TIMEOUT}
    while ((timeout > 0)); do
        local deployment_status
        deployment_status=$(aws ecs describe-services \
            --cluster "${cluster_name}" \
            --services "${service_name}" \
            --query 'services[0].deployments[0].status' \
            --output text)
        
        if [[ "${deployment_status}" == "PRIMARY" ]]; then
            break
        fi
        
        sleep "${HEALTH_CHECK_INTERVAL}"
        ((timeout-=HEALTH_CHECK_INTERVAL))
    done
    
    if ((timeout <= 0)); then
        log_error "ECS rollback timed out"
        return 1
    }
    
    # Verify service health
    if ! verify_rollback "${service_name}" "ecs"; then
        log_error "Health verification failed after ECS rollback"
        return 1
    }
    
    # Clean up resources
    cleanup_failed_deployment "${service_name}" "ecs"
    
    log_info "ECS rollback completed successfully for ${service_name}"
    return 0
}

# Verify rollback success
verify_rollback() {
    local service_name=$1
    local platform_type=$2
    
    log_info "Verifying rollback for ${service_name}..."
    
    # Check pod/task health
    local health_check_endpoint="/health"
    local health_check_port
    
    case "${service_name}" in
        "api-gateway") health_check_port=3000 ;;
        "member-service") health_check_port=4000 ;;
        "event-service") health_check_port=4001 ;;
        "analytics-service") health_check_port=5000 ;;
        *) log_error "Unknown service ${service_name}"; return 1 ;;
    esac
    
    local retry_count=0
    while ((retry_count < 3)); do
        if [[ "${platform_type}" == "kubernetes" ]]; then
            if kubectl exec -n "${NAMESPACE}" -it "deployment/${service_name}" -- \
                curl -sf "http://localhost:${health_check_port}${health_check_endpoint}" > /dev/null; then
                break
            fi
        else
            local task_id
            task_id=$(aws ecs list-tasks --cluster "${CLUSTER_NAME}" --service-name "${service_name}" --query 'taskArns[0]' --output text)
            if aws ecs execute-command --cluster "${CLUSTER_NAME}" --task "${task_id}" --container "${service_name}" \
                --command "curl -sf http://localhost:${health_check_port}${health_check_endpoint}" > /dev/null; then
                break
            fi
        fi
        ((retry_count++))
        sleep "${HEALTH_CHECK_INTERVAL}"
    done
    
    if ((retry_count >= 3)); then
        return 1
    fi
    
    # Wait for stability period
    sleep "${STABILITY_WAIT}"
    
    return 0
}

# Clean up failed deployment resources
cleanup_failed_deployment() {
    local service_name=$1
    local platform_type=$2
    
    log_info "Cleaning up failed deployment resources for ${service_name}..."
    
    if [[ "${platform_type}" == "kubernetes" ]]; then
        # Clean up failed pods
        kubectl delete pods -n "${NAMESPACE}" -l "app=${service_name},status=failed" --force
        
        # Remove failed ReplicaSets
        kubectl delete rs -n "${NAMESPACE}" -l "app=${service_name}" --field-selector status.replicas=0
        
        # Clean up any orphaned PVCs
        kubectl delete pvc -n "${NAMESPACE}" -l "app=${service_name}" --field-selector status.phase=Failed
    else
        # Deregister failed task definitions
        local failed_tasks
        failed_tasks=$(aws ecs list-task-definitions --family-prefix "${service_name}" --status INACTIVE --query 'taskDefinitionArns[]' --output text)
        for task in ${failed_tasks}; do
            aws ecs deregister-task-definition --task-definition "${task}" > /dev/null
        done
    }
    
    log_info "Cleanup completed for ${service_name}"
    return 0
}

# Main rollback function
rollback_all() {
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    }
    
    # Rollback services in reverse order
    for service in "${SERVICES[@]}"; do
        log_info "Starting rollback for ${service}..."
        
        if [[ -n "${CLUSTER_NAME:-}" ]]; then
            if ! rollback_ecs "${CLUSTER_NAME}" "${service}"; then
                log_error "ECS rollback failed for ${service}"
                exit 1
            fi
        else
            if ! rollback_kubernetes "${service}" "${service}"; then
                log_error "Kubernetes rollback failed for ${service}"
                exit 1
            fi
        fi
        
        log_info "Rollback completed for ${service}"
    done
    
    log_info "All services rolled back successfully"
}

# Parse command line arguments
case "${1:-}" in
    "rollback-all")
        rollback_all
        ;;
    "rollback-service")
        if [[ -z "${2:-}" ]]; then
            log_error "Usage: $0 rollback-service <service-name>"
            exit 1
        fi
        if [[ -n "${CLUSTER_NAME:-}" ]]; then
            rollback_ecs "${CLUSTER_NAME}" "$2"
        else
            rollback_kubernetes "$2" "$2"
        fi
        ;;
    *)
        log_error "Usage: $0 {rollback-all|rollback-service <service-name>}"
        exit 1
        ;;
esac

exit 0