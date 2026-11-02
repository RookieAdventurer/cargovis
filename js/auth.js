// auth.js
// CargoVis individual username/password authentication.
// Uses Supabase Auth and the public.profiles table.

const CARGOVIS_EMAIL_DOMAIN = "@cargovis-login.example.com";

function getClient() {
  const client = window.AppDB?.supabaseClient;

  if (!client) {
    throw new Error("Supabase client has not been initialised.");
  }

  return client;
}

// Read the cached role for interface display only.
// Database permissions must always be enforced by Supabase RLS.
function getRole() {
  return sessionStorage.getItem("ct_role");
}

function getUsername() {
  return sessionStorage.getItem("ct_username");
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

function clearCargoVisSession() {
  sessionStorage.removeItem("ct_role");
  sessionStorage.removeItem("ct_username");
}

async function getProfile(userId) {
  const { data, error } = await getClient()
    .from("profiles")
    .select("id, username, role, is_active, must_change_password")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("User profile not found.");
  }

  return data;
}

function saveProfileSession(profile) {
  sessionStorage.setItem("ct_role", profile.role);
  sessionStorage.setItem("ct_username", profile.username);
}

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

async function login(username, password) {
  try {
    const cleanUsername = String(username || "")
      .trim()
      .toLowerCase();

    if (!cleanUsername || !password) {
      return {
        success: false,
        message: "Enter your username and password."
      };
    }

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return {
        success: false,
        message: "Please enter a valid username."
      };
    }

    const email = cleanUsername + CARGOVIS_EMAIL_DOMAIN;

    const { data, error } = await getClient().auth.signInWithPassword({
      email,
      password
    });

    if (error || !data?.user) {
      return {
        success: false,
        message: "Incorrect username or password."
      };
    }

    let profile;

    try {
      profile = await getProfile(data.user.id);
    } catch (profileError) {
      console.error("CargoVis profile error:", profileError);

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

    saveProfileSession(profile);

    return {
      success: true,
      role: profile.role,
      profile,
      mustChangePassword: profile.must_change_password
    };

  } catch (err) {
    console.error("CargoVis login error:", err);

    return {
      success: false,
      message: "Unable to connect. Please try again."
    };
  }
}

// --------------------------------------------------
// RESTORE EXISTING SESSION
// --------------------------------------------------

async function restoreSession() {
  try {
    const { data, error } = await getClient().auth.getSession();

    if (error || !data?.session?.user) {
      clearCargoVisSession();
      return { success: false };
    }

    const profile = await getProfile(data.session.user.id);

    if (!profile.is_active) {
      await getClient().auth.signOut();
      clearCargoVisSession();

      return { success: false };
    }

    saveProfileSession(profile);

    return {
      success: true,
      role: profile.role,
      profile,
      mustChangePassword: profile.must_change_password
    };

  } catch (err) {
    console.error("CargoVis session restore error:", err);

    clearCargoVisSession();

    return { success: false };
  }
}

// --------------------------------------------------
// PROTECT PAGES
// --------------------------------------------------

async function requireLogin() {
  const result = await restoreSession();

  if (!result.success) {
    window.location.href = "login.html";
    return false;
  }

  return true;
}

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

async function logout() {
  try {
    await getClient().auth.signOut();
  } catch (err) {
    console.error("CargoVis logout error:", err);
  }

  clearCargoVisSession();
  window.location.href = "login.html";
}

// --------------------------------------------------
// ROLE-BASED INTERFACE VISIBILITY
// --------------------------------------------------

function applyRoleVisibility() {
  const role = getRole();

  document.querySelectorAll(".editor-only").forEach(element => {
    element.style.display =
      ["admin", "editor"].includes(role) ? "" : "none";
  });

  document.querySelectorAll(".admin-only").forEach(element => {
    element.style.display =
      role === "admin" ? "" : "none";
  });
}

// --------------------------------------------------
// PUBLIC AUTH API
// --------------------------------------------------

window.Auth = {
  login,
  logout,
  getRole,
  getUsername,
  isAdmin,
  isEditor,
  isLoggedIn,
  requireLogin,
  restoreSession,
  applyRoleVisibility
};
