import { setTheme, useTheme } from "../theme/theme";

/** Light/dark switch. The knob slides; pink on the right means dark mode is on. */
export function ThemeSwitch() {
  const dark = useTheme() === "dark";

  return (
    <label className="switch-field">
      <span>Mode sombre</span>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        className="switch"
        onClick={() => {
          setTheme(dark ? "light" : "dark");
        }}
      >
        <span className="switch-knob" aria-hidden="true" />
      </button>
    </label>
  );
}
