export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-4" role="status">
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-mint" />
          <span className="relative h-8 w-8 rounded-full bg-ink" />
          <span className="absolute -right-1 top-1 h-2.5 w-2.5 rounded-full bg-lime" />
        </span>
        <p className="text-sm font-medium text-muted">Preparando tu plan…</p>
      </div>
    </main>
  );
}
