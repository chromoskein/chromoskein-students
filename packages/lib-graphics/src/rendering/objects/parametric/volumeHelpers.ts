export function alignTo(val: number, align: number): number
{
    return Math.floor((val + align - 1) / align) * align;
};

export function padVolume(buf: Uint8Array, volumeDims: [number, number, number])
{
    const paddedVolumeDims = [alignTo(volumeDims[0], 256), volumeDims[1], volumeDims[2]];
    var padded =
        new Uint8Array(paddedVolumeDims[0] * paddedVolumeDims[1] * paddedVolumeDims[2]);
    // Copy each row into the padded volume buffer
    const nrows = volumeDims[1] * volumeDims[2];
    for (var i = 0; i < nrows; ++i) {
        var inrow = buf.subarray(i * volumeDims[0], i * volumeDims[0] + volumeDims[0]);
        padded.set(inrow, i * paddedVolumeDims[0]);
    }
    return padded;
}

export function getVolumeDimensions(file: string)
{
    var fileRegex = /.*\/(\w+)_(\d+)x(\d+)x(\d+)_(\w+)\.*/;
    var m = file.match(fileRegex);

    if (!m) {
        throw new Error('Could not determine dimensions');
    }

    return [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
}

export const exemplaryVolumes = {
    "Fuel": "7d87jcsh0qodk78/fuel_64x64x64_uint8.raw",
    "Neghip": "zgocya7h33nltu9/neghip_64x64x64_uint8.raw",
    "Hydrogen Atom": "jwbav8s3wmmxd5x/hydrogen_atom_128x128x128_uint8.raw",
    "Boston Teapot": "w4y88hlf2nbduiv/boston_teapot_256x256x178_uint8.raw",
    "Engine": "ld2sqwwd3vaq4zf/engine_256x256x128_uint8.raw",
    "Bonsai": "rdnhdxmxtfxe0sa/bonsai_256x256x256_uint8.raw",
    "Foot": "ic0mik3qv4vqacm/foot_256x256x256_uint8.raw",
    "Skull": "5rfjobn0lvb7tmo/skull_256x256x256_uint8.raw",
    "Aneurysm": "3ykigaiym8uiwbp/aneurism_256x256x256_uint8.raw",
};

export async function fetchExemplaryVolume(file: string): Promise<Uint8Array | null>
{
    const volumeDims = getVolumeDimensions(file);
    const volumeSize = volumeDims[0] * volumeDims[1] * volumeDims[2];

    var url = "https://www.dl.dropboxusercontent.com/s/" + file + "?dl=1";
    try {
        var response = await fetch(url);

        if (!response || !response.body) return null;

        var reader = response.body.getReader();

        var receivedSize = 0;
        var buf: Uint8Array = new Uint8Array(volumeSize);
        while (true) {
            var {done, value} = await reader.read();

            if (done) break;
            if (!value) continue;

            buf.set(value, receivedSize);
            receivedSize += value.length;
        }

        return buf;
    } catch (err) {
        console.log(`Error loading volume: ${err}`);
    }

    return null;
}