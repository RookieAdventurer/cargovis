// ============================================================
//  auth.js — Supabase Authentication
//  Handles login, logout, session and user role
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── CLIENT ────────────────────────────────────────────────────
export const supabase = createClient(
  'https://qkyjlggmirnbgagkdgch.supabase.co',
  'sb_publishable_DuJnaj-C8OqeHKTBymoItw_a5t4qtju'
);

// ── SESSION ───────────────────────────────────────────────────
// Returns the current session or null
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Returns the current user or null
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Returns the current user's role: 'admin' | 'editor' | 'viewer' | null
export async function getUserRole() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, full_name')
    .eq('user_id', user.id)
    .single();
  if (error) return null;
  return data;
}

// ── LOGIN ─────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ── LOGOUT ────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = 'index.html';
}

// ── GUARD ─────────────────────────────────────────────────────
// Call this at the top of every protected page (dashboard, archive, suppliers)
// Redirects to login if no session found
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// ── ROLE HELPERS ──────────────────────────────────────────────
export function canEdit(role)         { return ['admin', 'editor'].includes(role); }
export function canManageSuppliers(role) { return role === 'admin'; }
export function canDeleteArchive(role)   { return role === 'admin'; }

// ── AUTH STATE CHANGE ─────────────────────────────────────────
// Listen for login/logout events across tabs
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
