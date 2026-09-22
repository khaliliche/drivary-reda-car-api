"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ padding: "3rem 1rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1>Erreur critique</h1>
        <p style={{ opacity: 0.7 }}>Something went wrong. Please try again.</p>
        <button onClick={reset} style={{ padding: "0.6rem 1.4rem", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}