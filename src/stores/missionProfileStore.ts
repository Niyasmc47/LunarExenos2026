import { create } from 'zustand';
import {
  MissionProfile,
  MissionRequirementsSet,
  MissionType,
  SingleRequirement,
  MissionProfileValidationResponse,
} from '../types/missionProfile';
import * as api from '../services/missionProfileApi';

interface MissionProfileState {
  profiles: MissionProfile[];
  selectedProfileId: string | null;
  activeProfile: MissionProfile | null;
  isEditing: boolean;
  isCreating: boolean;
  draftProfile: MissionProfile | null;
  validation: MissionProfileValidationResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  filterType: MissionType | 'ALL';

  // Actions
  loadProfiles: () => Promise<void>;
  selectProfile: (id: string) => void;
  setFilterType: (type: MissionType | 'ALL') => void;
  startCreate: (fromTemplateId?: string) => void;
  startEdit: () => void;
  cancelEdit: () => void;
  updateDraftField: <K extends keyof MissionProfile>(key: K, value: MissionProfile[K]) => void;
  updateRequirement: (
    category: 'solar' | 'earth' | 'terrain',
    reqId: string,
    updates: Partial<SingleRequirement>
  ) => void;
  validateDraft: () => Promise<boolean>;
  saveDraft: () => Promise<boolean>;
  duplicateProfile: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  restoreDefaultTemplates: () => Promise<void>;
}

export const useMissionProfileStore = create<MissionProfileState>((set, get) => ({
  profiles: [],
  selectedProfileId: null,
  activeProfile: null,
  isEditing: false,
  isCreating: false,
  draftProfile: null,
  validation: null,
  loading: false,
  saving: false,
  error: null,
  filterType: 'ALL',

  loadProfiles: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchMissionProfiles();
      const currentSelected = get().selectedProfileId;
      const initialSelected = currentSelected && data.some((p) => p.id === currentSelected)
        ? currentSelected
        : data[0]?.id || null;
      const active = data.find((p) => p.id === initialSelected) || null;

      set({
        profiles: data,
        selectedProfileId: initialSelected,
        activeProfile: active,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load mission profiles', loading: false });
    }
  },

  selectProfile: (id: string) => {
    const profile = get().profiles.find((p) => p.id === id) || null;
    set({
      selectedProfileId: id,
      activeProfile: profile,
      isEditing: false,
      isCreating: false,
      draftProfile: null,
      validation: null,
      error: null,
    });
  },

  setFilterType: (type) => set({ filterType: type }),

  startCreate: (fromTemplateId) => {
    const template = fromTemplateId
      ? get().profiles.find((p) => p.id === fromTemplateId)
      : get().profiles.find((p) => p.is_template) || get().profiles[0];

    const baseReqs: MissionRequirementsSet = template
      ? JSON.parse(JSON.stringify(template.requirements))
      : get().profiles[0]?.requirements;

    const newDraft: MissionProfile = {
      id: 'draft-new',
      name: template ? `${template.name.replace(' (Illustrative Template)', '')} (Custom)` : 'New Mission Profile',
      description: 'Custom lunar mission profile defining operational constraints and scientific thresholds.',
      mission_type: template ? template.mission_type : 'custom',
      duration_days: template ? template.duration_days : 7.0,
      start_timestamp_iso: template ? template.start_timestamp_iso : '2026-10-04T12:00:00Z',
      end_timestamp_iso: template ? template.end_timestamp_iso : '2026-10-11T12:00:00Z',
      observer_height_m: template ? template.observer_height_m : 2.0,
      time_display_preference: 'UTC',
      requirements: baseReqs,
      version: 1,
      is_template: false,
      created_at_iso: new Date().toISOString(),
      updated_at_iso: new Date().toISOString(),
    };

    set({
      isCreating: true,
      isEditing: true,
      draftProfile: newDraft,
      validation: null,
      error: null,
    });
  },

  startEdit: () => {
    const active = get().activeProfile;
    if (!active) return;
    set({
      isEditing: true,
      isCreating: false,
      draftProfile: JSON.parse(JSON.stringify(active)),
      validation: null,
      error: null,
    });
  },

  cancelEdit: () => {
    set({
      isEditing: false,
      isCreating: false,
      draftProfile: null,
      validation: null,
      error: null,
    });
  },

  updateDraftField: (key, value) => {
    const draft = get().draftProfile;
    if (!draft) return;
    const updated = { ...draft, [key]: value };

    // Auto-update end date if duration changed and start date is valid
    if (key === 'duration_days' && typeof value === 'number') {
      try {
        const st = new Date(draft.start_timestamp_iso);
        const et = new Date(st.getTime() + value * 86400 * 1000);
        updated.end_timestamp_iso = et.toISOString().replace('.000Z', 'Z');
      } catch {
        // keep existing
      }
    }

    set({ draftProfile: updated });
    get().validateDraft();
  },

  updateRequirement: (category, reqId, updates) => {
    const draft = get().draftProfile;
    if (!draft) return;

    const clonedReqs: MissionRequirementsSet = JSON.parse(JSON.stringify(draft.requirements));
    const targetCategory = clonedReqs[category] as any;
    if (targetCategory && targetCategory[reqId]) {
      targetCategory[reqId] = {
        ...targetCategory[reqId],
        ...updates,
      };
    }

    set({
      draftProfile: {
        ...draft,
        requirements: clonedReqs,
      },
    });
    get().validateDraft();
  },

  validateDraft: async () => {
    const draft = get().draftProfile;
    if (!draft) return false;
    try {
      const resp = await api.validateMissionProfile({
        name: draft.name,
        description: draft.description,
        mission_type: draft.mission_type,
        duration_days: draft.duration_days,
        start_timestamp_iso: draft.start_timestamp_iso,
        end_timestamp_iso: draft.end_timestamp_iso,
        observer_height_m: draft.observer_height_m,
        requirements: draft.requirements,
      });
      set({ validation: resp });
      return resp.is_valid;
    } catch {
      return false;
    }
  },

  saveDraft: async () => {
    const draft = get().draftProfile;
    if (!draft) return false;

    set({ saving: true, error: null });
    try {
      const isValid = await get().validateDraft();
      if (!isValid) {
        set({ saving: false, error: 'Cannot save: Please resolve validation errors shown below.' });
        return false;
      }

      let saved: MissionProfile;
      if (get().isCreating) {
        saved = await api.createMissionProfile({
          name: draft.name,
          description: draft.description,
          mission_type: draft.mission_type,
          duration_days: draft.duration_days,
          start_timestamp_iso: draft.start_timestamp_iso,
          end_timestamp_iso: draft.end_timestamp_iso,
          observer_height_m: draft.observer_height_m,
          time_display_preference: draft.time_display_preference,
          requirements: draft.requirements,
        });
      } else {
        saved = await api.updateMissionProfile(draft.id, {
          name: draft.name,
          description: draft.description,
          mission_type: draft.mission_type,
          duration_days: draft.duration_days,
          start_timestamp_iso: draft.start_timestamp_iso,
          end_timestamp_iso: draft.end_timestamp_iso,
          observer_height_m: draft.observer_height_m,
          time_display_preference: draft.time_display_preference,
          requirements: draft.requirements,
        });
      }

      const all = await api.fetchMissionProfiles();
      set({
        profiles: all,
        selectedProfileId: saved.id,
        activeProfile: saved,
        isEditing: false,
        isCreating: false,
        draftProfile: null,
        validation: null,
        saving: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Failed to save profile', saving: false });
      return false;
    }
  },

  duplicateProfile: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const dup = await api.duplicateMissionProfile(id);
      const all = await api.fetchMissionProfiles();
      set({
        profiles: all,
        selectedProfileId: dup.id,
        activeProfile: dup,
        loading: false,
        isEditing: false,
        isCreating: false,
        draftProfile: null,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to duplicate profile', loading: false });
    }
  },

  deleteProfile: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.deleteMissionProfile(id);
      const all = await api.fetchMissionProfiles();
      const nextId = all[0]?.id || null;
      set({
        profiles: all,
        selectedProfileId: nextId,
        activeProfile: all.find((p) => p.id === nextId) || null,
        loading: false,
        isEditing: false,
        isCreating: false,
        draftProfile: null,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete profile', loading: false });
    }
  },

  restoreDefaultTemplates: async () => {
    set({ loading: true });
    try {
      const restored = await api.restoreTemplates();
      set({
        profiles: restored,
        selectedProfileId: restored[0]?.id || null,
        activeProfile: restored[0] || null,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to restore templates', loading: false });
    }
  },
}));
