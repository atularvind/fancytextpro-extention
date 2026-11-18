/** Messages from the popup to the background. */
export interface InsertMessage {
  type: 'ftp:insert';
  tabId: number;
  styleId: string;
  text: string;
  /** Selection text read when the popup opened; insertion is refused if the page selection has changed. */
  expectedSelection: string | null;
}

/** Ask the background for text handed over by "More styles…" (and clear it). */
export interface TakePendingMessage {
  type: 'ftp:take-pending';
}

export type PopupMessage = InsertMessage | TakePendingMessage;
