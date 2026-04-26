"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface MyChannel {
  id: string;
  name: string;
  handle?: string;
  createdAt: string;
}

interface ChannelContextType {
  channels: MyChannel[];
  activeChannel: MyChannel | null;
  setActiveChannelId: (id: string) => void;
  addChannel: (name: string, handle?: string) => MyChannel;
  removeChannel: (id: string) => void;
}

const STORAGE_KEY = "fortune_yt_my_channels";
const ACTIVE_KEY = "fortune_yt_active_channel";

function genChannelId(): string {
  return "ch_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function createDefaultChannel(): MyChannel {
  return {
    id: genChannelId(),
    name: "メインチャンネル",
    createdAt: new Date().toISOString(),
  };
}

const ChannelContext = createContext<ChannelContextType>({
  channels: [],
  activeChannel: null,
  setActiveChannelId: () => {},
  addChannel: () => createDefaultChannel(),
  removeChannel: () => {},
});

export function ChannelProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<MyChannel[]>([]);
  const [activeChannelId, setActiveChannelIdState] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedChannels = localStorage.getItem(STORAGE_KEY);
    const storedActiveId = localStorage.getItem(ACTIVE_KEY);

    let loaded: MyChannel[];
    if (storedChannels) {
      loaded = JSON.parse(storedChannels);
    } else {
      // No channels yet - create default
      const def = createDefaultChannel();
      loaded = [def];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }

    setChannels(loaded);

    const activeId = storedActiveId && loaded.some((c) => c.id === storedActiveId)
      ? storedActiveId
      : loaded[0]?.id || "";
    setActiveChannelIdState(activeId);
    localStorage.setItem(ACTIVE_KEY, activeId);
    setInitialized(true);
  }, []);

  // Persist channels whenever they change (after init)
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  }, [channels, initialized]);

  // Persist active channel id
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(ACTIVE_KEY, activeChannelId);
  }, [activeChannelId, initialized]);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;

  const setActiveChannelId = (id: string) => {
    if (channels.some((c) => c.id === id)) {
      setActiveChannelIdState(id);
    }
  };

  const addChannel = (name: string, handle?: string): MyChannel => {
    const ch: MyChannel = {
      id: genChannelId(),
      name,
      handle,
      createdAt: new Date().toISOString(),
    };
    setChannels((prev) => [...prev, ch]);
    setActiveChannelIdState(ch.id);
    return ch;
  };

  const removeChannel = (id: string) => {
    // Prevent removing the last channel
    if (channels.length <= 1) return;
    setChannels((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // If the removed channel was active, switch to the first remaining
      if (activeChannelId === id && next.length > 0) {
        setActiveChannelIdState(next[0].id);
      }
      return next;
    });
  };

  return (
    <ChannelContext.Provider
      value={{ channels, activeChannel, setActiveChannelId, addChannel, removeChannel }}
    >
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel() {
  return useContext(ChannelContext);
}
