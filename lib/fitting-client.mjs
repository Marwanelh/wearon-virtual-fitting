import { CAMERA_PROFILE, MODEL } from './policy.mjs';

export function fittingModel() {
  return { id: MODEL, ...CAMERA_PROFILE };
}

export function createFittingClient(options) {
  const createClient = globalThis.WearOnFittingBackend?.createClient;
  if (typeof createClient !== 'function') throw new Error('The fitting backend is not configured in this public build.');
  return createClient(options);
}
