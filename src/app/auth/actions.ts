"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

function authError(message: string): never {
  redirect(`/auth?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) authError("Revisa el email y usa una contraseña de al menos 8 caracteres.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) authError(error.message);
  redirect("/feed");
}

export async function signup(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const displayName = z.string().trim().min(1).max(60).safeParse(formData.get("displayName"));

  if (!parsed.success || !displayName.success) {
    authError("Añade un nombre, un email válido y una contraseña de al menos 8 caracteres.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { display_name: displayName.data },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/feed`,
    },
  });

  if (error) authError(error.message);
  if (!data.session) redirect("/auth?message=Revisa tu correo para confirmar la cuenta.");
  redirect("/feed");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
