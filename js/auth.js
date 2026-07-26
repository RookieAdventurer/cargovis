// ============================================
// auth.js — Login / logout logic
// Talks to the secure Supabase Edge Function (check-password) so the
// real passwords never live in this file or anywhere in the browser.
// ============================================

// IMPORTANT: Replace SUPABASE_URL below with your real project URL
const EDGE_FUNCTION_URL = "https://jwprxvobiunfnucrrzuo.supabase.co/functions/v1/check-password";
const SUPABASE_ANON_KEY  = "sb_publishable_QaPnj3hornmsAdbHrVM92g_6HPfgUI6"; // replace with your real key

async function login(password) {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem("ct_role", data.role);
      sessionStorage.setItem("ct_session", data.sessionToken);
      return { success: true, role: data.role };
    }
    return { success: false, message: data.message || "Incorrect password" };
  } catch (err) {
    return { success: false, message: "Could not reach the server." };
  }
}

function logout() {
  sessionStorage.clear();
  window.location.href = "login.html";
}

function getRole()    { return sessionStorage.getItem("ct_role"); }
function isEditor()   { return getRole() === "editor"; }
function isLoggedIn() { return !!getRole(); }

function requireLogin() {
  if (!isLoggedIn()) window.location.href = "login.html";
}

function applyRoleVisibility() {
  document.querySelectorAll(".editor-only").forEach(el => {
    el.style.display = isEditor() ? "" : "none";
  });
}

window.Auth = { login, logout, getRole, isEditor, isLoggedIn, requireLogin, applyRoleVisibility };
