import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        border: {
          subtle: "var(--border-subtle)",
          default: "var(--border-default)",
        },
        ink: "var(--ink)",
        green: {
          DEFAULT: "var(--green)",
          bg: "var(--green-bg)",
        },
        amber: {
          DEFAULT: "var(--amber)",
          bg: "var(--amber-bg)",
        },
        red: "var(--red)",
        gray: {
          pill: "var(--gray-pill)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // Pinned scale from the brief — do not free-hand sizes.
        "11": ["11px", { lineHeight: "1.3" }],
        "12": ["12px", { lineHeight: "1.3" }],
        "13": ["13px", { lineHeight: "1.3" }],
        "14": ["14px", { lineHeight: "1.3" }],
        "15": ["15px", { lineHeight: "1.55" }],
        "16": ["16px", { lineHeight: "1.55" }],
        "18": ["18px", { lineHeight: "1.3" }],
        "22": ["22px", { lineHeight: "1.3" }],
        "28": ["28px", { lineHeight: "1.2" }],
      },
      borderRadius: {
        button: "4px",
        card: "6px",
        modal: "8px",
        pill: "999px",
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
        "16": "64px",
      },
    },
  },
  plugins: [],
};

export default config;
