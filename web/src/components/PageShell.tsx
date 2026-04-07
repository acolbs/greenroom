import { useOutlet } from "react-router-dom";

export default function PageShell() {
  const outlet = useOutlet();
  return <div className="route-transition-root">{outlet}</div>;
}
