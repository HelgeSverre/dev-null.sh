export class PickedImageError extends Error {}

export const maxImages = 3;
export const maxImageBytes = 10 * 1024 * 1024;
export const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const invalidImageMessage =
    'Only JPEG, PNG, or WebP images up to 10 MB.';

/**
 * Copy provider-backed files before reading metadata or creating preview URLs.
 * Android photo providers can report changing timestamps, causing Chromium to
 * reject later reads with ERR_UPLOAD_FILE_CHANGED (crbug.com/40123366).
 */
export async function readPickedImages(files: File[]): Promise<File[]> {
    const images: File[] = [];

    for (const file of files) {
        if (!acceptedImageTypes.includes(file.type)) {
            throw new PickedImageError(invalidImageMessage);
        }

        // Bound the copy without inspecting the provider's size/lastModified.
        const reader = file.stream().getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let bytes = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                bytes += value.byteLength;
                if (bytes > maxImageBytes) {
                    throw new PickedImageError(invalidImageMessage);
                }
                chunks.push(new Uint8Array(value));
            }
        } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }

        if (bytes === 0) {
            throw new PickedImageError(
                'This image is empty. Please select another image.',
            );
        }

        images.push(new File(chunks, file.name, { type: file.type }));
    }

    return images;
}
