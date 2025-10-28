import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";

export default async function Game3Layout({ children }) {
  try {
    const sessionCookie = cookies().get("__session")?.value || "";
    if (sessionCookie) {
      const adminAuth = getAdminAuth();
      const adminDb = getAdminDb();
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      const uid = decoded?.uid;
      if (uid) {
        const doc = await adminDb
          .collection("users")
          .doc(uid)
          .collection("scores")
          .doc("3")
          .get();
        if (doc.exists) {
          redirect("/admin/scores");
        }
      }
    }
  } catch {}

  return children;
}
