import { createClient } from "./supabase/client";

export type AuthResult =
  | { ok: true; user: { id: string; email?: string; name?: string } }
  | { ok: false; error: string };

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      name:
        (data.user.user_metadata as { full_name?: string })?.full_name ??
        data.user.email?.split("@")[0],
    },
  };
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    user: {
      id: data.user?.id ?? "",
      email: data.user?.email,
      name,
    },
  };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function currentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function saveMoodEntry(mood: string, note: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("mood_entries").insert({
    user_id: user.id,
    mood,
    note: note || null,
  });
  return { ok: !error, error };
}