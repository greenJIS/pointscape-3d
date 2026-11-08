export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One arrow: cells run tail to head, `dir` is where the head points (FR-2). */
export interface Arrow {
  readonly id: number;
  readonly cells: readonly Vec3[];
  readonly dir: Vec3;
  /** Reserved for combined groups, which are not in v1 (FR-10). */
  readonly groupId?: number;
}

export interface Level {
  readonly width: number;
  readonly height: number;
  readonly layers: number;
  readonly arrows: readonly Arrow[];
}
