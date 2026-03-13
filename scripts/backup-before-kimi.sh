#!/bin/bash

# ============================================
# Backup Project Before Kimi Integration
# ============================================
# 备份整个项目代码到桌面（不包括 node_modules）
# 文件名格式：hera_one_beforeKimi_YYYYMMDD_HHMMSS.zip

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PROJECT_DIR="/Users/shuangshuangwu/Desktop/hera_one"
BACKUP_NAME="hera_one_beforeKimi_${TIMESTAMP}.zip"
BACKUP_PATH="/Users/shuangshuangwu/Desktop/${BACKUP_NAME}"

echo "============================================"
echo "Backup Project Before Kimi Integration"
echo "============================================"
echo "Timestamp: ${TIMESTAMP}"
echo "Project Directory: ${PROJECT_DIR}"
echo "Backup File: ${BACKUP_NAME}"
echo "Backup Path: ${BACKUP_PATH}"
echo ""

# 切换到项目目录
cd "${PROJECT_DIR}" || exit 1

# 创建临时排除文件列表
EXCLUDE_FILE=$(mktemp)
cat > "${EXCLUDE_FILE}" << EOF
node_modules/
.next/
.vercel/
dist/
build/
*.log
*.zip
*.tar.gz
.DS_Store
.env.local
.env.production
.env.development
*.tsbuildinfo
coverage/
.nyc_output/
*.swp
*.swo
*~
.vscode/
.idea/
EOF

echo "Excluding directories/files:"
cat "${EXCLUDE_FILE}"
echo ""

# 创建 zip 文件（排除 node_modules 和其他不需要的文件）
echo "Creating backup..."
zip -r "${BACKUP_PATH}" . \
  -x@"${EXCLUDE_FILE}" \
  -x "*.zip" \
  -x "*.tar.gz" \
  -x ".DS_Store" \
  -x ".env.local" \
  -x ".env.production" \
  -x ".env.development" \
  -x "*.log" \
  -x "*.tsbuildinfo" \
  -x "coverage/*" \
  -x ".nyc_output/*" \
  -x "*.swp" \
  -x "*.swo" \
  -x "*~" \
  -x ".vscode/*" \
  -x ".idea/*" \
  > /dev/null 2>&1

# 检查 zip 文件是否创建成功
if [ -f "${BACKUP_PATH}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
    echo "✅ Backup created successfully!"
    echo "   File: ${BACKUP_NAME}"
    echo "   Size: ${BACKUP_SIZE}"
    echo "   Location: ${BACKUP_PATH}"
    echo ""
    echo "Backup completed at: $(date)"
else
    echo "❌ Backup failed!"
    exit 1
fi

# 清理临时文件
rm -f "${EXCLUDE_FILE}"

echo "============================================"


