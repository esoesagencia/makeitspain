"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import type { Trip, TripDocument } from "@/types";

export function useTrip(tripId: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const ref = doc(db, COLLECTIONS.TRIPS, tripId);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setTrip({ id: snap.id, ...(snap.data() as TripDocument) });
        } else {
          setTrip(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [tripId]);

  return { trip, loading, error };
}
