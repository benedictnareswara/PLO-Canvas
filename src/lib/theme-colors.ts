/**
 * `<meta name="theme-color">` needs literal colours (browser chrome can't read CSS variables).
 * These match `--header` in globals.css, the strip at the top of every page. Shared by the root
 * layout, the pre-paint script and `setThemeMode`, so a manual override recolours the browser chrome too.
 */
export const THEME_COLOR = { light: "#004d91", dark: "#0b1b3f" } as const;

export const THEME_STORAGE_KEY = "color-scheme";

/**
 * Inline pre-paint script: applies the stored choice (light, dark or system) before first paint so
 * there is no flash of the wrong scheme. With nothing stored the page is light, the default.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"||t==="system"){var d=document.documentElement;d.dataset.theme=t;var c=${JSON.stringify(THEME_COLOR)};var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=t==="system"?"light dark":t;var s=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){x.content=c[s]})}}catch(e){}`;
