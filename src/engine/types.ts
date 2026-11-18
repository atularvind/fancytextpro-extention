export type CategoryId =
  | 'New'
  | 'Unique'
  | 'CoolText'
  | 'Elegant'
  | 'Lunicodes'
  | 'Squiggle'
  | 'Symbolic'
  | 'Freaky'
  | 'BoxText'
  | 'StarDecorated'
  | 'HeartDecorated'
  | 'DecoratedText'
  | 'JoinerText'
  | 'EmoticonText'
  | 'LineText';

export interface Style {
  /** Stable id. Matches the website's style id where one exists. */
  id: string;
  /** Display name, as used on FancyTextPro.com. */
  name: string;
  category: CategoryId;
  /** 'site' = derived from and verified against the website; 'native' = implemented here. */
  source: 'site' | 'native';
  /** Uses scripts that many fonts/platforms lack and may render as boxes. */
  fragile: boolean;
  /** Pure transform from plain text to styled text. */
  transform: (text: string) => string;
}

/** Declarative model used by website-derived styles. */
export interface CharModel {
  /** Text placed before each line. */
  p: string;
  /** Text placed after each line. */
  x: string;
  /** Text placed between adjacent characters. */
  j: string;
  /** Reverse the character order (e.g. mirror/flip styles). */
  rev: boolean;
  /** Wrap every character (after mapping) in [before, after], e.g. strike-through marks or boxes. */
  wrap?: readonly [string, string];
  /** Replacement for a space, if not a plain space. */
  sp?: string;
  /** Character → replacement. Unlisted characters pass through unchanged. */
  map: ReadonlyMap<string, string>;
}
