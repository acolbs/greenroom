import { useEffect, useRef } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import { honorReducedMotion } from "../utils/motionPrefs";

function triggerActionGlow() {
  if (honorReducedMotion()) return;
  const root = document.documentElement;
  root.classList.remove("action-complete-glow");
  void root.offsetWidth;
  root.classList.add("action-complete-glow");
  window.setTimeout(() => root.classList.remove("action-complete-glow"), 900);
}

/**
 * Brief ambient flash when phase advances or the draft sim finishes.
 */
export default function PhaseTransitionGlow() {
  const phase = useSimulatorStore((s) => s.phase);
  const draftSimComplete = useSimulatorStore((s) => s.draftSimComplete);
  const prevPhase = useRef(phase);
  const prevDraftDone = useRef(draftSimComplete);
  const reduced = honorReducedMotion();

  useEffect(() => {
    if (reduced) {
      prevPhase.current = phase;
      return;
    }
    if (prevPhase.current === phase) return;
    prevPhase.current = phase;
    triggerActionGlow();
  }, [phase, reduced]);

  useEffect(() => {
    if (reduced) {
      prevDraftDone.current = draftSimComplete;
      return;
    }
    if (!prevDraftDone.current && draftSimComplete) {
      triggerActionGlow();
    }
    prevDraftDone.current = draftSimComplete;
  }, [draftSimComplete, reduced]);

  return null;
}
