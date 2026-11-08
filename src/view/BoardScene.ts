import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  blockerOf,
  exitRay,
  freeArrowIds,
  headOf,
  occupancy,
} from '../core/board';
import type { Arrow, Level, Vec3 } from '../core/types';
import { key } from '../core/vec';
import { roundCorners } from './corners';
import { BLOCKED, arrowColors } from './palette';
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
}

export interface SceneOptions {
  readonly lowPower: boolean;
  readonly onTap: (arrowId: number) => void;
}

type State = 'idle' | 'exit' | 'bounce' | 'hidden';

interface ArrowView {
  readonly arrow: Arrow;
  readonly path: ArrowPath;
  readonly group: THREE.Group;
  readonly tube: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly pick: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly layer: number;
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

const TUBE_RADIUS = 0.16;
const PICK_RADIUS = 0.42;
const CORNER = 0.34;
const PLATE = new THREE.Color('#1e293b');
const DIM = 0.5;

/** The barbed head, pointing along +x, a little over one cell long. */
function headGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.62, 0);
  s.lineTo(-0.05, 0.42);
  s.lineTo(-0.2, 0);
  s.lineTo(-0.05, -0.42);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  g.translate(0, 0, -0.1);
  return g;
}

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
  private readonly dots: THREE.InstancedMesh[] = [];
  private readonly headGeo = headGeometry();
  private readonly canvas: HTMLCanvasElement;
  private readonly level: Level;
  private readonly opts: SceneOptions;
  private oneColor: string | null = null;
  private readonly colors: Map<number, string>;
  private alive: ReadonlySet<number>;
  private layerView: LayerView = { gap: 0.3, hideFront: 0, xray: false };
  private hintId: number | null = null;
  private yaw = 0;
  private pitch = 0.42;
  private zoom = 1;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private env: THREE.Texture | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number } | null = null;
  private moved = false;
  private pinchStart = 0;
  private pinchZoom = 1;
  private holdTimer = 0;
  private previewing = false;
  private readonly preview = new THREE.Group();
  private readonly previewGeo = new THREE.SphereGeometry(0.11, 10, 10);
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
    this.alive = new Set(level.arrows.map((a) => a.id));
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !opts.lowPower,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 2),
    );
    this.scene.background = new THREE.Color('#0f172a');
    this.scene.add(this.root);
    this.root.add(this.preview);
    this.setupLights();
    this.buildPlates();
    for (const arrow of level.arrows) this.addArrow(arrow);
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
    this.scene.add(new THREE.HemisphereLight('#e2e8f0', '#1e293b', 0.35));
    const key = new THREE.DirectionalLight('#ffffff', 1.7);
    key.position.set(-4, 7, 9);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#a5f3fc', 0.9);
    rim.position.set(6, -3, -6);
    this.scene.add(rim);
  }

  private world(p: Vec3): THREE.Vector3 {
    const { width, height } = this.level;
    return new THREE.Vector3(
      p.x - (width - 1) / 2,
      -(p.y - (height - 1) / 2),
      p.z * this.layerSpacing(),
    );
  }

  private layerSpacing(): number {
    return 0.9 + this.layerView.gap * 2.4;
  }

  private buildPlates(): void {
    const { width, height, layers } = this.level;
    const geo = new THREE.ShapeGeometry(
      plateShape(width + 0.8, height + 0.8, 0.6),
    );
    const dotGeo = new THREE.CircleGeometry(0.055, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#64748b' });
    for (let z = 0; z < layers; z++) {
      const mat = new THREE.MeshBasicMaterial({
        color: z === 0 ? PLATE : '#475569',
        transparent: z > 0,
        opacity: z === 0 ? 1 : 0.16,
        depthWrite: z === 0,
      });
      const plate = new THREE.Mesh(geo, mat);
      plate.userData.layer = z;
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
      dots.userData.layer = z;
      this.root.add(dots);
      this.dots.push(dots);
    }
  }

  private addArrow(arrow: Arrow): void {
    const path = arrowPath(this.level, arrow);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.28,
      metalness: 0.08,
    });
    const group = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const head = new THREE.Mesh(this.headGeo, material);
    const pick = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.userData.arrowId = arrow.id;
    group.add(tube, head, pick);
    this.root.add(group);
    const layer = arrow.cells[0]?.z ?? 0;
    this.views.set(arrow.id, {
      arrow,
      path,
      group,
      tube,
      head,
      pick,
      material,
      layer,
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
    const dense = roundCorners(points, CORNER).map((p) => this.world(p));
    if (dense.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(dense, false, 'centripetal');
    return new THREE.TubeGeometry(
      curve,
      Math.max(6, dense.length * 2),
      radius,
      radial,
      false,
    );
  }

  /** Shows the part of the path from `offset` to `offset + body length`. */
  private shape(
    view: ArrowView | undefined,
    offset: number,
    withPick: boolean,
  ): void {
    if (!view) return;
    const { path, arrow } = view;
    const pts = subPath(path, offset, offset + path.bodyLength);
    view.tube.geometry.dispose();
    const geo = this.tubeGeometry(pts, TUBE_RADIUS, 10);
    view.tube.visible = geo !== null;
    view.tube.geometry = geo ?? new THREE.BufferGeometry();
    if (withPick) {
      view.pick.geometry.dispose();
      view.pick.geometry =
        this.tubeGeometry(pts, PICK_RADIUS, 4) ?? new THREE.BufferGeometry();
    }
    const end = pts[pts.length - 1];
    if (!end) return;
    view.head.position.copy(this.world(end));
    const dir = new THREE.Vector3(
      arrow.dir.x,
      -arrow.dir.y,
      arrow.dir.z,
    ).normalize();
    const normal =
      Math.abs(dir.z) > 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3().crossVectors(normal, dir);
    view.head.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(dir, side, normal),
    );
  }

  // ---- state from the game ----

  setOneColor(color: string | null): void {
    this.oneColor = color;
    this.refreshColors();
  }

  setAlive(alive: ReadonlySet<number>): void {
    this.alive = alive;
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
        if (v.state === 'idle') this.shape(v, 0, true);
      }
    }
    this.applyLayerView();
    this.refreshColors();
  }

  setHint(id: number | null): void {
    const old = this.hintId === null ? undefined : this.views.get(this.hintId);
    if (old) this.pulse(old, 0);
    this.hintId = id;
    this.dirty = true;
  }

  /** Starts the slide out. The game has already removed the arrow. */
  exit(id: number, now = performance.now() / 1000): void {
    const v = this.views.get(id);
    if (!v || v.state === 'exit') return;
    v.state = 'exit';
    v.t0 = now;
    if (this.hintId === id) this.setHint(null);
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
    v.flashUntil = now + 0.45;
    this.refreshColors();
    this.dirty = true;
  }

  // ---- layer view, colours ----

  private applyLayerView(): void {
    const { layers } = this.level;
    const firstHidden = layers - this.layerView.hideFront;
    const hide = (layer: number): boolean => layer >= firstHidden;
    this.plates.forEach((p) => (p.visible = !hide(Number(p.userData.layer))));
    this.dots.forEach((d) => (d.visible = !hide(Number(d.userData.layer))));
    this.plates.forEach((p, z) =>
      p.position.set(0, 0, z * this.layerSpacing() - 0.3),
    );
    this.dots.forEach((d, z) =>
      d.position.set(0, 0, z * this.layerSpacing() - 0.28),
    );
    for (const v of this.views.values()) {
      v.group.visible = v.state !== 'hidden' && !hide(v.layer);
    }
    this.dirty = true;
  }

  private refreshColors(): void {
    const stacked = this.level.layers > 1;
    const free = stacked
      ? new Set(
          freeArrowIds(
            this.level,
            this.level.arrows.filter((a) => this.alive.has(a.id)),
          ),
        )
      : null;
    const now = performance.now() / 1000;
    for (const v of this.views.values()) {
      v.base = new THREE.Color(
        this.oneColor ?? this.colors.get(v.arrow.id) ?? '#ffffff',
      );
      const flashing = now < v.flashUntil;
      const color = flashing ? new THREE.Color(BLOCKED) : v.base.clone();
      // In stacked levels, blocked arrows are dimmed (FR-62).
      if (!flashing && free && !free.has(v.arrow.id)) color.lerp(PLATE, DIM);
      v.material.color.copy(color);
      v.material.transparent = this.layerView.xray;
      v.material.opacity = this.layerView.xray ? 0.42 : 1;
      v.material.depthWrite = !this.layerView.xray;
    }
    this.dirty = true;
  }

  private pulse(v: ArrowView, amount: number): void {
    v.head.scale.setScalar(1 + amount * 0.35);
    v.material.emissive.setScalar(amount * 0.45);
  }

  // ---- loop ----

  private loop(): void {
    if (this.disposed) return;
    const now = performance.now() / 1000;
    let animating = false;
    for (const v of this.views.values()) {
      if (v.state === 'exit') {
        animating = true;
        const d = slideDistance(now - v.t0);
        if (d >= v.path.finish) {
          v.state = 'hidden';
          v.group.visible = false;
        } else {
          this.shape(v, d, false);
        }
      } else if (v.state === 'bounce') {
        animating = true;
        this.stepBounce(v, now);
      }
      if (now < v.jiggleT0 + ANIM.jiggle) {
        animating = true;
        const k = (now - v.jiggleT0) / ANIM.jiggle;
        const amp = Math.sin(k * Math.PI * 4) * (1 - k) * ANIM.jiggleSize;
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
    if (this.hintId !== null) {
      const h = this.views.get(this.hintId);
      if (h) {
        animating = true;
        this.pulse(h, 0.5 + 0.5 * Math.sin(now * 8));
      }
    }
    if (animating || this.dirty) {
      this.dirty = false;
      this.renderFrame();
    }
    this.raf = requestAnimationFrame(this.loop);
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
    const spread = (this.level.layers - 1) * this.layerSpacing();
    const radius = (Math.max(width, height) / 2) * 1.25 + spread / 2;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (radius * 1.0) / Math.tan(fov / 2) / this.zoom;
    this.camera.position.set(0, 0, dist);
    this.camera.near = Math.max(0.1, dist - radius * 2);
    this.camera.far = dist + radius * 2;
    this.camera.updateProjectionMatrix();
    this.root.rotation.set(-this.pitch, this.yaw, 0, 'XYZ');
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
      this.yaw = clamp(this.yaw + (e.clientX - prev.x) * 0.008, -1.4, 1.4);
      this.pitch = clamp(this.pitch + (e.clientY - prev.y) * 0.008, -0.1, 1.25);
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
    this.zoom = clamp(z, 0.6, 3);
    this.dirty = true;
  }

  private pickAt(clientX: number, clientY: number): number | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const v of this.views.values()) {
      if (v.group.visible && v.state === 'idle') targets.push(v.pick);
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
    // Dots run from the head to the board edge, or stop short of the blocker.
    const reach = blocked ? blockedAt + 0.5 : ray.length + 0.5;
    const head = headOf(v.arrow);
    const mat = blocked ? this.previewBlocked : this.previewOk;
    for (let d = 0.8; d <= Math.max(reach, 0.8); d += 0.4) {
      const dot = new THREE.Mesh(this.previewGeo, mat);
      dot.position.copy(
        this.world({
          x: head.x + v.arrow.dir.x * d,
          y: head.y + v.arrow.dir.y * d,
          z: head.z + v.arrow.dir.z * d,
        }),
      );
      this.preview.add(dot);
    }
    this.dirty = true;
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.holdTimer);
    this.previewGeo.dispose();
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
