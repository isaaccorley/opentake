import { create } from 'zustand';
import type { ProjectDoc } from '../core/project';

type ProjectState = {
  doc: ProjectDoc | null;
  past: ProjectDoc[];
  future: ProjectDoc[];
  setDoc: (doc: ProjectDoc | null) => void;
  updateDoc: (update: (doc: ProjectDoc) => ProjectDoc) => void;
  undo: () => void;
  redo: () => void;
};

export const useProjectStore = create<ProjectState>((set) => ({
  doc: null,
  past: [],
  future: [],
  setDoc: (doc) => set({ doc, past: [], future: [] }),
  updateDoc: (update) =>
    set((state) =>
      state.doc
        ? {
            doc: update(state.doc),
            past: [...state.past, state.doc],
            future: [],
          }
        : state,
    ),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      return state.doc && previous
        ? {
            doc: previous,
            past: state.past.slice(0, -1),
            future: [state.doc, ...state.future],
          }
        : state;
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      return state.doc && next
        ? {
            doc: next,
            past: [...state.past, state.doc],
            future: state.future.slice(1),
          }
        : state;
    }),
}));
