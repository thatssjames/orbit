import { useEffect } from "react";
import Router from "next/router";

export default function Error() {

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white dark:bg-gray-900 text-center px-4">
      <h1 className="text-3xl font-bold text-black mb-4">This page couldn&apos;t be found.</h1>
      <p className="text-gray-700 dark:text-gray-300">
        Orbit couldn&apos;t find this page, unless you were looking for this page.
      </p>
    </div>
  );
}
