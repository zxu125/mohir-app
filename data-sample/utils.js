
export function randomTashkentLocation() {
    // Rough bounding box for Tashkent
    const latMin = 41.25, latMax = 41.40;
    const lonMin = 69.15, lonMax = 69.35;

    return {
        latitude: +(Math.random() * (latMax - latMin) + latMin).toFixed(6),
        longitude: +(Math.random() * (lonMax - lonMin) + lonMin).toFixed(6),
    };
}