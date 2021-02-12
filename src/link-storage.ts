/**
 * Interface storage adapters should implement.
 *
 * Storage adapters are responsible for persisting [[LinkSession]]s and can optionally be
 * passed to the [[Link]] constructor to auto-persist sessions.
 */
export interface LinkStorage {
    /** Write string to storage at key. Should overwrite existing values without error. */
    write(key: string, data: string): Promise<void>
    /** Read key from storage. Should return `null` if key can not be found. */
    read(key: string): Promise<string | null>
    /** Delete key from storage. Should not error if deleting non-existing key. */
    remove(key: string): Promise<void>
}
