#!/bin/bash

# Neo4j Enterprise Database Backup Script
# Version: 1.0.0
# Required packages: 
# - aws-cli v2.x
# - neo4j-enterprise v5.x

set -euo pipefail

# Global configuration
NEO4J_HOME="/var/lib/neo4j"
BACKUP_DIR="/backup/neo4j"
S3_BUCKET="s3://community-platform-backups"
RETENTION_DAYS=2555  # 7 years retention
KMS_KEY_ID="arn:aws:kms:region:account:key/backup-key"
MAX_RETRIES=3
BACKUP_THREADS=4
LOG_FILE="/var/log/neo4j/backup.log"
SCHEMA_FILE="../migrations/neo4j/001_initial_schema.cypher"

# Logging configuration
setup_logging() {
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Starting backup process"
}

# Error handling function
handle_error() {
    local exit_code=$?
    local line_number=$1
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Failed at line ${line_number} with exit code ${exit_code}"
    cleanup
    exit "${exit_code}"
}

trap 'handle_error ${LINENO}' ERR

# Check prerequisites
check_prerequisites() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Checking prerequisites"
    
    # Check Neo4j installation
    if ! command -v neo4j-admin &> /dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] neo4j-admin not found"
        return 1
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] aws-cli not found"
        return 1
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Invalid AWS credentials"
        return 1
    }

    # Check KMS key access
    if ! aws kms describe-key --key-id "${KMS_KEY_ID}" &> /dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Cannot access KMS key"
        return 1
    }

    # Check backup directory
    if [[ ! -d "${BACKUP_DIR}" ]]; then
        mkdir -p "${BACKUP_DIR}"
    fi

    # Check schema file
    if [[ ! -f "${SCHEMA_FILE}" ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Schema file not found"
        return 1
    }

    return 0
}

# Create backup
create_backup() {
    local backup_name=$1
    local backup_path="${BACKUP_DIR}/${backup_name}"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Creating backup ${backup_name}"

    # Validate current schema
    neo4j-admin database execute system "CALL db.schema.visualization()" | \
        diff - "${SCHEMA_FILE}" || {
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Schema validation failed"
        return 1
    }

    # Create backup with retries
    local attempt=1
    while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
        if neo4j-admin backup \
            --from=localhost:6362 \
            --backup-dir="${backup_path}" \
            --threads="${BACKUP_THREADS}" \
            --check-consistency=true \
            --verbose; then
            break
        fi
        
        echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] Backup attempt ${attempt} failed"
        ((attempt++))
        sleep $((2 ** attempt))
    done

    if [[ ${attempt} -gt ${MAX_RETRIES} ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Backup failed after ${MAX_RETRIES} attempts"
        return 1
    fi

    # Create backup metadata
    cat > "${backup_path}/metadata.json" <<EOF
{
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "neo4j_version": "$(neo4j --version)",
    "schema_version": "$(sha256sum ${SCHEMA_FILE} | cut -d' ' -f1)",
    "backup_type": "full",
    "checksum": "$(sha256sum ${backup_path}/neo4j/* | base64)"
}
EOF

    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Backup created successfully"
    echo "${backup_path}"
}

# Encrypt backup
encrypt_backup() {
    local backup_path=$1
    local encrypted_path="${backup_path}.enc"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Encrypting backup"

    # Generate data key
    local data_key=$(aws kms generate-data-key \
        --key-id "${KMS_KEY_ID}" \
        --key-spec AES_256 \
        --output json)

    # Extract encrypted and plaintext key
    local encrypted_key=$(echo "${data_key}" | jq -r '.CiphertextBlob')
    local plaintext_key=$(echo "${data_key}" | jq -r '.Plaintext')

    # Compress and encrypt
    tar czf - "${backup_path}" | \
        openssl enc -aes-256-gcm \
        -K "${plaintext_key}" \
        -iv "$(openssl rand -hex 12)" \
        -out "${encrypted_path}"

    # Store encrypted key
    echo "${encrypted_key}" > "${encrypted_path}.key"

    # Create encryption metadata
    cat > "${encrypted_path}.meta" <<EOF
{
    "algorithm": "AES-256-GCM",
    "kms_key_id": "${KMS_KEY_ID}",
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "checksum": "$(sha256sum ${encrypted_path} | cut -d' ' -f1)"
}
EOF

    echo "${encrypted_path}"
}

# Upload to S3
upload_to_s3() {
    local encrypted_path=$1
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Uploading to S3"

    local backup_date=$(date '+%Y/%m/%d')
    local s3_path="${S3_BUCKET}/${backup_date}/$(basename ${encrypted_path})"

    # Upload encrypted backup with multipart
    aws s3 cp "${encrypted_path}" "${s3_path}" \
        --storage-class GLACIER \
        --metadata "retention=${RETENTION_DAYS}" \
        --expected-size $(stat -f%z "${encrypted_path}") \
        --sse aws:kms \
        --sse-kms-key-id "${KMS_KEY_ID}"

    # Upload metadata files
    aws s3 cp "${encrypted_path}.key" "${s3_path}.key"
    aws s3 cp "${encrypted_path}.meta" "${s3_path}.meta"

    # Verify upload
    if ! aws s3api head-object --bucket "${S3_BUCKET#s3://}" --key "${backup_date}/$(basename ${encrypted_path})"; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Upload verification failed"
        return 1
    fi

    return 0
}

# Cleanup old backups
cleanup_old_backups() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Cleaning up old backups"

    # List old backups
    aws s3 ls "${S3_BUCKET}" --recursive | \
        awk -v date="$(date -d"-${RETENTION_DAYS} days" '+%Y-%m-%d')" '$1 <= date' | \
        while read -r line; do
            local key=$(echo "${line}" | awk '{print $4}')
            aws s3 rm "${S3_BUCKET}/${key}"
            aws s3 rm "${S3_BUCKET}/${key}.key"
            aws s3 rm "${S3_BUCKET}/${key}.meta"
        done

    # Cleanup local backup directory
    find "${BACKUP_DIR}" -type f -mtime +7 -delete

    return 0
}

# Cleanup temporary files
cleanup() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Performing cleanup"
    
    # Secure deletion of temporary files
    find "${BACKUP_DIR}" -type f -name "*.tmp" -exec shred -u {} \;
    
    # Archive logs older than 30 days
    find "$(dirname ${LOG_FILE})" -type f -name "backup-*.log" -mtime +30 \
        -exec gzip {} \; \
        -exec mv {}.gz "${BACKUP_DIR}/logs/" \;
}

# Main function
main() {
    setup_logging
    
    if ! check_prerequisites; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Prerequisites check failed"
        exit 1
    }

    local backup_name="backup-$(date '+%Y%m%d-%H%M%S')"
    local backup_path=""
    local encrypted_path=""

    # Create backup
    backup_path=$(create_backup "${backup_name}")
    if [[ $? -ne 0 ]]; then
        exit 1
    fi

    # Encrypt backup
    encrypted_path=$(encrypt_backup "${backup_path}")
    if [[ $? -ne 0 ]]; then
        exit 1
    fi

    # Upload to S3
    if ! upload_to_s3 "${encrypted_path}"; then
        exit 1
    fi

    # Cleanup old backups
    if ! cleanup_old_backups; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] Cleanup of old backups failed"
    fi

    # Final cleanup
    cleanup

    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Backup process completed successfully"
    return 0
}

main "$@"