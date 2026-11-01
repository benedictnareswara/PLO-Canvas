/**
 * `<meta name="theme-color">` needs literal colours (browser chrome can't read CSS variables).
 * These match `--background` in globals.css. Shared by the root layout, the pre-paint script and
 * `setThemeMode`, so a manual override recolours the browser chrome too.
 */
export const THEME_COLOR = { light: "#f7f8fa", dark: "#14171c" } as const;

export const THEME_STORAGE_KEY = "color-scheme";

/**
 * Inline pre-paint script: applies a stored override before first paint so there's no flash of
 * the wrong scheme. With nothing stored (or no JS) the page follows the OS via `color-scheme`.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){var d=document.documentElement;d.dataset.theme=t;var c=${JSON.stringify(THEME_COLOR)};var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){x.content=c[t]})}}catch(e){}`;
