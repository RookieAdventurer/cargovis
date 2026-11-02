
// auth.js
// Individual CargoVis login using Supabase Auth and user profiles.

const CARGOVIS_EMAIL_DOMAIN = "@cargovis-login.example.com";

function getClient() {
  const client = window.AppDB?.supabaseClient;

  if (!client) {
    throw new Error("Supabase client has not been initialised.");
  }

  return client;
}

function getRole() {
  return sessionStorage.getItem("ct_role");
}

function isAdmin() {
  return getRole() === "admin";
}

function isEditor() {
  return ["admin", "editor"].includes(getRole());
}

function isLoggedIn() {
  return !!getRole();
}

async function getProfile(userId) {
  const { data, error } = await getClient()
    .from("profiles")
    .select("id, username, role, is_active, must_change_password")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function login(username, password) {
  try {
    const cleanUsername = String(username || "").trim().toLowerCase();

    if (!cleanUsername || !password) {
      return {
        success: false,
        message: "Enter your username and password."
      };
    }

    const email = cleanUsername + CARGOVIS_EMAIL_DOMAIN;

    const { data, error } = await getClient().auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return {
        success: false,
        message: "Incorrect username or password."
      };
    }

    let profile;

    try {
      profile = await getProfile(data.user.id);
    } catch (err) {
      await getClient().auth.signOut();

      return {
        success: false,
        message: "Your user profile could not be loaded. Contact the administrator."
      };
    }

    if (!profile.is_active) {
      await getClient().auth.signOut();

      return {
        success: false,
        message: "This account has been deactivated. Contact the administrator."
      };
    }

    sessionStorage.setItem("ct_role", profile.role);
    sessionStorage.setItem("ct_username", profile.username);

    return {
      success: true,
      role: profile.role,
      profile
    };

  } catch (err) {
    console.error("CargoVis login error:", err);

    return {
      success: false,
      message: "Unable to connect. Please try again."
    };
  }
}

async function restoreSession() {
  try {
    const { data, error } = await getClient().auth.getSession();

    if (error || !data.session) {
      sessionStorage.removeItem("ct_role");
      sessionStorage.removeItem("ct_username");

      return { success: false };
    }

    const profile = await getProfile(data.session.user.id);

    if (!profile.is_active) {
      await logout();
      return { success: false };
    }

    sessionStorage.setItem("ct_role", profile.role);
    sessionStorage.setItem("ct_username", profile.username);

    return {
      success: true,
      role: profile.role,
      profile
    };

  } catch (err) {
    console.error("CargoVis session restore error:", err);

    sessionStorage.removeItem("ct_role");
    sessionStorage.removeItem("ct_username");

    return { success: false };
  }
}

async function logout() {
  try {
    await getClient().auth.signOut();
  } catch (err) {
    console.error("CargoVis logout error:", err);
  }

  sessionStorage.clear();
  window.location.href = "login.html";
}

async function requireLogin() {
  const result = await restoreSession();

  if (!result.success) {
    window.location.href = "login.html";
    return false;
  }

  return true;
}

function applyRoleVisibility() {
  const role = getRole();

  document.querySelectorAll(".editor-only").forEach(element => {
    element.style.display =
      ["admin", "editor"].includes(role) ? "" : "none";
  });

  document.querySelectorAll(".admin-only").forEach(element => {
    element.style.display = role === "admin" ? "" : "none";
  });
}

window.Auth = {
  login,
  logout,
  getRole,
  isAdmin,
  isEditor,
  isLoggedIn,
  requireLogin,
  restoreSession,
  applyRoleVisibility
};
