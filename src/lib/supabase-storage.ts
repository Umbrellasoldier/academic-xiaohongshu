import { createClient } from "@supabase/supabase-js";

const BUCKET = "avatars";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Please configure them in .env for avatar upload to work."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

type UploadTarget =
  | { type: "user"; userId: string }
  | { type: "room"; roomId: string };

/**
 * Upload a file to Supabase Storage and return the public URL.
 */
export async function uploadAvatar(
  file: File,
  target: UploadTarget
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const ext = file.name.split(".").pop() || "webp";
  const folder =
    target.type === "user"
      ? `users/${target.userId}`
      : `rooms/${target.roomId}`;
  const path = `${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete an old avatar from Supabase Storage (best-effort).
 */
export async function deleteOldAvatar(publicUrl: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return;

    const path = url.pathname.slice(idx + marker.length);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
  } catch {
    // Best-effort cleanup — log but don't throw
    console.warn("Failed to delete old avatar:", publicUrl);
  }
}
