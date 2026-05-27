export interface Question {
  id: string;
  text: string;
}

export interface Regular {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface Suspect {
  id: string;
  fakeName: string;
  answers: Record<string, string>;
  realNameGuesses: string[];
  isSolved: boolean;
  x: number;
  y: number;
}

export interface RegularPreset {
  name: string;
  regulars: Regular[];
}
