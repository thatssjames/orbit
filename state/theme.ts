import { atom } from "recoil";

const getInitialTheme = (): "light" | "dark" => {
	if (typeof window !== "undefined") {
		const stored = localStorage.getItem("theme");
		if (stored === "dark" || stored === "light") return stored;
	}
	return "light"; // fallback default
};

export const themeState = atom<"light" | "dark">({
	key: "themeState",
	default: getInitialTheme(),
});
