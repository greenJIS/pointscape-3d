import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { blockerOf, exitRay, headOf, occupancy } from '../core/board';
import type { Arrow, Level, Vec3 } from '../core/types';
import { key } from '../core/vec';
import { roundCorners } from './corners';
import { BLOCKED, POOL, arrowColors } from './palette';
import {
  ANIM,
  arrowPath,
  bumpDistance,
  slideDistance,
  subPath,
  type ArrowPath,
} from './path';

export interface LayerView {
  /** 0 packs the layers together, 1 spreads them apart. */
  readonly gap: number;
  /** How many layers to hide, starting from the one nearest the viewer. */
  readonly hideFront: number;
  readonly xray: boolean;
  /** The see-through panel of each layer. */
  readonly showLayers: boolean;
  /** The grid dots of each layer. */
  readonly showDots: boolean;
}

export interface SceneOptions {
  readonly lowPower: boolean;
  /** Start in the dark look. `setDark` changes it later. */
  readonly dark: boolean;
  /** Draw as a page backdrop: see-through, no plate, and the board covers the whole canvas. */
  readonly backdrop?: boolean;
  readonly onTap: (arrowId: number) => void;
  /** Called when the view moves away from, or back to, its opening state. */
  readonly onViewChange?: (isDefault: boolean) => void;
}

type State = 'idle' | 'exit' | 'bounce' | 'hidden' | 'intro';

interface ArrowView {
  readonly arrow: Arrow;
  readonly path: ArrowPath;
  readonly group: THREE.Group;
  readonly tube: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly shadowTube: THREE.Mesh;
  readonly shadowHead: THREE.Mesh;
  readonly pick: THREE.Mesh;
  readonly pickHead: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly layer: number;
  /** Drawn as part of the merged layer mesh instead of its own meshes (N-2). */
  batched: boolean;
  /** Cell-space points of the body as drawn now, for hiding grid dots under it. */
  shown: readonly Vec3[];
  /** Whether the arrow should be in the merged mesh at the next rebuild. */
  want: boolean;
  hasTube: boolean;
  /** Body and head as one world-space geometry, cached for the merged mesh. */
  solid: THREE.BufferGeometry | null;
  base: THREE.Color;
  state: State;
  t0: number;
  bump: number;
  impacted: boolean;
  blockerId: number | undefined;
  flashUntil: number;
  jiggleT0: number;
  jiggleDir: THREE.Vector3;
}

/** Pick meshes sit on their own layer: the camera never draws them, only the raycaster sees them. */
const PICK_LAYER = 1;
const TUBE_RADIUS = 0.14;
const PICK_RADIUS = 0.2;
const CORNER = 0.34;
/** Cells of delay before the tide reaches a dot: it sweeps left to right on a gentle swell. */
function tideReach(x: number, y: number): number {
  return x + 2 + Math.sin(y * 0.55) * 1.5;
}

/** Scene colours for each look. `board` is the backdrop that dots fade into. */
const LOOKS = {
  dark: { board: '#1e293b', plate: '#475569', dot: '#475569', sky: '#e2e8f0' },
  light: { board: '#e2e8f0', plate: '#ffffff', dot: '#94a3b8', sky: '#ffffff' },
} as const;
/** Direction toward the key light that casts the drop shadows, in the scene. */
const KEY_DIRECTION = new THREE.Vector3(-4, 7, 9).normalize();
/** How far a shadow lands from its arrow, in cells, and how far behind it. */
const SHADOW_SHIFT = 0.14;
const SHADOW_DEPTH = 0.12;
const WHITE = new THREE.Color('#ffffff');

/**
 * The Barbed head, pointing along +x, from the design demo. Its numbers are the demo's
 * in tube widths (w = 0.3 cells): tip 1.5w ahead of the path end, wings 1.2w to each side
 * just behind it, and a notch 0.3w ahead of the wings.
 */
function headGeometry(): THREE.ExtrudeGeometry {
  const w = 0.3;
  const s = new THREE.Shape();
  s.moveTo(1.5 * w, 0);
  s.lineTo(-0.1 * w, 1.2 * w);
  s.lineTo(0.3 * w, 0);
  s.lineTo(-0.1 * w, -1.2 * w);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.05,
    bevelSegments: 6,
  });
  // As thick as the tube, and set back so the tube end sits inside it: one solid arrow.
  g.translate(-0.06, 0, -0.05);
  return g;
}

/**
 * A round tube along a polyline, with a rounded cap at the tail. Straight stretches stay
 * exactly straight and corners follow the rounded points, so bends keep an even width.
 * The front end is left open: the head covers it.
 */
function tubeMesh(
  pts: readonly THREE.Vector3[],
  radius: number,
  radial: number,
): THREE.BufferGeometry | null {
  const n = pts.length;
  const first = pts[0];
  const last = pts[n - 1];
  if (n < 2 || !first || !last) return null;
  const tangents: THREE.Vector3[] = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)] ?? p;
    const b = pts[Math.min(n - 1, i + 1)] ?? p;
    return b.clone().sub(a).normalize();
  });
  const t0 = tangents[0];
  if (!t0) return null;
  const ref =
    Math.abs(t0.z) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 0, 1);
  const normals: THREE.Vector3[] = [
    new THREE.Vector3().crossVectors(t0, ref).normalize(),
  ];
  for (let i = 1; i < n; i++) {
    const prev = normals[i - 1];
    const ta = tangents[i - 1];
    const tb = tangents[i];
    if (!prev || !ta || !tb) return null;
    const q = new THREE.Quaternion().setFromUnitVectors(ta, tb);
    normals.push(prev.clone().applyQuaternion(q).normalize());
  }
  const positions: number[] = [];
  const norms: number[] = [];
  let rings = 0;
  const ring = (
    center: THREE.Vector3,
    nrm: THREE.Vector3,
    bin: THREE.Vector3,
    r: number,
    sphereCenter: THREE.Vector3 | null,
  ): void => {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const out = nrm
        .clone()
        .multiplyScalar(Math.cos(a))
        .addScaledVector(bin, Math.sin(a));
      const pos = center.clone().addScaledVector(out, r);
      const nv = sphereCenter ? pos.clone().sub(sphereCenter).normalize() : out;
      positions.push(pos.x, pos.y, pos.z);
      norms.push(nv.x, nv.y, nv.z);
    }
    rings++;
  };
  const n0 = normals[0];
  if (!n0) return null;
  const b0 = new THREE.Vector3().crossVectors(t0, n0);
  // Tail cap: a quarter sphere, from its tip to the first full ring.
  for (const deg of [90, 65, 40, 18]) {
    const a = THREE.MathUtils.degToRad(deg);
    const center = first.clone().addScaledVector(t0, -radius * Math.sin(a));
    ring(center, n0, b0, radius * Math.cos(a), first);
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nrm = normals[i];
    const tan = tangents[i];
    if (!p || !nrm || !tan) return null;
    ring(p, nrm, new THREE.Vector3().crossVectors(tan, nrm), radius, null);
  }
  const index: number[] = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = (i + 1) * radial + j;
      const c = i * radial + ((j + 1) % radial);
      const d = (i + 1) * radial + ((j + 1) % radial);
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(index);
  return g;
}

/** See-through strength of a layer plate. */
const LAYER_OPACITY = 0.14;

function plateShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const easeOutBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** True when grid cell (x, y) lies within `radius` of the polyline `pts` (cell space). */
function nearBody(
  pts: readonly Vec3[],
  x: number,
  y: number,
  radius: number,
): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)),
    );
    if (Math.hypot(x - (a.x + vx * t), y - (a.y + vy * t)) < radius) {
      return true;
    }
  }
  return false;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export class BoardScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private readonly root = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly views = new Map<number, ArrowView>();
  private readonly plates: THREE.Mesh[] = [];
  /** When each layer finished clearing, in seconds. 0 while it still has arrows. */
  private layerClearT: number[] = [];
  /** True once a cleared layer has finished its vanish animation. */
  private layerGone: boolean[] = [];
  private readonly dots: THREE.InstancedMesh[] = [];
  private readonly headGeo = headGeometry();
  private readonly canvas: HTMLCanvasElement;
  private readonly level: Level;
  private readonly opts: SceneOptions;
  private oneColor: string | null = null;
  private readonly colors: Map<number, string>;
  private alive: ReadonlySet<number>;
  private layerView: LayerView = {
    gap: 0.3,
    hideFront: 0,
    xray: false,
    showLayers: true,
    showDots: false,
  };
  private hintId: number | null = null;
  /** Player's arrow speed setting: 1 is the demo's speed. */
  slideRate = 1;
  /**
   * Board turn like a turntable: spin about the board's own up axis, then tilt toward the
   * viewer. There is no roll, so the board never ends up sideways. The anchor is the
   * board's centre, at the root's origin.
   */
  private spin = 0;
  private tilt = 0;
  private readonly orient = new THREE.Quaternion();
  /** Where shadows land from their arrows, in board space. Follows the light as the board turns. */
  private readonly shadowOffset = new THREE.Vector3(0.07, -0.12, -0.12);
  private zoom = 1;
  private viewIsDefault = true;
  private viewTween: {
    readonly t0: number;
    readonly spin: number;
    readonly tilt: number;
    readonly zoom: number;
    readonly toSpin: number;
    readonly toTilt: number;
  } | null = null;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private env: THREE.Texture | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number } | null = null;
  private moved = false;
  private pinchStart = 0;
  private pinchZoom = 1;
  private readonly batches: THREE.Mesh[] = [];
  private readonly batchMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.34,
    metalness: 0.1,
    vertexColors: true,
  });
  /** Cuts arrows off at the plate edge, so a line sliding out vanishes at the border. */
  private readonly clipPlanes = [0, 1, 2, 3].map(() => new THREE.Plane());
  private readonly shadowMat = new THREE.MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  private readonly batchShadows: THREE.Mesh[] = [];
  private batchDirty = true;
  private lastRebuild = 0;
  private readonly dotAlpha: Float32Array[] = [];
  private look: (typeof LOOKS)[keyof typeof LOOKS] = LOOKS.dark;
  private readonly boardColor = new THREE.Color();
  private readonly dotColor = new THREE.Color();
  private sky: THREE.HemisphereLight | null = null;
  private dotsDirty = true;
  private dotsFading = false;
  private lastDots = performance.now() / 1000;
  /** Set when the last arrow is tapped. The win ripple starts once it has slid out. */
  private pendingWin: Vec3 | null = null;
  private win: { readonly t0: number; readonly from: Vec3 } | null = null;
  private hintStart = -10;
  private readonly reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private holdTimer = 0;
  private previewing = false;
  private readonly preview = new THREE.Group();
  private readonly previewGeo = new THREE.BoxGeometry(0.3, 0.08, 0.08);
  private readonly previewOk = new THREE.MeshBasicMaterial({
    color: '#4ade80',
  });
  private readonly previewBlocked = new THREE.MeshBasicMaterial({
    color: BLOCKED,
  });

  constructor(canvas: HTMLCanvasElement, level: Level, opts: SceneOptions) {
    this.canvas = canvas;
    this.level = level;
    this.colors = arrowColors(level);
    this.opts = opts;
    // Single layers face the player flat, like the demo. Stacks tilt so the layers read.
    this.resetView();
    this.alive = new Set(level.arrows.map((a) => a.id));
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !opts.lowPower,
      alpha: opts.backdrop === true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 2),
    );
    this.renderer.localClippingEnabled = true;
    this.shadowMat.clippingPlanes = this.clipPlanes;
    this.look = opts.dark ? LOOKS.dark : LOOKS.light;
    this.scene.background = opts.backdrop
      ? null
      : new THREE.Color(this.look.board);
    this.scene.add(this.root);
    this.root.add(this.preview);
    this.setupLights();
    this.buildPlates();
    for (const arrow of level.arrows) this.addArrow(arrow);
    this.startIntro();
    this.applyLayerView();
    this.refreshColors();
    this.attach();
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---- setup ----

  private setupLights(): void {
    if (!this.opts.lowPower) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.env;
      this.scene.environmentIntensity = 0.3;
      pmrem.dispose();
    }
    this.sky = new THREE.HemisphereLight(this.look.sky, this.look.board, 0.35);
    this.scene.add(this.sky);
    const key = new THREE.DirectionalLight('#ffffff', 1.7);
    key.position.set(-4, 7, 9);
    this.scene.add(key);
    // Mirror of the key light, so the board looks the same from behind.
    const backKey = new THREE.DirectionalLight('#ffffff', 1.7);
    backKey.position.set(-4, 7, -9);
    this.scene.add(backKey);
    const rim = new THREE.DirectionalLight('#a5f3fc', 0.5);
    rim.position.set(6, -3, -6);
    this.scene.add(rim);
  }

  private world(p: Vec3): THREE.Vector3 {
    const { width, height } = this.level;
    return new THREE.Vector3(
      p.x - (width - 1) / 2,
      -(p.y - (height - 1) / 2),
      this.layerZ(p.z),
    );
  }

  /** Depth of a layer. The centre between the first and last layer sits at 0. */
  private layerZ(z: number): number {
    return (z - (this.level.layers - 1) / 2) * this.layerSpacing();
  }

  /**
   * Points the drop shadows away from the key light. The light is fixed in the scene, so
   * in board space it moves as the board turns, and the shadows have to move with it.
   */
  private aimShadows(): void {
    const light = KEY_DIRECTION.clone().applyQuaternion(
      this.orient.clone().invert(),
    );
    const lift = Math.max(Math.abs(light.z), 0.45);
    const next = new THREE.Vector3(
      (-light.x / lift) * SHADOW_SHIFT,
      (-light.y / lift) * SHADOW_SHIFT,
      light.z >= 0 ? -SHADOW_DEPTH : SHADOW_DEPTH,
    );
    if (next.distanceToSquared(this.shadowOffset) < 1e-8) return;
    this.shadowOffset.copy(next);
    for (const v of this.views.values()) {
      v.shadowTube.position.copy(next);
      v.shadowHead.position.copy(v.head.position).add(next);
    }
    for (const s of this.batchShadows) s.position.copy(next);
  }

  /** Back to the opening view: facing the player, centred, at the default zoom. */
  resetView(animate = false): void {
    const tilt = this.level.layers > 1 ? 0.42 : 0;
    if (!animate || this.reduceMotion) {
      this.spin = 0;
      this.tilt = tilt;
      this.zoom = 1;
      this.viewTween = null;
      this.updateOrient();
      this.dirty = true;
      return;
    }
    // Take the shorter way round, so a board turned past a half turn does not spin back far.
    const turns = Math.round(this.spin / (Math.PI * 2));
    this.viewTween = {
      t0: performance.now() / 1000,
      spin: this.spin,
      tilt: this.tilt,
      zoom: this.zoom,
      toSpin: turns * Math.PI * 2,
      toTilt: tilt,
    };
    this.dirty = true;
  }

  /** Eases the view toward its opening state. Returns true while it is still moving. */
  private stepViewTween(now: number): boolean {
    const w = this.viewTween;
    if (!w) return false;
    const k = Math.min(1, (now - w.t0) / ANIM.viewReset);
    const e = 1 - Math.pow(1 - k, 3);
    this.spin = w.spin + (w.toSpin - w.spin) * e;
    this.tilt = w.tilt + (w.toTilt - w.tilt) * e;
    this.zoom = w.zoom + (1 - w.zoom) * e;
    if (k >= 1) {
      this.spin = 0;
      this.viewTween = null;
    }
    this.updateOrient();
    return true;
  }

  private reportView(): void {
    const turn = Math.PI * 2;
    const spin = Math.abs(this.spin - Math.round(this.spin / turn) * turn);
    const home = this.level.layers > 1 ? 0.42 : 0;
    const isDefault =
      spin < 0.01 &&
      Math.abs(this.tilt - home) < 0.01 &&
      Math.abs(this.zoom - 1) < 0.01;
    if (isDefault === this.viewIsDefault) return;
    this.viewIsDefault = isDefault;
    this.opts.onViewChange?.(isDefault);
  }

  private updateOrient(): void {
    this.orient.setFromEuler(new THREE.Euler(-this.tilt, this.spin, 0, 'XYZ'));
  }

  private layerSpacing(): number {
    return 0.9 + this.layerView.gap * 2.4;
  }

  private buildPlates(): void {
    const { width, height, layers } = this.level;
    const geo = new THREE.ShapeGeometry(
      plateShape(width + 0.8, height + 0.8, 0.6),
    );
    const dotGeo = new THREE.CircleGeometry(0.07, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (let z = 0; z < layers; z++) {
      // See-through from both sides, so the layers show when the board is turned around.
      const mat = new THREE.MeshBasicMaterial({
        color: this.look.plate,
        transparent: true,
        opacity: LAYER_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const plate = new THREE.Mesh(geo, mat);
      plate.userData.layer = z;
      plate.visible = this.opts.backdrop !== true;
      this.layerClearT.push(0);
      this.layerGone.push(false);
      this.root.add(plate);
      this.plates.push(plate);

      const dots = new THREE.InstancedMesh(dotGeo, dotMat, width * height);
      const m = new THREE.Matrix4();
      for (let i = 0; i < width * height; i++) {
        m.makeTranslation(
          (i % width) - (width - 1) / 2,
          -(Math.floor(i / width) - (height - 1) / 2),
          0,
        );
        dots.setMatrixAt(i, m);
      }
      dots.setColorAt(0, this.dotColor.set(this.look.dot));
      dots.userData.layer = z;
      this.dotAlpha.push(new Float32Array(width * height).fill(1));
      this.root.add(dots);
      this.dots.push(dots);
    }
  }

  private addArrow(arrow: Arrow): void {
    const path = arrowPath(this.level, arrow);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.34,
      metalness: 0.1,
      clippingPlanes: this.clipPlanes,
    });
    const group = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const head = new THREE.Mesh(this.headGeo, material);
    const shadowTube = new THREE.Mesh(tube.geometry, this.shadowMat);
    const shadowHead = new THREE.Mesh(this.headGeo, this.shadowMat);
    shadowTube.position.copy(this.shadowOffset);
    shadowHead.position.copy(this.shadowOffset);
    shadowTube.renderOrder = -1;
    shadowHead.renderOrder = -1;
    if (!this.opts.lowPower) group.add(shadowTube, shadowHead);
    const pick = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    pick.userData.arrowId = arrow.id;
    pick.layers.set(PICK_LAYER);
    const pickHead = new THREE.Mesh(this.headGeo, pick.material);
    pickHead.userData.arrowId = arrow.id;
    pickHead.layers.set(PICK_LAYER);
    group.add(tube, head, pick, pickHead);
    this.root.add(group);
    const layer = arrow.cells[0]?.z ?? 0;
    this.views.set(arrow.id, {
      arrow,
      path,
      group,
      tube,
      head,
      shadowTube,
      shadowHead,
      pick,
      pickHead,
      material,
      layer,
      batched: false,
      shown: arrow.cells,
      want: false,
      hasTube: false,
      solid: null,
      base: new THREE.Color('#ffffff'),
      state: 'idle',
      t0: 0,
      bump: 0,
      impacted: false,
      blockerId: undefined,
      flashUntil: 0,
      jiggleT0: -10,
      jiggleDir: new THREE.Vector3(),
    });
    this.shape(this.views.get(arrow.id), 0, true);
  }

  // ---- geometry ----

  private tubeGeometry(
    points: readonly Vec3[],
    radius: number,
    radial: number,
  ): THREE.BufferGeometry | null {
    const dense = roundCorners(points, CORNER, 10).map((p) => this.world(p));
    return tubeMesh(dense, radius, radial);
  }

  /** Shows the part of the path from `offset` to `offset + body length`. */
  private shape(
    view: ArrowView | undefined,
    offset: number,
    withPick: boolean,
    length?: number,
  ): void {
    if (!view) return;
    const { path, arrow } = view;
    const pts = subPath(path, offset, offset + (length ?? path.bodyLength));
    view.tube.geometry.dispose();
    const geo = this.tubeGeometry(
      pts,
      TUBE_RADIUS,
      this.opts.lowPower ? 6 : 10,
    );
    view.shown = pts;
    view.hasTube = geo !== null;
    view.tube.visible = geo !== null && !view.batched;
    view.head.visible = !view.batched;
    view.tube.geometry = geo ?? new THREE.BufferGeometry();
    view.shadowTube.geometry = view.tube.geometry;
    view.shadowTube.visible = view.tube.visible;
    view.shadowHead.visible = view.head.visible;
    if (withPick) {
      view.pick.geometry.dispose();
      view.pick.geometry =
        this.tubeGeometry(pts, PICK_RADIUS, 4) ?? new THREE.BufferGeometry();
    }
    const end = pts[pts.length - 1];
    if (!end) return;
    view.head.position.copy(this.world(end));
    view.head.quaternion.copy(
      this.headQuaternion(this.lastDirection(pts, arrow)),
    );
    view.pickHead.position.copy(view.head.position);
    view.pickHead.quaternion.copy(view.head.quaternion);
    view.shadowHead.position.copy(view.head.position).add(this.shadowOffset);
    view.shadowHead.quaternion.copy(view.head.quaternion);
  }

  /** Direction of the last stretch of the body, so the head turns with the path (FR-43). */
  private lastDirection(pts: readonly Vec3[], arrow: Arrow): Vec3 {
    const end = pts[pts.length - 1];
    if (!end) return arrow.dir;
    for (let k = pts.length - 2; k >= 0; k--) {
      const p = pts[k];
      if (!p) continue;
      const dx = end.x - p.x;
      const dy = end.y - p.y;
      const dz = end.z - p.z;
      if (Math.hypot(dx, dy, dz) > 0.05) return { x: dx, y: dy, z: dz };
    }
    return arrow.dir;
  }

  private headQuaternion(direction: Vec3): THREE.Quaternion {
    const dir = new THREE.Vector3(
      direction.x,
      -direction.y,
      direction.z,
    ).normalize();
    const normal =
      Math.abs(dir.z) > 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3().crossVectors(normal, dir);
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(dir, side, normal),
    );
  }

  // ---- merged layer meshes (N-2) ----

  /** The whole arrow, body and head, as one world-space geometry. Cached. */
  private solidFor(v: ArrowView): THREE.BufferGeometry | null {
    if (v.solid) return v.solid;
    const pts = subPath(v.path, 0, v.path.bodyLength);
    const parts: THREE.BufferGeometry[] = [];
    const tube = this.tubeGeometry(
      pts,
      TUBE_RADIUS,
      this.opts.lowPower ? 6 : 10,
    );
    if (tube) {
      const flat = tube.toNonIndexed();
      tube.dispose();
      flat.deleteAttribute('uv');
      parts.push(flat);
    }
    const end = pts[pts.length - 1];
    if (end) {
      const head = this.headGeo.clone();
      head.clearGroups();
      head.deleteAttribute('uv');
      head.applyMatrix4(
        new THREE.Matrix4().compose(
          this.world(end),
          this.headQuaternion(v.arrow.dir),
          new THREE.Vector3(1, 1, 1),
        ),
      );
      parts.push(head);
    }
    const first = parts[0];
    if (parts.length < 2) {
      v.solid = first ?? null;
      return v.solid;
    }
    v.solid = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    return v.solid;
  }

  private hintActive(v: ArrowView, now: number): boolean {
    return this.hintId === v.arrow.id && now < this.hintStart + ANIM.hintTime;
  }

  /** Which arrows can sit in the merged mesh: idle ones with nothing animating. */
  private syncBatched(now: number): void {
    let pending = false;
    for (const v of this.views.values()) {
      v.want =
        v.state === 'idle' &&
        v.flashUntil === 0 &&
        now >= v.jiggleT0 + ANIM.jiggle &&
        v.group.position.lengthSq() === 0 &&
        !this.hintActive(v, now);
      if (!v.want && v.batched) {
        // Leaving the merged mesh must show at once, or the arrow draws twice.
        v.batched = false;
        v.tube.visible = v.hasTube;
        v.head.visible = true;
        v.shadowTube.visible = v.hasTube;
        v.shadowHead.visible = true;
        this.batchDirty = true;
      } else if (v.want && !v.batched) {
        pending = true;
      }
    }
    // Arrows joining the merged mesh can wait a moment, so a burst costs one rebuild.
    if (pending && now - this.lastRebuild > 0.15) this.batchDirty = true;
  }

  private rebuildBatches(now: number): void {
    const { layers } = this.level;
    for (let z = 0; z < layers; z++) {
      const members: ArrowView[] = [];
      const geos: THREE.BufferGeometry[] = [];
      for (const v of this.views.values()) {
        if (v.layer !== z || !v.want) continue;
        const g = this.solidFor(v);
        if (!g) continue;
        members.push(v);
        geos.push(g);
      }
      let mesh = this.batches[z];
      if (geos.length === 0) {
        if (mesh) mesh.visible = false;
        const gone = this.batchShadows[z];
        if (gone) gone.visible = false;
        continue;
      }
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const colors = new Float32Array(
        merged.getAttribute('position').count * 3,
      );
      let o = 0;
      members.forEach((v, i) => {
        const c = this.displayColor(v, now);
        const n = geos[i]?.getAttribute('position').count ?? 0;
        for (let k = 0; k < n; k++) {
          colors[o++] = c.r;
          colors[o++] = c.g;
          colors[o++] = c.b;
        }
      });
      merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      if (mesh) {
        mesh.geometry.dispose();
        mesh.geometry = merged;
      } else {
        mesh = new THREE.Mesh(merged, this.batchMat);
        this.root.add(mesh);
        this.batches[z] = mesh;
      }
      mesh.visible = !this.hiddenLayer(z);
      if (!this.opts.lowPower) {
        let shadow = this.batchShadows[z];
        if (!shadow) {
          shadow = new THREE.Mesh(merged, this.shadowMat);
          shadow.position.copy(this.shadowOffset);
          shadow.renderOrder = -1;
          this.root.add(shadow);
          this.batchShadows[z] = shadow;
        }
        shadow.geometry = merged;
        shadow.visible = mesh.visible;
      }
      for (const v of members) {
        v.batched = true;
        v.tube.visible = false;
        v.head.visible = false;
        v.shadowTube.visible = false;
        v.shadowHead.visible = false;
      }
    }
    this.lastRebuild = now;
    this.dirty = true;
  }

  /** Arrows draw in along their paths, started one after another (FR-56). */
  private startIntro(): void {
    if (this.reduceMotion) return;
    const now = performance.now() / 1000;
    const all = [...this.views.values()];
    const step = Math.min(ANIM.introStep, ANIM.introMaxSpread / all.length);
    all.forEach((v, i) => {
      v.state = 'intro';
      v.t0 = now + i * step;
    });
  }

  private stepIntro(v: ArrowView, now: number): void {
    if (now < v.t0) {
      v.group.visible = false;
      return;
    }
    const k = Math.min(1, (now - v.t0) / ANIM.introDraw);
    if (k >= 1) {
      v.state = 'idle';
      this.dotsDirty = true;
      v.group.visible = !this.hiddenLayer(v.layer);
      this.shape(v, 0, false);
      return;
    }
    v.group.visible = !this.hiddenLayer(v.layer);
    const ease = 1 - (1 - k) * (1 - k);
    this.shape(v, 0, false, Math.max(0.05, ease * v.path.bodyLength));
  }

  private hiddenLayer(layer: number): boolean {
    return layer >= this.level.layers - this.layerView.hideFront;
  }

  /**
   * Win tide over the grid dots: a wave that sweeps across the board from left to right (FR-55).
   * It waits until the last arrow has slid out, then runs layer by layer in stacked levels.
   * `from` is kept for callers but the tide no longer starts at it.
   */
  ripple(from: Vec3): void {
    if (this.reduceMotion) return;
    this.pendingWin = from;
    this.dirty = true;
  }

  private maxRipple(): number {
    const { width, height, layers } = this.level;
    return (
      tideReach(width, height) * ANIM.rippleDelay +
      (layers - 1) * ANIM.rippleLayerDelay +
      ANIM.rippleTime
    );
  }

  /**
   * Grid dots: hidden under idle arrows and near moving ones, fading back in over
   * `dotFade` (FR-52), and bumping in a ripple on a win. Returns true while it is changing.
   */
  private updateDots(now: number): boolean {
    const dt = Math.min(0.05, now - this.lastDots);
    this.lastDots = now;
    const winning = this.win !== null;
    let moving = false;
    for (const v of this.views.values()) {
      if (v.state === 'exit' || v.state === 'bounce') moving = true;
    }
    if (!moving && !winning && !this.dotsDirty && !this.dotsFading) {
      return false;
    }
    this.dotsDirty = false;
    const { width, height, layers } = this.level;
    const fade = dt / ANIM.dotFade;
    let fading = false;
    for (let z = 0; z < layers; z++) {
      const mesh = this.dots[z];
      const alpha = this.dotAlpha[z];
      if (!mesh || !alpha) continue;
      const still = new Set<string>();
      const movers: ArrowView[] = [];
      for (const v of this.views.values()) {
        if (v.layer !== z) continue;
        if (v.state === 'idle' || v.state === 'intro') {
          for (const c of v.arrow.cells) still.add(`${c.x},${c.y}`);
        } else if (v.state === 'exit' || v.state === 'bounce') {
          movers.push(v);
        }
      }
      const m = new THREE.Matrix4();
      const color = new THREE.Color();
      for (let i = 0; i < width * height; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        // The page backdrop keeps every dot: only the arrows move over it.
        let under = !this.opts.backdrop && still.has(`${x},${y}`);
        for (
          let k = 0;
          k < movers.length && !under && !this.opts.backdrop;
          k++
        ) {
          under = nearBody(movers[k]?.shown ?? [], x, y, ANIM.dotNear);
        }
        const before = alpha[i] ?? 1;
        const next = under ? 0 : Math.min(1, before + fade);
        alpha[i] = next;
        if (next > 0 && next < 1) fading = true;
        let a = next;
        let scale = 1;
        color.set(this.look.dot);
        if (this.win) {
          const reach = tideReach(x, y) * ANIM.rippleDelay;
          const u =
            (now - this.win.t0 - reach - z * ANIM.rippleLayerDelay) /
            ANIM.rippleTime;
          if (u > 0 && u < 1) {
            const bump = easeOutBack(Math.min(1, u * 1.2)) * (1 - u);
            scale = 1 + (bump * 0.22) / 0.07;
            a = 0.9 * (1 - u * 0.5);
            color.set(POOL[(x + y) % POOL.length] ?? '#ffffff');
          }
        }
        color.lerp(this.boardColor.set(this.look.board), 1 - a);
        mesh.setColorAt(i, color);
        m.makeScale(a <= 0.005 ? 0 : scale, a <= 0.005 ? 0 : scale, 1);
        m.setPosition(x - (width - 1) / 2, -(y - (height - 1) / 2), 0);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.dotsFading = fading;
    if (this.win && now > this.win.t0 + this.maxRipple()) {
      this.win = null;
      this.dotsDirty = true;
    }
    this.dirty = true;
    return true;
  }

  // ---- state from the game ----

  /** Switch between the dark and light look. */
  setDark(dark: boolean): void {
    const look = dark ? LOOKS.dark : LOOKS.light;
    if (look === this.look) return;
    this.look = look;
    if (!this.opts.backdrop)
      this.scene.background = new THREE.Color(look.board);
    if (this.sky) {
      this.sky.color.set(look.sky);
      this.sky.groundColor.set(look.board);
    }
    for (const plate of this.plates) {
      const mat = plate.material;
      if (mat instanceof THREE.MeshBasicMaterial) mat.color.set(look.plate);
    }
    this.dotsDirty = true;
    this.dirty = true;
  }

  setOneColor(color: string | null): void {
    this.oneColor = color;
    this.refreshColors();
  }

  setAlive(alive: ReadonlySet<number>): void {
    this.alive = alive;
    this.dotsDirty = true;
    for (const view of this.views.values()) {
      const on = alive.has(view.arrow.id);
      if (on && (view.state === 'hidden' || view.state === 'exit')) {
        view.state = 'idle';
        view.group.position.set(0, 0, 0);
        this.shape(view, 0, true);
        view.group.visible = true;
      } else if (!on && view.state === 'idle') {
        view.state = 'hidden';
        view.group.visible = false;
      }
    }
    this.applyLayerView();
    this.refreshColors();
  }

  setLayerView(view: LayerView): void {
    const respace = view.gap !== this.layerView.gap;
    this.layerView = view;
    if (respace) {
      for (const v of this.views.values()) {
        v.solid?.dispose();
        v.solid = null;
        if (v.state === 'idle') this.shape(v, 0, true);
      }
    }
    this.applyLayerView();
    this.refreshColors();
  }

  setHint(id: number | null): void {
    this.hintId = id;
    this.hintStart = performance.now() / 1000;
    this.dirty = true;
  }

  /** Starts the slide out. The game has already removed the arrow. */
  exit(id: number, now = performance.now() / 1000): void {
    const v = this.views.get(id);
    if (!v || v.state === 'exit') return;
    v.state = 'exit';
    v.t0 = now;
    // The game removes the arrow first, which hides its group. Show it for the slide.
    v.group.visible = !this.hiddenLayer(v.layer);
    this.dotsDirty = true;
    if (this.hintId === id) this.hintId = null;
    this.dirty = true;
  }

  /** A blocked tap: nudge forward, bump the blocker, come back, flash red. */
  bump(id: number, now = performance.now() / 1000): void {
    const v = this.views.get(id);
    if (!v || v.state !== 'idle') return;
    const rest = this.level.arrows.filter((a) => this.alive.has(a.id));
    const occ = occupancy(rest);
    const blocker = blockerOf(this.level, v.arrow, occ);
    const ray = exitRay(this.level, v.arrow);
    let cells = 1;
    for (let i = 0; i < ray.length; i++) {
      const c = ray[i];
      if (c && occ.has(key(c))) {
        cells = i + 1;
        break;
      }
    }
    v.state = 'bounce';
    v.t0 = now;
    v.bump = bumpDistance(cells);
    v.impacted = false;
    v.blockerId = blocker;
    v.flashUntil = now + ANIM.flashFull + ANIM.flashFade;
    this.dotsDirty = true;
    this.refreshColors();
    this.dirty = true;
  }

  // ---- layer view, colours ----

  private applyLayerView(): void {
    const { layers } = this.level;
    const firstHidden = layers - this.layerView.hideFront;
    const hide = (layer: number): boolean => layer >= firstHidden;
    this.plates.forEach(
      (p) =>
        (p.visible =
          this.layerView.showLayers &&
          !hide(Number(p.userData.layer)) &&
          !this.layerGone[Number(p.userData.layer)]),
    );
    this.dots.forEach(
      (d) =>
        (d.visible =
          this.layerView.showDots &&
          !hide(Number(d.userData.layer)) &&
          !this.layerGone[Number(d.userData.layer)]),
    );
    this.batches.forEach((b, z) => (b.visible = !hide(z)));
    this.plates.forEach((p, z) => p.position.set(0, 0, this.layerZ(z)));
    this.dots.forEach((d, z) => d.position.set(0, 0, this.layerZ(z) + 0.01));
    for (const v of this.views.values()) {
      v.group.visible = v.state !== 'hidden' && !hide(v.layer);
    }
    this.dirty = true;
  }

  private displayColor(v: ArrowView, now: number): THREE.Color {
    const color = v.base.clone();
    if (v.flashUntil > 0) {
      const t = now - (v.flashUntil - ANIM.flashFull - ANIM.flashFade);
      if (t >= 0 && t < ANIM.flashFull + ANIM.flashFade) {
        const k =
          t < ANIM.flashFull ? 1 : 1 - (t - ANIM.flashFull) / ANIM.flashFade;
        color.lerp(new THREE.Color(BLOCKED), k);
      }
    }
    if (this.hintActive(v, now)) {
      const k = Math.sin(((now - this.hintStart) / ANIM.hintTime) * Math.PI);
      color.lerp(WHITE, ANIM.hintWhite * k);
    }
    return color;
  }

  /** Colour and head size changes that run every frame: the blocked flash and the hint. */
  private updateEffects(now: number): boolean {
    let active = false;
    for (const v of this.views.values()) {
      const hint = this.hintActive(v, now);
      const flash = v.flashUntil > 0 && now < v.flashUntil;
      const wasHint = v.head.scale.y !== 1;
      if (!hint && !flash && !wasHint) continue;
      active = true;
      v.material.color.copy(this.displayColor(v, now));
      const k = hint
        ? Math.sin(((now - this.hintStart) / ANIM.hintTime) * Math.PI)
        : 0;
      const s = 1 + ANIM.hintHead * k;
      v.head.scale.set(1, s, s);
      if (!hint && wasHint) {
        v.head.scale.set(1, 1, 1);
        this.batchDirty = true;
      }
    }
    return active;
  }

  private refreshColors(): void {
    const now = performance.now() / 1000;
    const xray = this.layerView.xray;
    for (const v of this.views.values()) {
      v.base = new THREE.Color(
        this.oneColor ?? this.colors.get(v.arrow.id) ?? '#ffffff',
      );
      v.material.color.copy(this.displayColor(v, now));
      v.material.transparent = xray;
      v.material.opacity = xray ? 0.42 : 1;
      v.material.depthWrite = !xray;
    }
    this.batchMat.transparent = xray;
    this.batchMat.opacity = xray ? 0.42 : 1;
    this.batchMat.depthWrite = !xray;
    this.batchMat.needsUpdate = true;
    this.batchDirty = true;
    this.dirty = true;
  }

  // ---- loop ----

  private loop(): void {
    if (this.disposed) return;
    const now = performance.now() / 1000;
    let animating = false;
    this.reportView();
    for (const v of this.views.values()) {
      if (v.state === 'exit') {
        animating = true;
        const d = slideDistance(now - v.t0, this.slideRate);
        if (d >= v.path.finish) {
          v.state = 'hidden';
          this.dotsDirty = true;
          v.group.visible = false;
        } else {
          this.shape(v, d, false);
        }
      } else if (v.state === 'bounce') {
        animating = true;
        this.stepBounce(v, now);
      } else if (v.state === 'intro') {
        animating = true;
        this.stepIntro(v, now);
      }
      if (now < v.jiggleT0 + ANIM.jiggle) {
        animating = true;
        const k = (now - v.jiggleT0) / ANIM.jiggle;
        const amp = Math.sin(k * Math.PI) * ANIM.jiggleSize;
        v.group.position.copy(v.jiggleDir).multiplyScalar(amp);
      } else if (
        v.jiggleT0 > 0 &&
        v.group.position.lengthSq() > 0 &&
        v.state === 'idle'
      ) {
        v.group.position.set(0, 0, 0);
        this.dirty = true;
      }
      if (v.flashUntil > 0 && now >= v.flashUntil) {
        v.flashUntil = 0;
        this.refreshColors();
      }
    }
    this.syncBatched(now);
    if (this.batchDirty) {
      this.batchDirty = false;
      this.rebuildBatches(now);
    }
    if (this.pendingWin) {
      let sliding = false;
      for (const v of this.views.values())
        if (v.state === 'exit') sliding = true;
      if (!sliding) {
        this.win = { t0: now, from: this.pendingWin };
        this.pendingWin = null;
      }
      animating = true;
    }
    if (this.updateEffects(now)) animating = true;
    if (this.stepViewTween(now)) animating = true;
    if (this.stepLayerClear(now)) animating = true;
    if (this.updateDots(now) || this.win) animating = true;
    if (animating || this.dirty) {
      this.dirty = false;
      this.renderFrame();
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  /**
   * A layer with no arrows left fades and shrinks away. Its dots go with it, except on a win,
   * where they stay for the ripple. Returns true while one is still moving.
   */
  private stepLayerClear(now: number): boolean {
    // The page backdrop keeps its layer and dots, even with no arrows left.
    if (this.opts.backdrop) return false;
    let moving = false;
    const layers = this.level.layers;
    const left = new Array<boolean>(layers).fill(false);
    // A line that crosses layers keeps every layer it touches.
    for (const v of this.views.values()) {
      if (v.state === 'hidden') continue;
      for (const c of v.arrow.cells) left[c.z] = true;
    }
    const won = left.every((l) => !l);
    for (let z = 0; z < layers; z++) {
      const plate = this.plates[z];
      const dots = this.dots[z];
      if (!plate || !dots) continue;
      const mat = plate.material as THREE.MeshBasicMaterial;
      const t0 = this.layerClearT[z] ?? 0;
      if (left[z]) {
        if (t0 > 0) {
          // A restart brought arrows back.
          this.layerClearT[z] = 0;
          this.layerGone[z] = false;
          mat.opacity = LAYER_OPACITY;
          plate.scale.setScalar(1);
          dots.scale.setScalar(1);
          this.applyLayerView();
        }
        continue;
      }
      if (this.layerGone[z]) continue;
      if (t0 === 0) this.layerClearT[z] = now;
      const k = Math.min(1, (now - (t0 || now)) / ANIM.layerClear);
      const e = k * k;
      mat.opacity = LAYER_OPACITY * (1 - e);
      plate.scale.setScalar(1 - 0.12 * e);
      if (!won) dots.scale.setScalar(1 - 0.12 * e);
      if (k >= 1) {
        this.layerGone[z] = true;
        this.applyLayerView();
      } else {
        moving = true;
      }
    }
    return moving;
  }

  private stepBounce(v: ArrowView, now: number): void {
    const t = now - v.t0;
    const { forward, back } = ANIM;
    let offset: number;
    if (t < forward) {
      const k = t / forward;
      offset = v.bump * (1 - (1 - k) * (1 - k));
    } else {
      if (!v.impacted) {
        v.impacted = true;
        const b =
          v.blockerId === undefined ? undefined : this.views.get(v.blockerId);
        if (b) {
          b.jiggleT0 = now;
          b.jiggleDir
            .set(v.arrow.dir.x, -v.arrow.dir.y, v.arrow.dir.z)
            .normalize();
        }
      }
      const k = (t - forward) / back;
      if (k >= 1) {
        v.state = 'idle';
        this.dotsDirty = true;
        this.shape(v, 0, false);
        return;
      }
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      offset = v.bump * (1 - ease);
    }
    this.shape(v, offset, false);
  }

  private renderFrame(): void {
    const { width, height } = this.level;
    const half = new THREE.Vector3(
      (width + 0.8) / 2,
      (height + 0.8) / 2,
      ((this.level.layers - 1) * this.layerSpacing()) / 2,
    );
    // Fit the turned board: how far its corners reach sideways and toward the camera.
    let reach = 0;
    let front = 0;
    const corner = new THREE.Vector3();
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          corner
            .set(half.x * sx, half.y * sy, half.z * sz)
            .applyQuaternion(this.orient);
          reach = Math.max(reach, Math.abs(corner.x), Math.abs(corner.y));
          front = Math.max(front, corner.z);
        }
    // Margin leaves room for the floating panels. A narrow canvas is fit by its width.
    const radius = reach * 1.22;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fit = Math.tan(fov / 2) * Math.min(1, this.camera.aspect);
    let dist = (radius / fit + front) / this.zoom;
    if (this.opts.backdrop) {
      // Cover the canvas: the board fills both sides and the overflow is cropped.
      const tanY = Math.tan(fov / 2);
      const needY = half.y / tanY;
      const needX = half.x / (tanY * this.camera.aspect);
      dist = Math.min(needX, needY) + front;
    }
    const depth = half.length();
    this.camera.position.set(0, 0, dist);
    this.camera.near = Math.max(0.1, dist - depth * 2);
    this.camera.far = dist + depth * 2;
    this.camera.updateProjectionMatrix();
    this.root.quaternion.copy(this.orient);
    this.root.updateMatrixWorld();
    // The plate edges, turned with the board. Anything outside them is cut away.
    const edge = [
      [1, 0, width / 2 + 0.4],
      [-1, 0, width / 2 + 0.4],
      [0, 1, height / 2 + 0.4],
      [0, -1, height / 2 + 0.4],
    ] as const;
    edge.forEach(([nx, ny, c], i) => {
      this.clipPlanes[i]
        ?.set(new THREE.Vector3(nx, ny, 0), c)
        .applyMatrix4(this.root.matrixWorld);
    });
    this.aimShadows();
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // ---- input ----

  private attach(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private readonly onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.viewTween = null;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.downAt = { x: e.clientX, y: e.clientY };
      this.moved = false;
      this.previewing = false;
      this.holdTimer = window.setTimeout(
        () => this.startPreview(e.clientX, e.clientY),
        ANIM.hold * 1000,
      );
    } else if (this.pointers.size === 2) {
      this.moved = true;
      this.endHold();
      this.pinchStart = this.pinchDistance();
      this.pinchZoom = this.zoom;
    }
  };

  private readonly onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.pinchStart > 0)
        this.setZoom(this.pinchZoom * (d / this.pinchStart));
      return;
    }
    if (this.downAt) {
      const far = Math.hypot(
        e.clientX - this.downAt.x,
        e.clientY - this.downAt.y,
      );
      if (far > 6) {
        this.moved = true;
        this.endHold();
      }
    }
    if (this.moved) {
      this.spin += (e.clientX - prev.x) * 0.008;
      this.tilt = clamp(this.tilt - (e.clientY - prev.y) * 0.008, -1.45, 1.45);
      this.updateOrient();
      this.dirty = true;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    // A hold that showed a preview is not a tap (FR-54).
    const wasTap = !this.moved && !this.previewing && this.pointers.size === 1;
    this.endHold();
    this.pointers.delete(e.pointerId);
    if (wasTap) this.tapAt(e.clientX, e.clientY);
    if (this.pointers.size === 0) this.downAt = null;
  };

  private readonly onCancel = (e: PointerEvent): void => {
    this.endHold();
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.downAt = null;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015));
  };

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private setZoom(z: number): void {
    this.viewTween = null;
    this.zoom = clamp(z, 0.6, 3);
    this.dirty = true;
  }

  private pickAt(clientX: number, clientY: number): number | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.layers.set(PICK_LAYER);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const v of this.views.values()) {
      if (v.group.visible && v.state === 'idle')
        targets.push(v.pick, v.pickHead);
    }
    this.root.updateMatrixWorld(true);
    // The nearest hit wins, so the front layer is picked first.
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    const id: unknown = hit?.object.userData.arrowId;
    return typeof id === 'number' ? id : undefined;
  }

  private tapAt(clientX: number, clientY: number): void {
    const id = this.pickAt(clientX, clientY);
    if (id !== undefined) this.opts.onTap(id);
  }

  // ---- hold to preview (FR-54) ----

  /** Stops a pending hold and removes any preview. */
  private endHold(): void {
    window.clearTimeout(this.holdTimer);
    if (this.preview.children.length > 0) {
      this.preview.clear();
      this.dirty = true;
    }
    // `previewing` stays set until the pointer lifts, so release does not tap.
  }

  private startPreview(clientX: number, clientY: number): void {
    if (this.moved || this.pointers.size !== 1) return;
    const id = this.pickAt(clientX, clientY);
    const v = id === undefined ? undefined : this.views.get(id);
    if (!v) return;
    this.previewing = true;
    const rest = this.level.arrows.filter((a) => this.alive.has(a.id));
    const ray = exitRay(this.level, v.arrow);
    const occ = occupancy(rest);
    const blockedAt = ray.findIndex((c) => occ.has(key(c)));
    const blocked = blockedAt >= 0;
    // A dashed line from the head to the blocker, or on past the board edge.
    const reach = blocked ? blockedAt + 1 : ray.length + 1;
    const head = headOf(v.arrow);
    const mat = blocked ? this.previewBlocked : this.previewOk;
    const dir = new THREE.Vector3(
      v.arrow.dir.x,
      -v.arrow.dir.y,
      v.arrow.dir.z,
    ).normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      dir,
    );
    for (let d = 0.75; d < reach; d += 0.5) {
      const dash = new THREE.Mesh(this.previewGeo, mat);
      dash.quaternion.copy(turn);
      dash.position.copy(
        this.world({
          x: head.x + v.arrow.dir.x * d,
          y: head.y + v.arrow.dir.y * d,
          z: head.z + v.arrow.dir.z * d,
        }),
      );
      this.preview.add(dash);
    }
    this.dirty = true;
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.holdTimer);
    this.previewGeo.dispose();
    this.batchMat.dispose();
    for (const v of this.views.values()) v.solid?.dispose();
    this.previewOk.dispose();
    this.previewBlocked.dispose();
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('wheel', this.onWheel);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
        if (o.geometry !== this.headGeo) o.geometry.dispose();
        const m = o.material;
        (Array.isArray(m) ? m : [m]).forEach((mat) => mat.dispose());
      }
    });
    this.headGeo.dispose();
    this.env?.dispose();
    this.renderer.dispose();
  }
}

/** True when the browser can make a WebGL context. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
