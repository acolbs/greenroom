import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { RadarPoint } from "../lib/playerMetrics";
import RadarFallback from "./RadarFallback";

interface HologramRadarProps {
  subject: RadarPoint[];
  comp?: RadarPoint[] | null;
  subjectColor?: string;
  compColor?: string;
  /** Square px size of the canvas. */
  size?: number;
}

const PINE = "#46A877";
const CYAN = "#39E3FF";

const R = 2; // hexagon radius in scene units
const RELIEF = 0.55; // how far high stats poke toward the viewer (3D depth)

/** Vertex angle for axis i — start at top (12 o'clock), go clockwise. */
function axisAngle(i: number, n: number): number {
  return Math.PI / 2 - (i * 2 * Math.PI) / n;
}

/** Build a glowing text sprite from a 2D canvas texture. */
function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const pad = 8;
  const fontPx = 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `700 ${fontPx}px "JetBrains Mono", monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = fontPx + pad * 2;
  canvas.width = w;
  canvas.height = h;
  // re-set after resize
  ctx.font = `700 ${fontPx}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = 0.0095;
  sprite.scale.set(w * scale, h * scale, 1);
  return sprite;
}

/** Vertices for a data polygon, with z-relief proportional to each stat. */
function polygonVertices(points: RadarPoint[]): THREE.Vector3[] {
  const n = points.length;
  return points.map((p, i) => {
    const r = R * (p.norm / 100);
    const a = axisAngle(i, n);
    return new THREE.Vector3(
      Math.cos(a) * r,
      Math.sin(a) * r,
      (p.norm / 100) * RELIEF
    );
  });
}

/** A filled translucent layer + bright glowing edge + node spheres. */
function buildLayer(points: RadarPoint[], colorHex: string): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(colorHex);
  const verts = polygonVertices(points);
  const center = new THREE.Vector3(
    0,
    0,
    (points.reduce((s, p) => s + p.norm, 0) / points.length / 100) * RELIEF * 0.6
  );

  // Fill — triangle fan from center.
  const fillGeo = new THREE.BufferGeometry();
  const fillPos: number[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    fillPos.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(fillPos, 3));
  fillGeo.computeVertexNormals();
  const fillMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(fillGeo, fillMat));

  // Edge loop — bright, additive.
  const edgeGeo = new THREE.BufferGeometry().setFromPoints([...verts, verts[0]]);
  const edgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Line(edgeGeo, edgeMat));

  // Node spheres at each vertex.
  const nodeGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const nodeMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const v of verts) {
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.copy(v);
    group.add(node);
  }

  return group;
}

/** Faint concentric hex rings + spokes. */
function buildGrid(n: number): THREE.Group {
  const group = new THREE.Group();
  const gridColor = new THREE.Color("#7fb89e");
  const ringMat = new THREE.LineBasicMaterial({
    color: gridColor,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const frac of [0.25, 0.5, 0.75, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = axisAngle(i % n, n);
      pts.push(new THREE.Vector3(Math.cos(a) * R * frac, Math.sin(a) * R * frac, 0));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
  }
  for (let i = 0; i < n; i++) {
    const a = axisAngle(i, n);
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
  }
  return group;
}

export default function HologramRadar({
  subject,
  comp,
  subjectColor = PINE,
  compColor = CYAN,
  size = 340,
}: HologramRadarProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    if (!renderer.getContext()) {
      setFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 9.2);
    camera.lookAt(0, 0, 0);

    const radar = new THREE.Group();
    radar.rotation.x = -0.32; // tilt so the relief reads as depth
    scene.add(radar);

    const n = subject.length;
    radar.add(buildGrid(n));
    if (comp) radar.add(buildLayer(comp, compColor));
    radar.add(buildLayer(subject, subjectColor));

    // Axis label sprites, billboarded so they stay readable while orbiting.
    const labelGroup = new THREE.Group();
    subject.forEach((p, i) => {
      const a = axisAngle(i, n);
      const sprite = makeLabelSprite(p.label.toUpperCase(), "#cfe9dc");
      sprite.position.set(Math.cos(a) * (R + 0.5), Math.sin(a) * (R + 0.5), 0.1);
      labelGroup.add(sprite);
    });
    radar.add(labelGroup);

    let raf = 0;
    let t = 0;
    const animate = () => {
      t += 0.012;
      radar.rotation.y = Math.sin(t * 0.5) * 0.45; // gentle oscillating orbit
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
          obj.geometry?.dispose?.();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [subject, comp, subjectColor, compColor, size]);

  if (failed) {
    return (
      <RadarFallback
        subject={subject}
        comp={comp}
        subjectColor={subjectColor}
        compColor={compColor}
        size={size}
      />
    );
  }

  return <div ref={mountRef} className="hologram-radar" style={{ width: size, height: size }} />;
}
