
import type { NextFunction, Request, Response } from 'express'

/**
 * CORS 中间件
 * @param allowOrigins - 允许的源列表，或者 '*' 表示所有源
 * @param withCredentials - 是否允许携带凭证（cookie）
 */
export function cors(
  allowOrigins: string[] | '*' = '*',
  withCredentials: boolean = true
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin

    /** 处理允许的源 */
    if (allowOrigins === '*') {
      /**
       * 如果允许携带凭证，不能使用 '*'，必须指定具体的 origin
       * 这是浏览器的安全限制
       */
      if (withCredentials && origin) {
        res.header('Access-Control-Allow-Origin', origin)
      }
      else {
        res.header('Access-Control-Allow-Origin', '*')
      }
    }
    else if (origin && allowOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin)
    }

    /** 允许携带 cookie */
    if (withCredentials) {
      res.header('Access-Control-Allow-Credentials', 'true')
    }

    /** 预检请求 */
    if (req.method === 'OPTIONS') {
      res.header(
        'Access-Control-Allow-Methods',
        req.headers['access-control-request-method'] || 'GET,POST,PUT,DELETE,OPTIONS'
      )
      res.header(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type,Authorization,mcp-session-id'
      )
      /** 缓存预检结果 24 小时 */
      res.header('Access-Control-Max-Age', '86400')
      res.status(200).end()
      return
    }

    next()
  }
}