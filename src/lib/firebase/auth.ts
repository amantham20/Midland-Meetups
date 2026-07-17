"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { ensureAuthPersistence, getClientAuth } from "./client";
import { clearAuthSession, touchAuthSession } from "@/lib/authSession";

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  await ensureAuthPersistence();
  const result = await signInWithEmailAndPassword(
    getClientAuth(),
    email,
    password,
  );
  touchAuthSession();
  return result.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  await ensureAuthPersistence();
  const result = await createUserWithEmailAndPassword(
    getClientAuth(),
    email,
    password,
  );
  if (displayName.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  touchAuthSession();
  return result.user;
}

export async function signOut(): Promise<void> {
  clearAuthSession();
  await firebaseSignOut(getClientAuth());
}
