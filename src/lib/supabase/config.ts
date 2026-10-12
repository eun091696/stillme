function requiredEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseConfig() {
  return {
    publishableKey: requiredEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
    url: requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
  };
}
