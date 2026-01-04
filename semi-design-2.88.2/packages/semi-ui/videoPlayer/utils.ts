export const formatTime = (time: number) => {
    if (isNaN(time)) {
        return '00:00';
    }
    const hours = Math.floor(time / 3600);
    if (hours > 0) {
        const minutes = Math.floor((time - hours * 3600) / 60);
        const seconds = Math.floor(time % 60);
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
};