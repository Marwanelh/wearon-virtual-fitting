export function deadline(promise, milliseconds, lateCleanup = () => {}) {
  let expired = false, timer;
  return Promise.race([
    Promise.resolve(promise).then(value => { if (expired) lateCleanup(value); return value; }),
    new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('Operation timed out')); }, milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}
