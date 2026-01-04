let currentNameSpaceId: string = 'default';

export function setCurrentNameSpaceId(id: string) {
    currentNameSpaceId = id;
}

export function getCurrentNameSpaceId() {
    return currentNameSpaceId;
}
