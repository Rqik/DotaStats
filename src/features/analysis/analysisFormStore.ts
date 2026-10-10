import { create } from 'zustand';
import { createAnalysisFormState, readAnalysisForm, saveAnalysisForm, type AnalysisFormState } from './analysisFormState';

interface AnalysisFormStore {
  form: AnalysisFormState;
  isFormSaved: boolean;
  setField: <Key extends keyof AnalysisFormState>(
    key: Key,
    value: AnalysisFormState[Key] | ((current: AnalysisFormState[Key]) => AnalysisFormState[Key]),
  ) => void;
  resetForm: () => void;
}

export function createAnalysisFormStore(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  return create<AnalysisFormStore>((set, get) => ({
    form: readAnalysisForm(storage),
    isFormSaved: true,
    setField: (key, value) => {
      const current = get().form;
      const nextValue = typeof value === 'function' ? value(current[key]) : value;
      const form = { ...current, [key]: nextValue };
      set({ form, isFormSaved: saveAnalysisForm(form, storage) });
    },
    // The confirmed deletion already removed storage; do not recreate its key.
    resetForm: () => set({ form: createAnalysisFormState(), isFormSaved: true }),
  }));
}

export const useAnalysisFormStore = createAnalysisFormStore();
