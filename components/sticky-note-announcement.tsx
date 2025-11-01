import { useState, useEffect } from "react"
import { IconX, IconPin } from "@tabler/icons-react"
const ANNOUNCEMENT_KEY = "announcementDismissed_v2_1_2b1";

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
        👋 <strong>Orbit v2.1.2 is live!</strong> — Activity & Users 🎖️
        <br />
        Here’s what’s new since the last announcement:
      </p>

      <p className="mt-4 font-semibold">Introduction</p>
      <p>
        We've revamped our Activity & Users system to give you deeper insights into your team's engagement and contributions within Orbit.
		The features you know and love have been reimagined and designed to provide a more intuitive and powerful experience.
      </p>

      <p className="mt-4 font-semibold">Features</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Activity Reset</li>
        <li>Activity History</li>
        <li>Session Statistics</li>
        <li>Activity Leaderboard</li>
        <li>Separated Notices page</li>
        <li>External Intergration (Ranking)</li>
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
