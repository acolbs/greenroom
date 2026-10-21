import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { honorReducedMotion } from "../utils/motionPrefs";

/** Short fade-up on route change; scrolls each new page to the top. */
export default function PageShell() {
  const location = useLocation();
  const outlet = useOutlet();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (honorReducedMotion()) {
    return <div className="route-transition-root">{outlet}</div>;
  }

  return (
    <div className="route-transition-root">
      <motion.div
        key={location.pathname}
        className="route-shell"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {outlet}
      </motion.div>
    </div>
  );
}
