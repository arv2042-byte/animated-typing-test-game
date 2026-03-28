import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import {
  deleteFirebaseCurrentUser,
  firebaseEnabled,
  firestoreDb,
  googleOAuthEnabled,
  loginWithEmailPassword,
  registerWithEmailPassword,
  signInWithGooglePopup,
  signOutGoogle,
  subscribeToAuth,
  updateFirebaseUserProfile,
} from "../lib/firebaseAuth";

type AuthProvider = "local" | "google";
type SessionMode = "local" | "firebase";

export type PerformanceRecord =
  | {
      id: string;
      type: "typing";
      timestamp: number;
      duration: number;
      wpm: number;
      accuracy: number;
      cpm: number;
      words: number;
    }
  | {
      id: string;
      type: "arrow";
      timestamp: number;
      duration: number;
      score: number;
      maxCombo: number;
      hits: number;
      missed: number;
      accuracy: number;
    };

export type NewPerformanceRecord =
  | {
      type: "typing";
      duration: number;
      wpm: number;
      accuracy: number;
      cpm: number;
      words: number;
    }
  | {
      type: "arrow";
      duration: number;
      score: number;
      maxCombo: number;
      hits: number;
      missed: number;
      accuracy: number;
    };

interface Account {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  provider: AuthProvider;
  passwordHash?: string;
  salt?: string;
  createdAt: number;
}

type PublicAccount = Omit<Account, "passwordHash" | "salt">;

interface FailedAttempt {
  count: number;
  lockUntil: number;
}

interface AuthResult {
  ok: boolean;
  message: string;
}

interface AuthContextType {
  user: PublicAccount | null;
  isAuthenticated: boolean;
  googleOAuthReady: boolean;
  records: PerformanceRecord[];
  registerLocal: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  loginLocal: (payload: { email: string; password: string }) => Promise<AuthResult>;
  loginGoogleLike: (payload: {
    name: string;
    gmail: string;
    photoUrl?: string;
  }) => Promise<AuthResult>;
  loginWithGoogleOAuth: () => Promise<AuthResult>;
  logout: () => void;
  updateProfile: (payload: {
    name: string;
    photoUrl?: string;
  }) => AuthResult;
  deleteAccount: (confirmText: string) => Promise<AuthResult>;
  addPerformanceRecord: (record: NewPerformanceRecord) => boolean;
}

const USERS_KEY = "typeflow-users-v1";
const SESSION_KEY = "typeflow-session-v1";
const RECORDS_KEY = "typeflow-records-v1";
const ATTEMPTS_KEY = "typeflow-login-attempts-v1";

const LOCK_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const leakedPasswordSet = new Set([
  "password",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "admin",
  "letmein",
  "welcome",
  "iloveyou",
  "abc123",
]);

const sanitizeName = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 40);
const sanitizeEmail = (value: string) => value.trim().toLowerCase();

const sanitizePhotoUrl = (value?: string) => {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("data:image/")) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:") return parsed.toString();
    return undefined;
  } catch {
    return undefined;
  }
};

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const hasPasswordStrength = (password: string) => {
  const checks = [
    password.length >= 10,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return checks.filter(Boolean).length >= 4;
};

const sha1Hex = async (value: string) => {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

const isPasswordPwned = async (password: string) => {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true",
      },
    });
    if (!response.ok) return false;
    const text = await response.text();
    return text
      .split("\n")
      .some((line) => line.split(":")[0]?.trim()?.toUpperCase() === suffix);
  } catch {
    return false;
  }
};

const generateSalt = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const derivePasswordHash = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 120000,
      salt: encoder.encode(salt),
    },
    baseKey,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
};

const getStorageUsers = () => safeJsonParse<Account[]>(localStorage.getItem(USERS_KEY), []);
const setStorageUsers = (users: Account[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const getStorageRecords = () =>
  safeJsonParse<Record<string, PerformanceRecord[]>>(localStorage.getItem(RECORDS_KEY), {});
const setStorageRecords = (records: Record<string, PerformanceRecord[]>) => {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

const getAttempts = () =>
  safeJsonParse<Record<string, FailedAttempt>>(localStorage.getItem(ATTEMPTS_KEY), {});
const setAttempts = (attempts: Record<string, FailedAttempt>) => {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
};

const toPublicAccount = (user: Account): PublicAccount => ({
  id: user.id,
  name: user.name,
  email: user.email,
  photoUrl: user.photoUrl,
  provider: user.provider,
  createdAt: user.createdAt,
});

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  googleOAuthReady: false,
  records: [],
  registerLocal: async () => ({ ok: false, message: "Not implemented" }),
  loginLocal: async () => ({ ok: false, message: "Not implemented" }),
  loginGoogleLike: async () => ({ ok: false, message: "Not implemented" }),
  loginWithGoogleOAuth: async () => ({ ok: false, message: "Not implemented" }),
  logout: () => {},
  updateProfile: () => ({ ok: false, message: "Not implemented" }),
  deleteAccount: async () => ({ ok: false, message: "Not implemented" }),
  addPerformanceRecord: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicAccount | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);
  const [localRecordsMap, setLocalRecordsMap] = useState<Record<string, PerformanceRecord[]>>(() =>
    getStorageRecords()
  );
  const [remoteRecords, setRemoteRecords] = useState<PerformanceRecord[]>([]);

  useEffect(() => {
    if (firebaseEnabled) {
      const unsubscribe = subscribeToAuth((firebaseUser) => {
        if (!firebaseUser) {
          setUser(null);
          setSessionMode(null);
          setRemoteRecords([]);
          return;
        }

        const provider = firebaseUser.providerData.some((p) => p.providerId === "google.com")
          ? "google"
          : "local";
        const createdAt = Number(
          new Date(firebaseUser.metadata.creationTime || Date.now()).getTime()
        );

        const nextUser: PublicAccount = {
          id: firebaseUser.uid,
          name: sanitizeName(firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User"),
          email: sanitizeEmail(firebaseUser.email || ""),
          photoUrl: sanitizePhotoUrl(firebaseUser.photoURL || undefined),
          provider,
          createdAt,
        };
        setUser(nextUser);
        setSessionMode("firebase");

        if (firestoreDb) {
          void setDoc(
            doc(firestoreDb, "users", firebaseUser.uid),
            {
              name: nextUser.name,
              email: nextUser.email,
              photoUrl: nextUser.photoUrl ?? null,
              provider,
              createdAt,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
      });
      return () => unsubscribe();
    }

    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    const users = getStorageUsers();
    const sessionUser = users.find((u) => u.id === sessionId);
    if (sessionUser) {
      setUser(toPublicAccount(sessionUser));
      setSessionMode("local");
    }
  }, []);

  useEffect(() => {
    if (!firestoreDb || !user || sessionMode !== "firebase") return;

    const userRecords = collection(firestoreDb, "users", user.id, "performance");
    const recordsQuery = query(userRecords, orderBy("timestamp", "asc"), limit(400));

    const unsubscribe = onSnapshot(recordsQuery, (snapshot) => {
      const next: PerformanceRecord[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Omit<PerformanceRecord, "id">;
          return {
            id: docSnap.id,
            ...data,
          } as PerformanceRecord;
        })
        .filter((item) => Number.isFinite(item.timestamp));
      setRemoteRecords(next);
    });

    return () => unsubscribe();
  }, [sessionMode, user]);

  const registerLocal = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const cleanName = sanitizeName(name);
      const cleanEmail = sanitizeEmail(email);

      if (cleanName.length < 2) {
        return { ok: false, message: "Name must be at least 2 characters." };
      }
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return { ok: false, message: "Enter a valid email address." };
      }
      if (leakedPasswordSet.has(password.toLowerCase())) {
        return {
          ok: false,
          message: "This password is commonly leaked. Please use a stronger one.",
        };
      }
      if (await isPasswordPwned(password)) {
        return {
          ok: false,
          message:
            "This password appears in known breach datasets. Please choose a different password.",
        };
      }
      if (!hasPasswordStrength(password)) {
        return {
          ok: false,
          message:
            "Use a strong password with uppercase, lowercase, number, symbol, and 10+ characters.",
        };
      }

      if (firebaseEnabled) {
        try {
          const firebaseUser = await registerWithEmailPassword(cleanEmail, password, cleanName);
          if (firestoreDb) {
            await setDoc(
              doc(firestoreDb, "users", firebaseUser.uid),
              {
                name: cleanName,
                email: cleanEmail,
                provider: "local",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              { merge: true }
            );
          }
          return { ok: true, message: "Secure account created in Firebase." };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Registration failed.";
          return { ok: false, message };
        }
      }

      const users = getStorageUsers();
      if (users.some((u) => u.email === cleanEmail)) {
        return { ok: false, message: "An account with this email already exists." };
      }

      const salt = generateSalt();
      const passwordHash = await derivePasswordHash(password, salt);
      const account: Account = {
        id: crypto.randomUUID(),
        name: cleanName,
        email: cleanEmail,
        provider: "local",
        createdAt: Date.now(),
        salt,
        passwordHash,
      };

      const nextUsers = [...users, account];
      setStorageUsers(nextUsers);
      localStorage.setItem(SESSION_KEY, account.id);
      setUser(toPublicAccount(account));
      setSessionMode("local");
      return { ok: true, message: "Account created locally." };
    },
    []
  );

  const loginLocal = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const cleanEmail = sanitizeEmail(email);
      const attempts = getAttempts();
      const entry = attempts[cleanEmail];
      const now = Date.now();

      if (entry && entry.lockUntil > now) {
        const sec = Math.ceil((entry.lockUntil - now) / 1000);
        return { ok: false, message: `Too many attempts. Try again in ${sec}s.` };
      }

      if (firebaseEnabled) {
        try {
          await loginWithEmailPassword(cleanEmail, password);
          if (attempts[cleanEmail]) {
            delete attempts[cleanEmail];
            setAttempts(attempts);
          }
          return { ok: true, message: "Logged in securely via Firebase." };
        } catch {
          const prevCount = entry?.count ?? 0;
          const nextCount = prevCount + 1;
          const lockUntil = nextCount >= MAX_ATTEMPTS ? now + LOCK_MS : 0;
          attempts[cleanEmail] = { count: lockUntil ? 0 : nextCount, lockUntil };
          setAttempts(attempts);
          return {
            ok: false,
            message:
              lockUntil > 0
                ? "Account temporarily locked after repeated failures."
                : "Invalid email or password.",
          };
        }
      }

      const users = getStorageUsers();
      const account = users.find((u) => u.email === cleanEmail && u.provider === "local");
      if (!account || !account.salt || !account.passwordHash) {
        return { ok: false, message: "Invalid email or password." };
      }

      const hash = await derivePasswordHash(password, account.salt);
      if (hash !== account.passwordHash) {
        const prevCount = entry?.count ?? 0;
        const nextCount = prevCount + 1;
        const lockUntil = nextCount >= MAX_ATTEMPTS ? now + LOCK_MS : 0;
        attempts[cleanEmail] = { count: lockUntil ? 0 : nextCount, lockUntil };
        setAttempts(attempts);
        return {
          ok: false,
          message:
            lockUntil > 0
              ? "Account temporarily locked after repeated failures."
              : "Invalid email or password.",
        };
      }

      if (attempts[cleanEmail]) {
        delete attempts[cleanEmail];
        setAttempts(attempts);
      }

      localStorage.setItem(SESSION_KEY, account.id);
      setUser(toPublicAccount(account));
      setSessionMode("local");
      return { ok: true, message: "Logged in successfully." };
    },
    []
  );

  const loginGoogleLike = useCallback(
    async ({ name, gmail, photoUrl }: { name: string; gmail: string; photoUrl?: string }) => {
      if (firebaseEnabled) {
        return {
          ok: false,
          message: "Use real Google sign-in. Firebase backend security is enabled.",
        };
      }

      const cleanEmail = sanitizeEmail(gmail);
      const cleanName = sanitizeName(name || cleanEmail.split("@")[0]);

      if (!cleanEmail.endsWith("@gmail.com")) {
        return { ok: false, message: "Use a valid Gmail address for Google profile attach." };
      }

      const users = getStorageUsers();
      const existing = users.find((u) => u.email === cleanEmail);
      if (existing) {
        const updated = {
          ...existing,
          provider: "google" as const,
          name: cleanName || existing.name,
          photoUrl: sanitizePhotoUrl(photoUrl) || existing.photoUrl,
        };
        const nextUsers = users.map((u) => (u.id === updated.id ? updated : u));
        setStorageUsers(nextUsers);
        localStorage.setItem(SESSION_KEY, updated.id);
        setUser(toPublicAccount(updated));
        setSessionMode("local");
        return { ok: true, message: "Google profile attached locally." };
      }

      const account: Account = {
        id: crypto.randomUUID(),
        name: cleanName,
        email: cleanEmail,
        provider: "google",
        createdAt: Date.now(),
        photoUrl: sanitizePhotoUrl(photoUrl),
      };
      setStorageUsers([...users, account]);
      localStorage.setItem(SESSION_KEY, account.id);
      setUser(toPublicAccount(account));
      setSessionMode("local");
      return { ok: true, message: "Google account connected locally." };
    },
    []
  );

  const loginWithGoogleOAuth = useCallback(async () => {
    if (!googleOAuthEnabled) {
      return {
        ok: false,
        message:
          "Google sign-in is not configured yet. Add Firebase env keys to enable it.",
      };
    }

    try {
      const googleUser = await signInWithGooglePopup();
      if (firestoreDb) {
        await setDoc(
          doc(firestoreDb, "users", googleUser.uid),
          {
            name: sanitizeName(googleUser.displayName || "User"),
            email: sanitizeEmail(googleUser.email || ""),
            photoUrl: sanitizePhotoUrl(googleUser.photoURL || undefined) ?? null,
            provider: "google",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
      return { ok: true, message: "Signed in with Google successfully." };
    } catch {
      return { ok: false, message: "Google sign-in was cancelled or failed." };
    }
  }, []);

  const logout = useCallback(() => {
    if (sessionMode === "firebase") {
      void signOutGoogle();
      return;
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setSessionMode(null);
  }, [sessionMode]);

  const updateProfile = useCallback(
    ({ name, photoUrl }: { name: string; photoUrl?: string }) => {
      if (!user) return { ok: false, message: "Please login first." };
      const cleanName = sanitizeName(name);
      if (cleanName.length < 2) {
        return { ok: false, message: "Name must be at least 2 characters." };
      }
      const safePhoto = sanitizePhotoUrl(photoUrl);

      if (sessionMode === "firebase") {
        void updateFirebaseUserProfile({
          displayName: cleanName,
          photoURL: safePhoto,
        });
        if (firestoreDb) {
          void setDoc(
            doc(firestoreDb, "users", user.id),
            {
              name: cleanName,
              photoUrl: safePhoto ?? null,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
        setUser((prev) => (prev ? { ...prev, name: cleanName, photoUrl: safePhoto ?? prev.photoUrl } : prev));
        return { ok: true, message: "Profile updated in secure cloud storage." };
      }

      const users = getStorageUsers();
      const target = users.find((u) => u.id === user.id);
      if (!target) return { ok: false, message: "Account not found." };

      const updated: Account = {
        ...target,
        name: cleanName,
        photoUrl: safePhoto || target.photoUrl,
      };
      const nextUsers = users.map((u) => (u.id === user.id ? updated : u));
      setStorageUsers(nextUsers);
      setUser(toPublicAccount(updated));
      return { ok: true, message: "Profile updated." };
    },
    [sessionMode, user]
  );

  const deleteAccount = useCallback(
    async (confirmText: string) => {
      if (!user) return { ok: false, message: "No account logged in." };
      if (confirmText.trim().toUpperCase() !== "DELETE") {
        return { ok: false, message: 'Type "DELETE" to confirm account deletion.' };
      }

      if (sessionMode === "firebase") {
        try {
          if (firestoreDb) {
            const recordsRef = collection(firestoreDb, "users", user.id, "performance");
            const snap = await getDocs(recordsRef);
            await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
            await deleteDoc(doc(firestoreDb, "users", user.id));
          }
          await deleteFirebaseCurrentUser();
          setUser(null);
          setSessionMode(null);
          setRemoteRecords([]);
          return { ok: true, message: "Cloud account deleted permanently." };
        } catch {
          return {
            ok: false,
            message:
              "Deletion blocked by Firebase security session. Please log in again and retry delete.",
          };
        }
      }

      const users = getStorageUsers().filter((u) => u.id !== user.id);
      setStorageUsers(users);

      const nextRecords = { ...localRecordsMap };
      delete nextRecords[user.id];
      setStorageRecords(nextRecords);
      setLocalRecordsMap(nextRecords);

      localStorage.removeItem(SESSION_KEY);
      setUser(null);
      setSessionMode(null);
      return { ok: true, message: "Account deleted permanently." };
    },
    [localRecordsMap, sessionMode, user]
  );

  const addPerformanceRecord = useCallback(
    (record: NewPerformanceRecord) => {
      if (!user) return false;

      const nextRecord = {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      } as PerformanceRecord;

      if (sessionMode === "firebase" && firestoreDb) {
        setRemoteRecords((prev) => [...prev, nextRecord].slice(-400));
        const { id: _ignoreId, ...persistedRecord } = nextRecord;
        void addDoc(collection(firestoreDb, "users", user.id, "performance"), {
          ...persistedRecord,
        });
        return true;
      }

      const nextRecords = {
        ...localRecordsMap,
        [user.id]: [...(localRecordsMap[user.id] ?? []), nextRecord].slice(-400),
      };

      setLocalRecordsMap(nextRecords);
      setStorageRecords(nextRecords);
      return true;
    },
    [localRecordsMap, sessionMode, user]
  );

  const records = useMemo(() => {
    if (!user) return [];
    if (sessionMode === "firebase") return remoteRecords;
    return localRecordsMap[user.id] ?? [];
  }, [localRecordsMap, remoteRecords, sessionMode, user]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      googleOAuthReady: googleOAuthEnabled,
      records,
      registerLocal,
      loginLocal,
      loginGoogleLike,
      loginWithGoogleOAuth,
      logout,
      updateProfile,
      deleteAccount,
      addPerformanceRecord,
    }),
    [
      addPerformanceRecord,
      deleteAccount,
      loginGoogleLike,
      loginWithGoogleOAuth,
      loginLocal,
      logout,
      records,
      registerLocal,
      updateProfile,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);