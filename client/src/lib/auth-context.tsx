import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { setAuthToken } from "./api";

export type UserRole =
  | "admin"
  | "supplier"
  | "user"
  | "purchase_team"
  | "software_team"
  | "pre_sales"
  | "contractor"
  | "product_manager"
  | "site_engineer"
  | "finance_team"
  | "vendor"
  | "client"
  | null;

interface User {
  id: string;
  username: string;
  role: UserRole;
  approved?: string;
  approvalReason?: string;
  fullName?: string;
  mobileNumber?: string;
  department?: string;
  employeeCode?: string;
  companyName?: string;
  gstNumber?: string;
  businessAddress?: string;
  createdAt?: string;
  updatedAt?: string;
  shopId?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{
    user: User;
    token: string;
  }>;
  signup: (
    username: string,
    password: string,
    role: UserRole,
    fullName?: string,
    mobileNumber?: string,
    department?: string,
    employeeCode?: string,
    companyName?: string,
    gstNumber?: string,
    businessAddress?: string
  ) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = "/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     RESTORE TOKEN ON REFRESH
  ========================= */
  useEffect(() => {
    const stored = localStorage.getItem("authToken");
    const remembered = localStorage.getItem("rememberMe") !== "false"; // default true for old sessions

    if (stored && !remembered) {
      // "Remember me" was off — only keep the session alive for as long as this
      // browser session lasts. sessionStorage is cleared when the tab/browser is
      // actually closed (but survives a plain page refresh), so its absence here
      // means the browser was closed and reopened since the user last logged in.
      const stillInSameSession = sessionStorage.getItem("authSession") === "1";
      if (!stillInSameSession) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("rememberMe");
        return;
      }
    }

    if (stored) {
      sessionStorage.setItem("authSession", "1");
      setToken(stored);
      setAuthToken(stored);
    }
  }, []);

  /* =========================
     RESTORE USER FROM TOKEN
     - Fetch user profile if token exists
  ========================= */
  useEffect(() => {
    const restoreUser = async () => {
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            // Token invalid, clear it
            setToken(null);
            localStorage.removeItem("authToken");
          }
        } catch (err) {
          console.warn("Failed to restore user from token", err);
        }
      }
    };
    restoreUser();
  }, [token]);

  /* =========================
     SYNC TOKEN
  ========================= */
  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem("authToken", token);
    }
  }, [token]);

  /* =========================
     LOGIN
     - NO ROLE FROM FRONTEND
     - RETURNS { user, token }
  ========================= */
  const login = async (username: string, password: string, rememberMe: boolean = true) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let msg = "Login failed";
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(msg);
      }

      const data = await res.json();

      const userObj: User = data.user;
      const authToken: string = data.token;

      setUser(userObj);
      setToken(authToken);
      try {
        localStorage.setItem("rememberMe", rememberMe ? "true" : "false");
        sessionStorage.setItem("authSession", "1");
      } catch {
        /* ignore */
      }

      return { user: userObj, token: authToken };
    } catch (err: any) {
      setError(err?.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================
     SIGNUP
     - NO AUTO LOGIN
     - NO TOKEN STORAGE
  ========================= */
  const signup = async (
    username: string,
    password: string,
    role: UserRole,
    fullName?: string,
    mobileNumber?: string,
    department?: string,
    employeeCode?: string,
    companyName?: string,
    gstNumber?: string,
    businessAddress?: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          role: role || "user",
          fullName: fullName || "",
          mobileNumber: mobileNumber || "",
          department: department || "",
          employeeCode: employeeCode || "",
          companyName: companyName || "",
          gstNumber: gstNumber || "",
          businessAddress: businessAddress || "",
        }),
      });

      if (!res.ok) {
        let msg = "Signup failed";
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(msg);
      }

      // ✅ backend returns ONLY user (no token)
      await res.json();

      // ❌ DO NOT set user
      // ❌ DO NOT set token
    } catch (err: any) {
      setError(err?.message || "Signup failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================
     LOGOUT
  ========================= */
  const logout = () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem("authToken");
      localStorage.removeItem("rememberMe");
      sessionStorage.removeItem("authSession");
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        signup,
        logout,
        isLoading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}