import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { honorReducedMotion } from "../utils/motionPrefs";

export default function PageShell() {
  const location = useLocation();
  const outlet = useOutlet();

  if (honorReducedMotion()) {
    return <div className="route-transition-root">{outlet}</div>;
  }

  const spring = {
    type: "spring" as const,
    stiffness: 200,
    damping: 26,
    mass: 0.95,
  };

  return (
    <div className="route-transition-root route-transition-root--stacked">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={location.pathname}
          className="route-shell"
          role="presentation"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -28 }}
          transition={spring}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
