export class PickedImageError extends Error {}

const maxImageBytes = 10 * 1024 * 1024;
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Copy provider-backed files before reading metadata or creating preview URLs.
 * Android photo providers can report changing timestamps, causing Chromium to
 * reject later reads with ERR_UPLOAD_FILE_CHANGED (crbug.com/40123366).
 */
export async function readPickedImages(files: File[]): Promise<File[]> {
    const images: File[] = [];

    for (const file of files) {
        if (!acceptedTypes.includes(file.type)) {
            throw new PickedImageError(
                'Only JPEG, PNG, or WebP images up to 10 MB.',
            );
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
                    throw new PickedImageError(
                        'Only JPEG, PNG, or WebP images up to 10 MB.',
                    );
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
