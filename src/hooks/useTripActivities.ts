"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import type { Activity, ActivityDocument } from "@/types";

export function useTripActivities(tripId: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const ref = collection(
      db,
      COLLECTIONS.TRIPS,
      tripId,
      SUBCOLLECTIONS.ACTIVITIES
    );
    const q = query(ref, orderBy("sortOrder", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          tripId,
          ...(d.data() as ActivityDocument),
        }));
        setActivities(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [tripId]);

  return { activities, loading, error };
}
