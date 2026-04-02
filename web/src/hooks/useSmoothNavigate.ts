import { useCallback } from "react";
import { flushSync } from "react-dom";
import {
  useNavigate,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from "react-router-dom";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canUseViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

/**
 * Same as `useNavigate`, but wraps updates in `document.startViewTransition`
 * when the browser supports it so route changes feel like one continuous UI.
 */
export function useSmoothNavigate(): NavigateFunction {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      const run = () => {
        if (typeof to === "number") {
          navigate(to);
        } else {
          navigate(to, options);
        }
      };

      if (canUseViewTransition() && !prefersReducedMotion()) {
        document.startViewTransition!(() => {
          flushSync(run);
        });
      } else {
        run();
      }
    },
    [navigate]
  );
}
