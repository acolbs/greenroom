import { useNavigate, type NavigateFunction } from "react-router-dom";

/**
 * Programmatic navigation wrapper — all route changes go through one place.
 */
export function useSmoothNavigate(): NavigateFunction {
  return useNavigate();
}
