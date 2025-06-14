/**
 * Interface defining the structure of saved game data
 */
export interface SaveData {
    lastPlayTime: number;
    // Add other save data properties here as needed
}

/**
 * Interface for storage providers that can persist game data
 * Abstracts localStorage, sessionStorage, or custom storage implementations
 */
export interface StorageProvider {
    /** Retrieves a string value by key, returns null if not found */
    getItem(key: string): string | null;
    /** Stores a string value with the given key */
    setItem(key: string, value: string): void;
}

/**
 * Manages game state persistence and loading
 * Provides a layer of abstraction over storage providers for save/load operations
 */
export class SaveManager {
    private storageProvider: StorageProvider;

    /**
     * Creates a new SaveManager instance
     * @param storageProvider - The storage implementation to use for persistence
     */
    constructor(storageProvider: StorageProvider) {
        this.storageProvider = storageProvider;
    }

    /**
     * Retrieves the last recorded play time from storage
     * @returns The timestamp of the last play session, or null if not found
     */
    getLastPlayTime(): number | null {
        const savedTime = this.storageProvider.getItem('lastPlayTime');
        return savedTime ? parseInt(savedTime) : null;
    }

    /**
     * Saves the current play time to storage
     * @param time - The timestamp to save
     */
    setLastPlayTime(time: number): void {
        this.storageProvider.setItem('lastPlayTime', time.toString());
    }

    /**
     * Saves arbitrary game data to storage
     * @param key - The storage key to use
     * @param data - The data to save (will be converted to string)
     */
    saveData(key: string, data: string): void {
        this.storageProvider.setItem(key, data);
    }

    /**
     * Loads game data from storage
     * @param key - The storage key to retrieve
     * @returns The stored data, or null if not found
     */
    loadData(key: string): string | null {
        return this.storageProvider.getItem(key);
    }
} 