// ============================================
// auth.js — Login / logout logic
// Talks to the secure Supabase Edge Function (check-password) so the
// real passwords never live in this file or anywhere in the browser.
// ============================================

// Replace with your real Supabase project URL (same one used in supabase-client.js)
const EDGE_FUNCTION_URL = "https://jwprxvobiunfnucrrzuo.supabase.co/functions/v1/check-password";

/**
 * Attempts to log in with the given password.
 * On success, stores the role + session token in sessionStorage
 * (cleared automatically when the browser tab is closed).
 */
async function login(password) {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem("ct_role", data.role);
      sessionStorage.setItem("ct_session", data.sessionToken);
      sessionStorage.setItem("ct_loggedInAt", new Date().toISOString());
      return { success: true, role: data.role };
    } else {
      return { success: false, message: data.message || "Incorrect password" };
    }
  } catch (err) {
    return { success: false, message: "Could not reach the server. Check your connection." };
  }
}

/** Logs the user out by clearing the session. */
function logout() {
  sessionStorage.removeItem("ct_role");
  sessionStorage.removeItem("ct_session");
  sessionStorage.removeItem("ct_loggedInAt");
  window.location.href = "login.html";
}

/** Returns "editor", "viewer", or null if not logged in. */
function getRole() {
  return sessionStorage.getItem("ct_role");
}

/** True if the current user can add/edit/archive containers. */
function isEditor() {
  return getRole() === "editor";
}

/** True if logged in at all (either role). */
function isLoggedIn() {
  return !!getRole();
}

/**
 * Call this at the top of every protected page (dashboard, archive, etc).
 * Redirects to login.html if not logged in.
 */
function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
  }
}

/**
 * Hides/shows elements based on role.
 * Add class="editor-only" to any button/element that only editors should see
 * (Add container, Mark emptied, Remove, Manage suppliers, etc).
 * Call this once the page has loaded.
 */
function applyRoleVisibility() {
  const editorOnlyElements = document.querySelectorAll(".editor-only");
  editorOnlyElements.forEach((el) => {
    el.style.display = isEditor() ? "" : "none";
  });
}

window.Auth = { login, logout, getRole, isEditor, isLoggedIn, requireLogin, applyRoleVisibility };
