/** Wait for a UI result without treating an arbitrary delay as success. */
export async function waitForDom<T>(read: () => T | null, timeout = 2000): Promise<T> {
  const deadline = Date.now() + timeout;
  do {
    const value = read();
    if (value !== null) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  throw new Error('The source details did not finish loading.');
}
