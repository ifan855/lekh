"use client";

import * as React from "react";

import {
  DEFAULT_READER_SETTINGS,
  loadReaderSettings,
  saveReaderSettings,
  type ReaderSettings,
} from "@/lib/reader-settings";

/**
 * Reader settings, hydrated from localStorage and persisted on every change.
 */
export function useReaderSettings(): {
  settings: ReaderSettings;
  update: (patch: Partial<ReaderSettings>) => void;
  ready: boolean;
} {
  const [settings, setSettings] = React.useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setSettings(loadReaderSettings());
    setReady(true);
  }, []);

  const update = React.useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next: ReaderSettings = { ...prev, ...patch };
      saveReaderSettings(next);
      return next;
    });
  }, []);

  return { settings, update, ready };
}
