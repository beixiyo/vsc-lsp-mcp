/** 仅允许当前用户读、写和进入的目录权限 */
export const PRIVATE_DIRECTORY_MODE = 0o700

/** 仅允许当前用户读写的文件权限 */
export const PRIVATE_FILE_MODE = 0o600

/** 检查目录是否向组用户或其他用户开放时使用的权限掩码 */
export const SHARED_ACCESS_MODE_MASK = 0o077
