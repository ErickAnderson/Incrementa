export interface SaveData {
    lastPlayTime: number;
    // Add other save data properties here as needed
}

export interface StorageProvider {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export class SaveManager {
    private storageProvider: StorageProvider;

    constructor(storageProvider: StorageProvider) {
        this.storageProvider = storageProvider;
    }

    getLastPlayTime(): number | null {
        const savedTime = this.storageProvider.getItem('lastPlayTime');
        return savedTime ? parseInt(savedTime) : null;
    }

    setLastPlayTime(time: number): void {
        this.storageProvider.setItem('lastPlayTime', time.toString());
    }
} 