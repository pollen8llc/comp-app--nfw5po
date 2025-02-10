#!/bin/bash

# Neo4j Enterprise Backup Script
# Version: 1.0.0
# Description: Production-grade backup solution for Neo4j Enterprise with encryption and S3 integration
# Dependencies: neo4j-enterprise@5.x, aws-cli@2.x

set -euo pipefail

# Global Configuration
NEO4J_HOME="/var/lib/neo4j"
BACKUP_DIR="/backup/neo4j"
S3_BUCKET="s3://community-platform-backups/neo4j"
RETENTION_DAYS=2555  # 7 years retention
LOG_DIR="/var/log/neo4j"
KMS_KEY_ID="arn:aws:kms:region:account:key/backup-key"
MAX_RETRIES=5
BACKUP_TIMEOUT=3600  # 1 hour
MIN_DISK_SPACE=51200  # 50GB in MB

# Load Neo4j configuration
source "${NEO4J_HOME}/conf/neo4j.conf"

# Initialize logging
LOG_FILE="${LOG_DIR}/backup.log"
exec 1> >(logger -s -t $(basename $0)) 2>&1

log() {
    local level=$1
    shift
    echo "{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"level\":\"${level}\",\"message\":\"$*\"}" >> "${LOG_FILE}"
}

check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check required tools
    command -v neo4j-admin >/dev/null 2>&1 || { log "ERROR" "neo4j-admin not found"; exit 1; }
    command -v aws >/dev/null 2>&1 || { log "ERROR" "aws-cli not found"; exit 1; }
    
    # Check AWS credentials and KMS access
    aws sts get-caller-identity >/dev/null 2>&1 || { log "ERROR" "Invalid AWS credentials"; exit 1; }
    aws kms describe-key --key-id "${KMS_KEY_ID}" >/dev/null 2>&1 || { log "ERROR" "KMS key access failed"; exit 1; }
    
    # Check disk space
    local available_space=$(df -m "${BACKUP_DIR}" | awk 'NR==2 {print $4}')
    if [ "${available_space}" -lt "${MIN_DISK_SPACE}" ]; then
        log "ERROR" "Insufficient disk space. Required: ${MIN_DISK_SPACE}MB, Available: ${available_space}MB"
        exit 1
    fi
    
    # Verify directories and permissions
    for dir in "${BACKUP_DIR}" "${LOG_DIR}"; do
        if [ ! -d "${dir}" ]; then
            mkdir -p "${dir}"
            chmod 700 "${dir}"
        fi
    done
    
    # Check Neo4j connectivity
    neo4j-admin server status >/dev/null 2>&1 || { log "ERROR" "Neo4j server not accessible"; exit 1; }
    
    log "INFO" "Prerequisites check completed successfully"
    return 0
}

create_backup() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    log "INFO" "Starting backup creation: ${backup_name}"
    
    # Create consistent backup
    neo4j-admin backup \
        --backup-dir="${backup_path}" \
        --database=community_platform \
        --verbose \
        --consistency-check \
        --timeout="${BACKUP_TIMEOUT}" || {
            log "ERROR" "Backup creation failed"
            return 1
        }
    
    # Generate backup manifest
    {
        echo "Backup Name: ${backup_name}"
        echo "Creation Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
        echo "Neo4j Version: $(neo4j-admin --version)"
        echo "Checksum: $(sha256sum "${backup_path}"/* | base64)"
        echo "Size: $(du -sh "${backup_path}" | cut -f1)"
    } > "${backup_path}/manifest.json"
    
    log "INFO" "Backup created successfully: ${backup_path}"
    echo "${backup_path}"
}

encrypt_backup() {
    local backup_path=$1
    local encrypted_path="${backup_path}.encrypted"
    log "INFO" "Starting backup encryption: ${backup_path}"
    
    # Generate data key
    local data_key=$(aws kms generate-data-key \
        --key-id "${KMS_KEY_ID}" \
        --key-spec AES_256 \
        --output json)
    
    # Extract plaintext and encrypted key
    local plaintext_key=$(echo "${data_key}" | jq -r '.Plaintext')
    local encrypted_key=$(echo "${data_key}" | jq -r '.CiphertextBlob')
    
    # Encrypt backup using AES-256-GCM
    openssl enc -aes-256-gcm \
        -K "${plaintext_key}" \
        -iv "$(openssl rand -hex 12)" \
        -in "${backup_path}.tar" \
        -out "${encrypted_path}" || {
            log "ERROR" "Encryption failed"
            secure_cleanup "${plaintext_key}"
            return 1
        }
    
    # Store encryption metadata
    {
        echo "Encryption Algorithm: AES-256-GCM"
        echo "KMS Key ID: ${KMS_KEY_ID}"
        echo "Encrypted Data Key: ${encrypted_key}"
        echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    } > "${encrypted_path}.meta"
    
    secure_cleanup "${plaintext_key}"
    log "INFO" "Backup encrypted successfully: ${encrypted_path}"
    echo "${encrypted_path}"
}

upload_to_s3() {
    local encrypted_backup_path=$1
    log "INFO" "Starting S3 upload: ${encrypted_backup_path}"
    
    # Calculate checksums
    local checksum=$(sha256sum "${encrypted_backup_path}" | cut -d' ' -f1)
    
    # Upload with server-side encryption
    aws s3 cp "${encrypted_backup_path}" "${S3_BUCKET}/" \
        --expected-size $(stat -f%z "${encrypted_backup_path}") \
        --sse aws:kms \
        --sse-kms-key-id "${KMS_KEY_ID}" \
        --metadata "checksum=${checksum}" || {
            log "ERROR" "S3 upload failed"
            return 1
        }
    
    # Verify upload
    local s3_checksum=$(aws s3api head-object \
        --bucket $(echo "${S3_BUCKET}" | cut -d'/' -f3) \
        --key $(basename "${encrypted_backup_path}") \
        --query Metadata.checksum --output text)
    
    if [ "${checksum}" != "${s3_checksum}" ]; then
        log "ERROR" "Upload verification failed"
        return 1
    }
    
    log "INFO" "Backup uploaded successfully to S3"
    return 0
}

cleanup_old_backups() {
    log "INFO" "Starting cleanup of old backups"
    
    # List and delete old backups
    aws s3 ls "${S3_BUCKET}/" | while read -r line; do
        local backup_date=$(echo "${line}" | awk '{print $1" "$2}')
        local backup_age=$(( ( $(date +%s) - $(date -d "${backup_date}" +%s) ) / 86400 ))
        
        if [ "${backup_age}" -gt "${RETENTION_DAYS}" ]; then
            local backup_file=$(echo "${line}" | awk '{print $4}')
            log "INFO" "Deleting old backup: ${backup_file}"
            aws s3 rm "${S3_BUCKET}/${backup_file}" || log "WARNING" "Failed to delete: ${backup_file}"
        fi
    done
    
    log "INFO" "Old backup cleanup completed"
    return 0
}

cleanup() {
    log "INFO" "Starting cleanup"
    
    # Remove temporary files
    find "${BACKUP_DIR}" -type f -mtime +1 -delete
    
    # Rotate logs
    if [ -f "${LOG_FILE}" ]; then
        mv "${LOG_FILE}" "${LOG_FILE}.$(date +%Y%m%d)"
        gzip "${LOG_FILE}.$(date +%Y%m%d)"
    fi
    
    # Remove old logs
    find "${LOG_DIR}" -name "backup.log.*" -mtime +30 -delete
    
    log "INFO" "Cleanup completed"
    return 0
}

secure_cleanup() {
    local sensitive_data=$1
    if [ -n "${sensitive_data}" ]; then
        echo -n "" > "${sensitive_data}"
        rm -P "${sensitive_data}"
    fi
}

main() {
    log "INFO" "Starting Neo4j backup process"
    
    # Run with retries
    local retry_count=0
    while [ "${retry_count}" -lt "${MAX_RETRIES}" ]; do
        if check_prerequisites; then
            local backup_path=$(create_backup)
            if [ $? -eq 0 ]; then
                local encrypted_path=$(encrypt_backup "${backup_path}")
                if [ $? -eq 0 ]; then
                    if upload_to_s3 "${encrypted_path}"; then
                        cleanup_old_backups
                        cleanup
                        log "INFO" "Backup process completed successfully"
                        exit 0
                    fi
                fi
            fi
        fi
        
        retry_count=$((retry_count + 1))
        log "WARNING" "Retry ${retry_count}/${MAX_RETRIES}"
        sleep $((2 ** retry_count))
    done
    
    log "ERROR" "Backup process failed after ${MAX_RETRIES} retries"
    exit 1
}

# Execute main function
main