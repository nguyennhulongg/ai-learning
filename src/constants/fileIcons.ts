export const getFileIcon = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  const iconMap: Record<string, string> = {
    // Images
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',
    'webp': '🖼️',
    // Videos
    'mp4': '🎥',
    'mov': '🎥',
    'avi': '🎥',
    'mkv': '🎥',
    'webm': '🎥',
    // Audio
    'mp3': '🎵',
    'wav': '🎵',
    'ogg': '🎵',
    'flac': '🎵',
    // Documents
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'xls': '📊',
    'xlsx': '📊',
    'ppt': '📽️',
    'pptx': '📽️',
    // Code
    'js': '💻',
    'ts': '💻',
    'jsx': '💻',
    'tsx': '💻',
    'html': '💻',
    'css': '💻',
    'py': '🐍',
    'java': '☕',
    'c': '⚙️',
    'cpp': '⚙️',
    'go': '🔵',
    'rs': '🦀',
    'php': '🐘',
    'rb': '💎',
    // Archives
    'zip': '📦',
    'rar': '📦',
    '7z': '📦',
    'tar': '📦',
    // Other
    'txt': '📃',
    'json': '📋',
    'xml': '📋',
    'csv': '📋',
  };

  return iconMap[extension] || '📁';
};
