/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      screens: {
        desktop: '1100px',
      },
      colors: {
        // 主色：深墨绿
        ink: {
          DEFAULT: "#0F3D2E",
          50: "#E8F0EC",
          100: "#C7DACF",
          200: "#8FB5A2",
          300: "#577E68",
          400: "#2A5742",
          500: "#0F3D2E",
          600: "#0B3024",
          700: "#08231A",
          800: "#061712",
          900: "#040C09",
        },
        // 辅色：暖琥珀
        amber: {
          DEFAULT: "#E0A458",
          50: "#FBF1E0",
          100: "#F5DFB0",
          200: "#EBC57F",
          300: "#E0A458",
          400: "#C8842F",
          500: "#9E661F",
          600: "#7E5318",
          700: "#5F3E11",
          800: "#412A0B",
          900: "#231704",
        },
        // 背景米白
        cream: "#FAF7F2",
        // 中性石板灰
        slate2: "#475569",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 12px rgba(15, 61, 46, 0.06)',
        'card': '0 4px 24px rgba(15, 61, 46, 0.08)',
        'lift': '0 10px 30px rgba(15, 61, 46, 0.12)',
      },
      borderRadius: {
        'xl2': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'fade-in-slow': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-up-slow': 'slideUp 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
