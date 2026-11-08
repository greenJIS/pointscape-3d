/**
 * Developer unlock-all (FR-25, FR-26). On in the Vite dev server, or when a build
 * sets VITE_UNLOCK_ALL=true. The published build has neither and no URL switch.
 */
export const unlockAllEnabled = (): boolean =>
  import.meta.env.DEV || import.meta.env.VITE_UNLOCK_ALL === 'true';
