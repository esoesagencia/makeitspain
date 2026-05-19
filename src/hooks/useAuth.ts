"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import type { UserDocument } from "@/types";

interface AuthState {
  user: User | null;
  userDoc: UserDocument | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    userDoc: null,
    loading: true,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, userDoc: null, loading: false });
        return;
      }

      const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
      const userDoc = snap.exists() ? (snap.data() as UserDocument) : null;
      setState({ user, userDoc, loading: false });
    });
  }, []);

  return state;
}
