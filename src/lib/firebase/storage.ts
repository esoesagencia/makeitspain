import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "./config";

export const storage = app ? getStorage(app) : null;

export async function uploadAuthorAvatar(authorId: string, file: File): Promise<string> {
  if (!storage) throw new Error("Storage not configured");
  const ext = file.name.split(".").pop() ?? "jpg";
  const storageRef = ref(storage, `authors/${authorId}/avatar.${ext}`);
  const snap = await uploadBytes(storageRef, file);
  return getDownloadURL(snap.ref);
}

export async function uploadMemberAvatar(uid: string, file: File): Promise<string> {
  if (!storage) throw new Error("Storage not configured");
  const ext = file.name.split(".").pop() ?? "jpg";
  const storageRef = ref(storage, `members/${uid}/avatar.${ext}`);
  const snap = await uploadBytes(storageRef, file);
  return getDownloadURL(snap.ref);
}
