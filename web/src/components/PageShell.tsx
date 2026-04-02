import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";

export default function PageShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  const t = reduceMotion ? 0 : 0.3;
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="route-shell"
        role="presentation"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12, filter: "blur(4px)" }}
        transition={{ duration: t, ease }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
