import type { Request, Response, NextFunction } from "express";
import { extractTokenFromHeader, verifyToken } from "./auth";
import { query } from "./db/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader =
    (req.headers.authorization as string | undefined) ||
    ((req.headers as any).Authorization as string | undefined);

  console.log("[authMiddleware] authorization header:", authHeader);

  let token = extractTokenFromHeader(authHeader);
  
  // FALLBACK to query parameter (useful for <img>, <a>, and direct downloads)
  if (!token && req.query.token) {
    token = req.query.token as string;
    console.log("[authMiddleware] using token from query param");
  }

  if (!token) {
    console.log("[authMiddleware] no token provided");
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    console.log(
      "[authMiddleware] token verification failed for token:",
      token.substring(0, 20) + "..."
    );
    res.status(401).json({ message: "Unauthorized: Invalid token" });
    return;
  }

  console.log(
    "[authMiddleware] token verified for user:",
    decoded.username,
    "role:",
    decoded.role
  );

  req.user = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
  };

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log(
      "[requireRole] checking user role:",
      req.user.role,
      "allowed roles:",
      roles,
      "includes?",
      roles.includes(req.user.role)
    );

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      return;
    }

    next();
  };
}

export function requireRoleOrPermission(roles: string[], permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (roles.includes(req.user.role)) {
      next();
      return;
    }

    try {
      const check = await query(
        `SELECT 1 FROM user_sidebar_permissions WHERE user_id = $1 AND module_name = $2`,
        [req.user.id, permission]
      );
      if (check.rows.length > 0) {
        next();
        return;
      }
    } catch (e) {
      console.error("[requireRoleOrPermission] DB error:", e);
    }

    res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  };
}
