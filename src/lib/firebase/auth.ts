import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { app } from "./config";

export const auth: Auth = app ? getAuth(app) : (null as unknown as Auth);
export const googleProvider = new GoogleAuthProvider();
