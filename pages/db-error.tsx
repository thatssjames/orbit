import { useEffect } from "react";
import Router from "next/router";

export default function DatabaseErrorPage() {
  const isDbConfigured = process.env.NEXT_PUBLIC_DATABASE_CHECK === "true";

  useEffect(() => {
    if (isDbConfigured) {
      Router.replace("/"); // Redirect back to homepage
    }
  }, [isDbConfigured]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white dark:bg-gray-900 text-center px-4">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Database Not Configured</h1>
      <p className="text-gray-700 dark:text-gray-300">
        Please set the <code className="font-mono bg-gray-200 px-1 py-0.5 rounded">DATABASE_URL</code> environment variable in your deployment.
      </p>
    </div>
  );
}
