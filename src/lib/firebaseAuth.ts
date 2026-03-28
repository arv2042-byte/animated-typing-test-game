import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const isConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

const firebaseApp = isConfigured
  ? getApps()[0] ?? initializeApp(config)
  : null;

const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

export const googleOAuthEnabled = isConfigured;
export const firebaseEnabled = isConfigured;
export const firebaseAuth = auth;
export const firestoreDb = db;

export const signInWithGooglePopup = async (): Promise<User> => {
  if (!auth) {
    throw new Error("Google login is not configured. Add Firebase env values.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const signOutGoogle = async () => {
  if (!auth) return;
  await signOut(auth);
};

export const registerWithEmailPassword = async (
  email: string,
  password: string,
  displayName: string
): Promise<User> => {
  if (!auth) {
    throw new Error("Firebase is not configured. Add Firebase env values.");
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return credential.user;
};

export const loginWithEmailPassword = async (
  email: string,
  password: string
): Promise<User> => {
  if (!auth) {
    throw new Error("Firebase is not configured. Add Firebase env values.");
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

export const updateFirebaseUserProfile = async (payload: {
  displayName?: string;
  photoURL?: string;
}) => {
  if (!auth?.currentUser) {
    throw new Error("No active user.");
  }
  await updateProfile(auth.currentUser, payload);
};

export const deleteFirebaseCurrentUser = async () => {
  if (!auth?.currentUser) {
    throw new Error("No active user.");
  }
  await deleteUser(auth.currentUser);
};
