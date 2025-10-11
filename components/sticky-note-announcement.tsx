import { useState, useEffect } from "react"
import { IconX, IconPin } from "@tabler/icons-react"
const ANNOUNCEMENT_KEY = "announcementDismissed_v2_2_0";

export default function StickyNoteAnnouncement() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(ANNOUNCEMENT_KEY)
    if (!dismissed) setIsVisible(true)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(ANNOUNCEMENT_KEY, "true")
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="z-0 bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-4 flex items-start space-x-4 mb-6 relative">
      <img
        src="/favicon-32x32.png"
        alt="Orbit"
        className="w-10 h-10 rounded-full bg-primary flex-shrink-0"
      />
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-1">
          <IconPin className="w-4 h-4 text-zinc-500 dark:text-zinc-300" />
          Planetary
        </h3>

    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0"></p>
    <div className="text-zinc-800 dark:text-zinc-300 text-sm space-y-2">
      <p>
        👋 <strong>Orbit v2.1.0 is live!</strong> — A spooky seasonal upgrade 🎃
        <br />
        Here’s what’s new since the last announcement:
      </p>

      <p className="mt-4 font-semibold">🛠️ Manual Activity Adjustments</p>
      <p>
        Workspace managers can now <strong>award or remove minutes</strong>. Adjustments appear in the activity timeline and the user’s total.
      </p>

      <p className="mt-4 font-semibold">👥 New Member & Profile Enhancements</p>
      <ul className="list-disc list-inside space-y-1">
        <li>New members scroller shows who's recently joined.</li>
        <li>Join date now appears on profile info.</li>
      </ul>

      <p className="mt-4 font-semibold">🎃 Seasonal Polish</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Dynamic Halloween greetings across the app.</li>
        <li>Avatar accent colors updated for the season.</li>
        <li>Dark theme updated to Zinc instead of Gray.</li>
      </ul>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Orbit remains in <em>beta</em>. We’re iterating fast — thank you for testing, reporting, and shaping the platform. 🛰️
      </p>
    </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        aria-label="Close announcement"
      >
        <IconX className="w-5 h-5" />
      </button>
    </div>
  )
}
