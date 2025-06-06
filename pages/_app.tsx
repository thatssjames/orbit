"use client"

import type React from "react"

import "@/styles/globals.scss" // Global styles should only be imported here
import type { AppProps } from "next/app"
import { workspacestate } from "@/state"
import { RecoilRoot, useRecoilState, useRecoilValue } from "recoil"
import type { pageWithLayout } from "@/layoutTypes"
import { useEffect, useState } from "react"
import Head from "next/head"
import Router from "next/router"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js"
import { themeState } from "../state/theme"
import AuthProvider from "./AuthProvider"

type AppPropsWithLayout = AppProps & {
  Component: pageWithLayout
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement)

function ThemeHandler() {
  const theme = useRecoilValue(themeState)

  useEffect(() => {
    if (!theme) return
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.classList.add(theme)
  }, [theme])

  return null
}

function ColorThemeHandler() {
  const [workspace] = useRecoilState(workspacestate)

  useEffect(() => {
    const defaultColor = "236, 72, 153"

    if (workspace && workspace.groupTheme && typeof workspace.groupTheme === "string") {
      const rgbValue = getRGBFromTailwindColor(workspace.groupTheme)
      document.documentElement.style.setProperty("--group-theme", rgbValue)
    } else {
      document.documentElement.style.setProperty("--group-theme", defaultColor)
    }
  }, [workspace])

  return null
}

function getRGBFromTailwindColor(tw: any): string {
  const fallback = "236, 72, 153" // pink-500

  if (!tw || typeof tw !== "string") {
    if (tw !== null && tw !== undefined) {
      console.warn("Invalid color value:", tw)
    }
    return fallback
  }

  const colorName = tw.replace("bg-", "")

  if (colorName === "orbit") {
    return "0, 112, 240"
  }

  const colorMap: Record<string, string> = {
    "blue-500": "59, 130, 246",
    "red-500": "239, 68, 68",
    "red-700": "185, 28, 28",
    "green-500": "34, 197, 94",
    "green-600": "22, 163, 74",
    "yellow-500": "234, 179, 8",
    "orange-500": "249, 115, 22",
    "purple-500": "168, 85, 247",
    "pink-500": "236, 72, 153",
    black: "0, 0, 0",
    "gray-500": "107, 114, 128",
  }

  return colorMap[colorName] || fallback
}

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const [loading, setLoading] = useState(true)
  const Layout = Component.layout || (({ children }: { children: React.ReactNode }) => <>{children}</>)

  const isDbConfigured = process.env.NEXT_PUBLIC_DATABASE_CHECK === "true"

  // Redirect to /db-error if DB is not configured and we're not already there
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname
      if (!isDbConfigured && currentPath !== "/db-error") {
        Router.replace("/db-error")
      }
    }
  }, [isDbConfigured])

  return (
    <RecoilRoot>
      <Head>
        <title>Orbit</title>
      </Head>

      <AuthProvider loading={loading} setLoading={setLoading} />
      <ThemeHandler />
      <ColorThemeHandler />

      {!loading ? (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      ) : (
        <div className="flex h-screen dark:bg-gray-900">
          <svg
            aria-hidden="true"
            className="w-24 h-24 text-gray-200 animate-spin dark:text-gray-600 fill-orbit my-auto mx-auto"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
        </div>
      )}
    </RecoilRoot>
  )
}

export default MyApp
