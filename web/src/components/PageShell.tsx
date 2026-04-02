import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";

function supportsViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

export default function PageShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion() === true;
  const nativeTransition = !reduceMotion && supportsViewTransition();

  if (nativeTransition || reduceMotion) {
    return <div className="route-transition-root">{outlet}</div>;
  }

  const spring = {
    type: "spring" as const,
    stiffness: 260,
    damping: 30,
    mass: 0.9,
  };

  return (
    <div className="route-transition-root route-transition-root--stacked">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={location.pathname}
          className="route-shell"
          role="presentation"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={spring}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
