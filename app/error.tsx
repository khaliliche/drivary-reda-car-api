"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: "3rem 1rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Une erreur est survenue</h1>
      <p style={{ opacity: 0.7, margin: "0.75rem 0 1.25rem" }}>
        Something went wrong while loading this page.
      </p>
      <button
        onClick={reset}
        style={{ padding: "0.6rem 1.4rem", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}
      >
        Réessayer
      </button>
    </main>
  );
}