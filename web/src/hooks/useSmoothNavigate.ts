import { useCallback } from "react";
import {
  useNavigate,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from "react-router-dom";

/**
 * Programmatic navigation. (Kept as a named hook so all route changes go
 * through one place; page motion is handled by {@link PageShell}.)
 */
export function useSmoothNavigate(): NavigateFunction {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
      } else {
        navigate(to, options);
      }
    },
    [navigate]
  );
}
