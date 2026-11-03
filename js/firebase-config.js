/* Firebase project settings for the B2A playbook.
   Paste the "firebaseConfig" object from Firebase console → Project settings → Your apps → Web app.
   These values are safe to commit: access is controlled by the Firestore security rules (firestore.rules)
   and the team list, not by keeping this key secret.
   Leave it as null to run the site without logins (local data + GitHub publish, the old way). */
window.B2A_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDvDxaEHcTyInPXccLWfwGg9SQ_WWsBexM",
  authDomain: "b2a-playbook.firebaseapp.com",
  projectId: "b2a-playbook",
  storageBucket: "b2a-playbook.firebasestorage.app",
  messagingSenderId: "971122187049",
  appId: "1:971122187049:web:640ba56755563873337538"
};
/* Example:
window.B2A_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "b2a-playbook.firebaseapp.com",
  projectId: "b2a-playbook",
  storageBucket: "b2a-playbook.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
*/
window.B2A_TEAM_ID = 'b2a';
