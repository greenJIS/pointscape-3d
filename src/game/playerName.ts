import type { Rng } from '../core/rng';

export const MAX_NAME_LENGTH = 16;

export const ANIMALS: readonly string[] = [
  'Otter',
  'Fox',
  'Panda',
  'Koala',
  'Falcon',
  'Lynx',
  'Penguin',
  'Gecko',
  'Owl',
  'Badger',
  'Dolphin',
  'Tiger',
  'Raccoon',
  'Hedgehog',
  'Narwhal',
  'Lemur',
  'Capybara',
  'Walrus',
  'Heron',
  'Wombat',
];

/** Trim, collapse repeated spaces, cut to 16 characters (FR-65). May return an empty string. */
export const cleanName = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH).trim();

export const randomAnimalName = (rng: Rng): string => rng.pick(ANIMALS);

/** The name to save for what the player typed. Empty input gets an animal (FR-64). */
export const nameOrAnimal = (raw: string, rng: Rng): string =>
  cleanName(raw) || randomAnimalName(rng);
