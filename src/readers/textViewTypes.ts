import type { ReaderPreferences } from "../types/library";
import type { TextSourceModel } from "../lib/textDocument";
import type { ReaderContentInteraction } from "../lib/readerContentEvents";

export interface TextMatch {
  start: number;
  end: number;
}

export interface TextViewHandle {
  goTo: (offset: number) => void;
  previous: () => void;
  next: () => void;
}

export interface TextViewProps {
  onContentInteraction?: (event: ReaderContentInteraction) => void;
  model: TextSourceModel;
  preferences: ReaderPreferences;
  initialOffset: number;
  activeMatch?: TextMatch;
  layoutRevision?: string;
  onOffset: (offset: number, progression: number) => void;
  onReady: () => void;
}
