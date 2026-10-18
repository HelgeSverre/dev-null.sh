import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPickedImages } from '../../resources/js/lib/read-picked-images.ts';

void test('copies provider bytes without reading unstable metadata', async () => {
    const source = new File(['image bytes'], 'photo.jpg', {
        type: 'image/jpeg',
    });
    const provider = {
        name: source.name,
        type: source.type,
        get size() {
            throw new Error('Metadata must not be read');
        },
        get lastModified() {
            throw new Error('Metadata must not be read');
        },
        stream: () => source.stream(),
    } as unknown as File;
    const [image] = await readPickedImages([provider]);
    assert.notEqual(image, provider);
    assert.equal(image.name, source.name);
    assert.equal(image.type, source.type);
    assert.equal(await image.text(), 'image bytes');
    const form = new FormData();
    form.append('images[]', image);
    assert.equal(await (form.get('images[]') as File).text(), 'image bytes');
});

void test('rejects an unreadable provider instead of attaching a broken file', async () => {
    const provider = {
        type: 'image/png',
        stream: () =>
            new ReadableStream({
                start(controller) {
                    controller.error(
                        new DOMException('Unreadable', 'NotReadableError'),
                    );
                },
            }),
    } as unknown as File;
    await assert.rejects(readPickedImages([provider]), {
        name: 'NotReadableError',
    });
});

void test('bounds oversized reads and cancels the provider stream', async () => {
    let cancelled = false;
    const provider = {
        type: 'image/png',
        stream: () =>
            new ReadableStream({
                pull(controller) {
                    controller.enqueue(new Uint8Array(1024 * 1024));
                },
                cancel() {
                    cancelled = true;
                },
            }),
    } as unknown as File;
    await assert.rejects(readPickedImages([provider]), /10 MB/);
    assert.equal(cancelled, true);
});

void test('rejects empty and unsupported images', async () => {
    await assert.rejects(
        readPickedImages([new File([], 'empty.png', { type: 'image/png' })]),
        /empty/,
    );
    await assert.rejects(
        readPickedImages([
            new File(['gif'], 'photo.gif', { type: 'image/gif' }),
        ]),
        /JPEG/,
    );
});
