"use client";

// Temporary Sentry smoke-test page. Delete once verified in Sentry.
export default function SentryTestPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
      <button
        onClick={() => {
          // @ts-expect-error intentional undefined call to trigger Sentry
          myUndefinedFunction();
        }}
        className="px-6 py-3 bg-red-500 text-white font-black rounded-xl"
      >
        Throw test error
      </button>
    </div>
  );
}
